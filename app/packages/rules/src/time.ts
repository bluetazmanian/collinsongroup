import type { AirportProfile, CatalogueState, Flight, OpeningHours, Settings, Venue } from './types.js';

const MINUTE = 60_000;
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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
  const departure = new Date(flight.estimatedDepartureAt ?? flight.scheduledDepartureAt);
  const estimates: Array<'boarding' | 'walk'> = [];

  let boardingDeadline: number;
  if (flight.boardingClosesAt) {
    boardingDeadline = new Date(flight.boardingClosesAt).getTime();
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
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
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
 * Returns null when opening hours are not supplied.
 */
export function openForVisit(hours: OpeningHours[] | null | undefined, now: Date, visitMinutes: number, timeZone: string): boolean | null {
  if (!hours || hours.length === 0) return null;
  const { day, minutes } = localParts(now, timeZone);
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
