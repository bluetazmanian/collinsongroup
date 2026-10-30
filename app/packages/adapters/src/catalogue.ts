// DynamoDB access for AirportCatalogue (aws-deployment.md, "Exactly what DynamoDB holds").
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { AirportProfile, Catalogue, Offer, Venue } from '@atp/rules';

const airportPk = (id: string) => `AIRPORT#${id}`;
const versionPk = (id: string, v: number) => `AIRPORT#${id}#VERSION#${v}`;
const DAY = 86_400;

export function documentClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
}

export interface ActivePointer {
  version: number;
  lastSuccessfulFetchAt: string;
}

/** Read side, used by the recommendations function. Caches the pointer briefly and each immutable version for good. */
export class CatalogueReader {
  private pointers = new Map<string, { at: number; value: ActivePointer | null }>();
  private versions = new Map<string, Catalogue>();
  private profiles = new Map<string, { at: number; value: AirportProfile | null }>();

  constructor(
    private db: DynamoDBDocumentClient,
    private table: string,
    private pointerCacheSeconds = 30,
    private clock: () => number = Date.now,
  ) {}

  async airport(airportId: string): Promise<AirportProfile | null> {
    const hit = this.profiles.get(airportId);
    if (hit && this.clock() - hit.at < 300_000) return hit.value;
    const r = await this.db.send(new GetCommand({ TableName: this.table, Key: { PK: airportPk(airportId), SK: 'PROFILE' } }));
    const value = r.Item
      ? { airportId, timeZone: r.Item.timeZone, boardingBufferMinutes: r.Item.boardingBufferMinutes, walkBufferMinutes: r.Item.walkBufferMinutes }
      : null;
    this.profiles.set(airportId, { at: this.clock(), value });
    return value;
  }

  async active(airportId: string): Promise<ActivePointer | null> {
    const hit = this.pointers.get(airportId);
    if (hit && this.clock() - hit.at < this.pointerCacheSeconds * 1000) return hit.value;
    const r = await this.db.send(new GetCommand({
      TableName: this.table, Key: { PK: airportPk(airportId), SK: 'ACTIVE' }, ConsistentRead: true,
    }));
    const value = r.Item ? { version: r.Item.version as number, lastSuccessfulFetchAt: r.Item.lastSuccessfulFetchAt as string } : null;
    this.pointers.set(airportId, { at: this.clock(), value });
    return value;
  }

  /** The active catalogue, or null if the airport has none. */
  async catalogue(airportId: string): Promise<Catalogue | null> {
    const ptr = await this.active(airportId);
    if (!ptr) return null;
    const key = `${airportId}#${ptr.version}`;
    let cat = this.versions.get(key);
    if (!cat) {
      cat = await readVersion(this.db, this.table, airportId, ptr.version, ptr.lastSuccessfulFetchAt);
      this.versions.clear(); // keep only the current version in memory
      this.versions.set(key, cat);
    }
    return { ...cat, lastSuccessfulFetchAt: ptr.lastSuccessfulFetchAt };
  }
}

async function queryAll(db: DynamoDBDocumentClient, table: string, pk: string): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = [];
  let start: Record<string, any> | undefined;
  do {
    const r = await db.send(new QueryCommand({
      TableName: table, KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': pk }, ExclusiveStartKey: start,
    }));
    items.push(...(r.Items ?? []));
    start = r.LastEvaluatedKey;
  } while (start);
  return items;
}

export async function readVersion(db: DynamoDBDocumentClient, table: string, airportId: string, version: number, fetchedAt: string): Promise<Catalogue> {
  const items = await queryAll(db, table, versionPk(airportId, version));
  const venues: Venue[] = [];
  const offers: Offer[] = [];
  for (const it of items) {
    if (String(it.SK).startsWith('VENUE#')) {
      venues.push({
        venueId: it.venueId, name: it.name, kind: it.kind, keywords: it.keywords ?? [], concepts: it.concepts ?? [],
        enrichment: it.enrichment, dietary: it.dietary ?? [], terminal: it.terminal ?? null,
        locationDescription: it.locationDescription ?? null, openingHours: it.openingHours ?? null, serviceMinutes: it.serviceMinutes ?? null,
      });
    } else if (String(it.SK).startsWith('OFFER#')) {
      offers.push({ offerId: it.offerId, venueId: it.venueId, title: it.title, conditions: it.conditions ?? null, startsAt: it.startsAt, endsAt: it.endsAt });
    }
  }
  return { version, lastSuccessfulFetchAt: fetchedAt, venues, offers };
}

export interface StoredVenue extends Venue {
  enrichedAt?: string | null;
  modelId?: string | null;
}

/** Write side, used by the refresh function. */
export class CatalogueWriter {
  constructor(private db: DynamoDBDocumentClient, private table: string, private clock: () => number = Date.now) {}

  /** Claims a job. Returns false if it already finished (a duplicate delivery). */
  async startJob(jobId: string): Promise<boolean> {
    try {
      await this.db.send(new PutCommand({
        TableName: this.table,
        Item: { PK: `JOB#${jobId}`, SK: 'STATE', state: 'running', startedAt: new Date(this.clock()).toISOString(), expiresAt: Math.floor(this.clock() / 1000) + 7 * DAY },
        ConditionExpression: 'attribute_not_exists(PK) OR #s <> :done',
        ExpressionAttributeNames: { '#s': 'state' },
        ExpressionAttributeValues: { ':done': 'done' },
      }));
      return true;
    } catch (e: any) {
      if (e?.name === 'ConditionalCheckFailedException') return false;
      throw e;
    }
  }

  async finishJob(jobId: string, outcome: Record<string, unknown>): Promise<void> {
    await this.db.send(new UpdateCommand({
      TableName: this.table, Key: { PK: `JOB#${jobId}`, SK: 'STATE' },
      UpdateExpression: 'SET #s = :done, outcome = :o, finishedAt = :t',
      ExpressionAttributeNames: { '#s': 'state' },
      ExpressionAttributeValues: { ':done': 'done', ':o': outcome, ':t': new Date(this.clock()).toISOString() },
    }));
  }

  async active(airportId: string): Promise<ActivePointer | null> {
    const r = await this.db.send(new GetCommand({ TableName: this.table, Key: { PK: airportPk(airportId), SK: 'ACTIVE' }, ConsistentRead: true }));
    return r.Item ? { version: r.Item.version, lastSuccessfulFetchAt: r.Item.lastSuccessfulFetchAt } : null;
  }

  async previousVenues(airportId: string, version: number): Promise<Map<string, StoredVenue>> {
    const items = await queryAll(this.db, this.table, versionPk(airportId, version));
    return new Map(items.filter((i) => String(i.SK).startsWith('VENUE#')).map((i) => [i.venueId, i as StoredVenue]));
  }

  async allocateVersion(airportId: string): Promise<number> {
    const r = await this.db.send(new UpdateCommand({
      TableName: this.table, Key: { PK: airportPk(airportId), SK: 'COUNTER' },
      UpdateExpression: 'ADD nextVersion :one', ExpressionAttributeValues: { ':one': 1 }, ReturnValues: 'UPDATED_NEW',
    }));
    return Number(r.Attributes?.nextVersion);
  }

  /** Writes every venue and offer, then moves the pointer only if this version is newer. Returns true if published. */
  async publish(airportId: string, version: number, venues: StoredVenue[], offers: Offer[], fetchedAt: string): Promise<boolean> {
    const pk = versionPk(airportId, version);
    const puts = [
      ...venues.map((v) => ({ PK: pk, SK: `VENUE#${v.venueId}`, ...v })),
      ...offers.map((o) => ({ PK: pk, SK: `OFFER#${o.venueId}#${o.offerId}`, ...o, fetchedAt })),
    ];
    for (let i = 0; i < puts.length; i += 25) {
      let request: any[] = puts.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
      for (let attempt = 0; request.length && attempt < 5; attempt++) {
        const r = await this.db.send(new BatchWriteCommand({ RequestItems: { [this.table]: request } }));
        request = r.UnprocessedItems?.[this.table] ?? [];
        if (request.length) await new Promise((res) => setTimeout(res, 100 * 2 ** attempt));
      }
      if (request.length) throw new Error('could not write all catalogue items');
    }

    const previous = await this.active(airportId);
    try {
      await this.db.send(new UpdateCommand({
        TableName: this.table, Key: { PK: airportPk(airportId), SK: 'ACTIVE' },
        UpdateExpression: 'SET version = :v, lastSuccessfulFetchAt = :t',
        ConditionExpression: 'attribute_not_exists(version) OR version < :v',
        ExpressionAttributeValues: { ':v': version, ':t': fetchedAt },
      }));
    } catch (e: any) {
      if (e?.name !== 'ConditionalCheckFailedException') throw e;
      await this.expireVersion(airportId, version); // a newer version won; ours is never used
      return false;
    }
    if (previous && previous.version !== version) await this.expireVersion(airportId, previous.version);
    return true;
  }

  /** Superseded versions are deleted by TTL some time after 24 hours. */
  async expireVersion(airportId: string, version: number): Promise<void> {
    const expiresAt = Math.floor(this.clock() / 1000) + DAY;
    const items = await queryAll(this.db, this.table, versionPk(airportId, version));
    for (const it of items) {
      await this.db.send(new UpdateCommand({
        TableName: this.table, Key: { PK: it.PK, SK: it.SK },
        UpdateExpression: 'SET expiresAt = :e', ExpressionAttributeValues: { ':e': expiresAt },
      }));
    }
  }
}
