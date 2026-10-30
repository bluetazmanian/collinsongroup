// Lambda "refresh-catalogue": one SQS message = one airport snapshot (aws-deployment.md).
// Also exports ageCheck, run on a schedule to publish catalogue age even when refreshes fail.
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { ChangeMessageVisibilityCommand, SQSClient } from '@aws-sdk/client-sqs';
import {
  AiThrottled, CatalogueWriter, KeywordReader, SourceUnavailable, documentClient, emitMetric,
  fetchOffers, fetchVenues, retryDelaySeconds, secretReader, type StoredVenue,
} from '@atp/adapters';
import type { Offer } from '@atp/rules';

const env = process.env;
const table = env.TABLE_NAME ?? 'AirportCatalogue';
const db = documentClient();
const writer = new CatalogueWriter(db, table);
// Use the configured endpoint, not the host inside the queue URL (needed in LocalStack, harmless in AWS).
const sqs = new SQSClient({ useQueueUrlAsEndpoint: false });
const modelId = env.BEDROCK_MODEL_ID ?? 'amazon.nova-micro-v1:0';
const ai = new KeywordReader({ modelId, region: env.AWS_REGION ?? 'eu-west-2', endpoint: env.BEDROCK_ENDPOINT || undefined });
const perJob = Number(env.ENRICH_PER_JOB ?? 200);
const perCall = 20;

interface Job { airportId: string; jobId: string }

function parseJob(body: string, messageId: string): Job | null {
  try {
    const b = JSON.parse(body);
    if (typeof b?.airportId !== 'string' || !/^[A-Z]{3}$/.test(b.airportId)) return null;
    return { airportId: b.airportId, jobId: typeof b.jobId === 'string' && b.jobId ? b.jobId : `${b.airportId}#${messageId}` };
  } catch {
    return null;
  }
}

const sameKeywords = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k, i) => k === b[i]);

export async function refreshAirport(job: Job): Promise<Record<string, unknown>> {
  if (!(await writer.startJob(job.jobId))) return { skipped: 'already done' };

  const venues = await fetchVenues({ baseUrl: env.VENUE_SERVICE_URL ?? '', credential: secretReader(env.VENUE_SECRET_ID) }, job.airportId);
  const fetchedAt = new Date().toISOString();

  let offers: Offer[] = [];
  if (env.OFFERS_SOURCE_URL) {
    try {
      offers = await fetchOffers({ baseUrl: env.OFFERS_SOURCE_URL, credential: secretReader(env.OFFERS_SECRET_ID) }, job.airportId);
    } catch (e) {
      console.warn(JSON.stringify({ msg: 'offers feed failed; publishing without offers', airportId: job.airportId }));
    }
  }

  // Reuse concepts for venues whose keywords haven't changed; read changed ones and ones still missing.
  const active = await writer.active(job.airportId);
  const previous = active ? await writer.previousVenues(job.airportId, active.version) : new Map<string, StoredVenue>();
  const stored: StoredVenue[] = venues.map((v) => {
    const prev = previous.get(v.venueId);
    const reuse = prev && prev.enrichment === 'done' && sameKeywords(prev.keywords, v.keywords);
    return {
      ...v,
      concepts: reuse ? prev.concepts : [],
      enrichment: reuse ? 'done' : 'missing',
      enrichedAt: reuse ? prev.enrichedAt ?? null : null,
      modelId: reuse ? prev.modelId ?? null : null,
    };
  });

  const toRead = stored.filter((v) => v.enrichment === 'missing').slice(0, perJob);
  let throttled = false;
  for (let i = 0; i < toRead.length && !throttled; i += perCall) {
    const batch = toRead.slice(i, i + perCall);
    try {
      const r = await ai.read(batch.map((v) => ({ id: v.venueId, name: v.name, kind: v.kind, keywords: v.keywords })));
      for (const w of r.warnings) console.warn(JSON.stringify({ msg: 'ai reply check', warning: w }));
      for (const v of batch) {
        const c = r.concepts.get(v.venueId);
        if (c) Object.assign(v, { concepts: c, enrichment: 'done', enrichedAt: fetchedAt, modelId });
      }
    } catch (e) {
      if (e instanceof AiThrottled) throttled = true;
      else throw e;
    }
  }

  const version = await writer.allocateVersion(job.airportId);
  const published = await writer.publish(job.airportId, version, stored, offers, fetchedAt);
  const missing = stored.filter((v) => v.enrichment === 'missing').length;
  const outcome = { version, published, venues: stored.length, offers: offers.length, enrichmentMissing: missing, throttled };
  await writer.finishJob(job.jobId, outcome);

  emitMetric('CatalogueAgeMinutes', 0, 'None', { AirportId: job.airportId });
  emitMetric('EnrichmentMissing', missing, 'Count', { AirportId: job.airportId });
  if (throttled) emitMetric('BedrockThrottled', 1, 'Count', { AirportId: job.airportId });
  return outcome;
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const failures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    const job = parseJob(record.body, record.messageId);
    if (!job) {
      console.error(JSON.stringify({ msg: 'invalid refresh job; dropping', messageId: record.messageId }));
      continue;
    }
    try {
      const outcome = await refreshAirport(job);
      console.log(JSON.stringify({ msg: 'refresh finished', airportId: job.airportId, ...outcome }));
    } catch (e) {
      const receiveCount = Number(record.attributes?.ApproximateReceiveCount ?? 1);
      const delay = retryDelaySeconds(receiveCount);
      console.error(JSON.stringify({
        msg: 'refresh failed', airportId: job.airportId, error: (e as Error)?.name,
        upstream: e instanceof SourceUnavailable, receiveCount, retryInSeconds: delay,
      }));
      // Shorten the wait before the next attempt instead of the full 30-minute visibility timeout.
      if (env.QUEUE_URL) {
        try {
          await sqs.send(new ChangeMessageVisibilityCommand({ QueueUrl: env.QUEUE_URL, ReceiptHandle: record.receiptHandle, VisibilityTimeout: delay }));
        } catch (ve) {
          console.error(JSON.stringify({ msg: 'could not shorten visibility', error: (ve as Error)?.name }));
        }
      }
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
}

/** Scheduled every 5 minutes: publishes each airport's catalogue age so the alarm fires even if refreshes stop. */
export async function ageCheck(): Promise<void> {
  for (const airportId of (env.AIRPORTS ?? '').split(',').filter(Boolean)) {
    const ptr = await writer.active(airportId);
    const age = ptr ? (Date.now() - new Date(ptr.lastSuccessfulFetchAt).getTime()) / 60_000 : 99_999;
    emitMetric('CatalogueAgeMinutes', Math.round(age), 'None', { AirportId: airportId });
  }
}
