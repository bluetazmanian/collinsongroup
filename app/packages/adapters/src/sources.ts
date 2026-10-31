// Venue service and offers feed clients, used only by the refresh job.
import { cleanOpeningHours, type Offer, type OpeningHours } from '@atp/rules';

export interface SourceVenue {
  venueId: string;
  name: string;
  kind: string;
  keywords: string[];
  terminal: string | null;
  locationDescription: string | null;
  openingHours: OpeningHours[] | null;
  serviceMinutes: number | null;
  dietary: string[];
}

export class SourceUnavailable extends Error {}

interface ClientOptions {
  baseUrl: string;
  credential?: () => Promise<string>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

async function getJson(o: ClientOptions, path: string): Promise<any> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (o.credential) headers.authorization = `Bearer ${await o.credential()}`;
  let res: Response;
  try {
    res = await (o.fetchImpl ?? fetch)(`${o.baseUrl}${path}`, { headers, signal: AbortSignal.timeout(o.timeoutMs ?? 10_000) });
  } catch (e) {
    throw new SourceUnavailable(`no answer from ${path}`);
  }
  if (!res.ok) throw new SourceUnavailable(`status ${res.status} from ${path}`);
  try {
    return await res.json();
  } catch {
    throw new SourceUnavailable(`malformed JSON from ${path}`);
  }
}

const str = (x: unknown) => (typeof x === 'string' ? x : null);
const strArr = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);

/**
 * Fetch every page of an airport's venues. Venues without an ID or name are skipped, and a venue
 * listed again keeps its first entry: one publish batch can't hold the same key twice.
 */
export async function fetchVenues(o: ClientOptions, airportId: string, maxPages = 50): Promise<SourceVenue[]> {
  const out: SourceVenue[] = [];
  const seen = new Set<string>();
  let token: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const q: string = token ? `?pageToken=${encodeURIComponent(token)}` : '';
    const body = await getJson(o, `/airports/${encodeURIComponent(airportId)}/venues${q}`);
    for (const v of Array.isArray(body?.venues) ? body.venues : []) {
      if (!str(v?.venueId) || !str(v?.name) || seen.has(v.venueId)) continue;
      seen.add(v.venueId);
      out.push({
        venueId: v.venueId,
        name: v.name,
        kind: str(v.kind) ?? 'venue',
        keywords: strArr(v.keywords),
        terminal: str(v.terminal),
        locationDescription: str(v.locationDescription),
        openingHours: cleanOpeningHours(v.openingHours),
        serviceMinutes: typeof v.serviceMinutes === 'number' ? v.serviceMinutes : null,
        dietary: strArr(v.dietary).map((d) => d.trim().toLowerCase()),
      });
    }
    token = str(body?.nextPageToken);
    if (!token) return out;
  }
  throw new SourceUnavailable(`more than ${maxPages} pages for ${airportId}`);
}

/** Fetch live and future offers. Offers without readable start and end times, or ending before they start, are ignored. */
export async function fetchOffers(o: ClientOptions, airportId: string): Promise<Offer[]> {
  const body = await getJson(o, `/airports/${encodeURIComponent(airportId)}/offers`);
  return (Array.isArray(body?.offers) ? body.offers : [])
    .filter((x: any) => str(x?.offerId) && str(x?.venueId) && str(x?.title) && str(x?.startsAt) && str(x?.endsAt)
      && Date.parse(x.endsAt) > Date.parse(x.startsAt))
    .map((x: any) => ({
      offerId: x.offerId, venueId: x.venueId, title: x.title,
      conditions: str(x.conditions), startsAt: x.startsAt, endsAt: x.endsAt,
    }));
}
