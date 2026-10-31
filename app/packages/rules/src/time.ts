import type { AirportProfile, CatalogueState, Flight, OpeningHours, Settings, Venue } from './types.js';

const MINUTE = 60_000;
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const HHMM = /^(\d{1,2}):(\d{2})$/;

export class FlightTimeInvalid extends Error {
  constructor() { super('flight departure time is missing or unreadable'); this.name = 'FlightTimeInvalid'; }
}

// One formatter per zone: building them is far slower than using them.
const weekdayFormats = new Map<string, Intl.DateTimeFormat | null>();
function weekdayFormat(timeZone: string): Intl.DateTimeFormat | null {
  if (!weekdayFormats.has(timeZone)) {
    let f: Intl.DateTimeFormat | null;
    try {
      f = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    } catch {
      f = null;
    }
    weekdayFormats.set(timeZone, f);
  }
  return weekdayFormats.get(timeZone)!;
}

/** The zone if Intl knows it, otherwise null. */
export function knownTimeZone(timeZone: string): string | null {
  return weekdayFormat(timeZone) ? timeZone : null;
}

/** Milliseconds the zone is ahead of UTC at that instant. */
function zoneOffset(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(at / 1000) * 1000;
}

/**
 * An upstream ISO 8601 time. One without a UTC offset is read in the airport's time zone
 * (upstream-contracts.md). Null when missing or unreadable.
 */
export function parseInstant(value: string | null | undefined, timeZone: string): Date | null {
  if (typeof value !== 'string') return null;
  const m = ISO.exec(value.trim());
  if (!m) return null;
  const n = (i: number) => Number(m[i] ?? 0);
  const wall = Date.UTC(n(1), n(2) - 1, n(3), n(4), n(5), n(6));
  // Date.UTC rolls 30 February over to March, so check the parts survived.
  const back = new Date(wall);
  if (back.getUTCMonth() !== n(2) - 1 || back.getUTCDate() !== n(3) || back.getUTCHours() !== n(4) || n(5) > 59 || n(6) > 59) return null;
  if (m[7]) {
    const d = new Date(value.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const zone = knownTimeZone(timeZone) ?? 'UTC';
  // Twice, so a time near a clock change uses the offset in force at that time.
  const first = wall - zoneOffset(wall, zone);
  return new Date(wall - zoneOffset(first, zone));
}

export type FlightCheck = 'ok' | 'departed' | 'not-today' | 'unreadable';

/** Whether a flight can be planned for now: readable, not yet departed, and within the planning window. */
export function checkFlight(flight: Flight, profile: AirportProfile, now: Date, settings: Settings): FlightCheck {
  const departure = parseInstant(flight.estimatedDepartureAt, profile.timeZone) ?? parseInstant(flight.scheduledDepartureAt, profile.timeZone);
  if (!departure) return 'unreadable';
  if (departure.getTime() <= now.getTime()) return 'departed';
  if (departure.getTime() - now.getTime() > settings.planAheadHours * 60 * MINUTE) return 'not-today';
  return 'ok';
}

/**
 * Opening hours as the rules read them: days as MON..SUN (any case, short or full name),
 * times as HH:MM up to 24:00. Unreadable entries are dropped; null when none are left,
 * so the venue counts as "hours unknown" rather than closed.
 */
export function cleanOpeningHours(raw: unknown): OpeningHours[] | null {
  if (!Array.isArray(raw)) return null;
  const out: OpeningHours[] = [];
  for (const h of raw) {
    if (!h || typeof h !== 'object') continue;
    const { day, opens, closes } = h as Record<string, unknown>;
    if (typeof day !== 'string' || typeof opens !== 'string' || typeof closes !== 'string') continue;
    const name = day.trim().toUpperCase();
    const i = DAY_NAMES.findIndex((full, k) => name === full || name === DAYS[k]);
    const o = clock(opens);
    const c = clock(closes);
    if (i < 0 || o === null || c === null) continue;
    out.push({ day: DAYS[i]!, opens: o, closes: c });
  }
  return out.length ? out : null;
}

function clock(value: string): string | null {
  const m = HHMM.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export interface UsableTime {
  departureAt: string;
  usableMinutes: number;
  estimates: Array<'boarding' | 'walk'>;
}

/**
 * Usable time = departure - now - boarding buffer - walk buffer.
 * A supplied boarding-close time replaces the departure-minus-buffer estimate;
 * a supplied walk time replaces the walk estimate.
 */
export function usableTime(flight: Flight, profile: AirportProfile, now: Date, walkMinutes?: number | null): UsableTime {
  const departure = parseInstant(flight.estimatedDepartureAt, profile.timeZone) ?? parseInstant(flight.scheduledDepartureAt, profile.timeZone);
  if (!departure) throw new FlightTimeInvalid();
  const estimates: Array<'boarding' | 'walk'> = [];

  let boardingDeadline: number;
  const boardingCloses = parseInstant(flight.boardingClosesAt, profile.timeZone);
  if (boardingCloses) {
    boardingDeadline = boardingCloses.getTime();
  } else {
    boardingDeadline = departure.getTime() - profile.boardingBufferMinutes * MINUTE;
    estimates.push('boarding');
  }

  let walk: number;
  if (walkMinutes != null) {
    walk = walkMinutes;
  } else {
    walk = profile.walkBufferMinutes;
    estimates.push('walk');
  }

  const usable = Math.floor((boardingDeadline - now.getTime()) / MINUTE) - walk;
  return { departureAt: departure.toISOString(), usableMinutes: Math.max(0, usable), estimates };
}

export function catalogueState(lastSuccessfulFetchAt: string, now: Date, settings: Settings): CatalogueState {
  const ageMinutes = (now.getTime() - new Date(lastSuccessfulFetchAt).getTime()) / MINUTE;
  // A refresh time well in the future means a clock is wrong, so the age is unknown.
  if (ageMinutes < -settings.clockSkewMinutes) return 'stale';
  if (ageMinutes < settings.freshMinutes) return 'fresh';
  if (ageMinutes <= settings.staleLimitMinutes) return 'stale';
  return 'too-old';
}

/** Supplied service time, or the default for the venue's concepts. */
export function visitLength(venue: Venue, concepts: readonly string[]): { minutes: number; estimate: boolean } {
  if (venue.serviceMinutes != null && venue.serviceMinutes > 0) return { minutes: venue.serviceMinutes, estimate: false };
  const has = (c: string) => concepts.includes(c);
  if (has('quick-food') || has('takeaway') || has('coffee')) return { minutes: 15, estimate: true };
  if (has('sit-down')) return { minutes: 45, estimate: true };
  return { minutes: 20, estimate: true };
}

function localParts(at: Date, timeZone: string): { day: string; minutes: number } {
  const parts = weekdayFormat(timeZone)!.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = get('weekday').slice(0, 3).toUpperCase();
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Whether the venue is open now and stays open for the whole visit.
 * Returns null when opening hours are not supplied or unreadable, or the airport's time zone is unknown.
 */
export function openForVisit(raw: OpeningHours[] | null | undefined, now: Date, visitMinutes: number, timeZone: string): boolean | null {
  const hours = cleanOpeningHours(raw);
  const zone = knownTimeZone(timeZone);
  if (!hours || !zone) return null;
  const { day, minutes } = localParts(now, zone);
  const today = DAYS.indexOf(day);
  const yesterday = DAYS[(today + 6) % 7];
  const end = minutes + visitMinutes;

  for (const h of hours) {
    const opens = toMinutes(h.opens);
    let closes = toMinutes(h.closes);
    if (closes <= opens) closes += 24 * 60; // closes after midnight
    if (h.day === day && minutes >= opens && end <= closes) return true;
    // A window that started yesterday and runs past midnight.
    if (h.day === yesterday && closes > 24 * 60 && end <= closes - 24 * 60) return true;
  }
  return false;
}
