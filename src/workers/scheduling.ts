import { addHours, addSeconds } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

function parseHm(hm: string): { hour: number; minute: number } {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hm);
  if (!m) {
    throw new Error(`Invalid time string: ${hm}`);
  }
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function computeScheduledAt(args: {
  timezone: string;
  sendWindowStartLocal: string; // HH:mm
  sendWindowEndLocal: string; // HH:mm
  sendWithinHours: number;
  baseDelaySeconds: number;
}): Date | null {
  const nowUtc = new Date();
  const earliestUtc = addSeconds(nowUtc, Math.max(0, args.baseDelaySeconds));
  const latestUtc = addHours(nowUtc, Math.max(1, args.sendWithinHours));

  // Determine the local date for earliestUtc.
  const localDateStr = formatInTimeZone(earliestUtc, args.timezone, 'yyyy-MM-dd');
  const { hour: startH, minute: startM } = parseHm(args.sendWindowStartLocal);
  const { hour: endH, minute: endM } = parseHm(args.sendWindowEndLocal);

  const startLocal = `${localDateStr} ${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`;
  const endLocal = `${localDateStr} ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

  let windowStartUtc = fromZonedTime(startLocal, args.timezone);
  let windowEndUtc = fromZonedTime(endLocal, args.timezone);

  // If end <= start, treat as invalid.
  if (windowEndUtc <= windowStartUtc) {
    return null;
  }

  // If earliest is after today's window, push to next day's window start.
  if (earliestUtc > windowEndUtc) {
    const nextDayStr = formatInTimeZone(addHours(earliestUtc, 24), args.timezone, 'yyyy-MM-dd');
    const nextStartLocal = `${nextDayStr} ${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`;
    windowStartUtc = fromZonedTime(nextStartLocal, args.timezone);
  }

  // Candidate is max(earliest, windowStart)
  const candidate = earliestUtc > windowStartUtc ? earliestUtc : windowStartUtc;

  // Must be within today's window.
  const withinWindow = candidate >= windowStartUtc && candidate <= windowEndUtc;
  if (!withinWindow) {
    return null;
  }

  // Must be within horizon.
  if (candidate > latestUtc) {
    return null;
  }

  return candidate;
}
