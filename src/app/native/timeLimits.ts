export interface TimeLimits {
  weekdayMinutes: number;
  weekendMinutes: number;
  downtimeEnabled: boolean;
  start: string;
  end: string;
}
export const defaultTimeLimits: TimeLimits = {
  weekdayMinutes: 0, weekendMinutes: 0, downtimeEnabled: false, start: "20:00", end: "07:00",
};
export interface Usage {
  day: string;
  usedMs: number;
  now: number;
  monotonic: number | null;
  boot: number | null;
  observing: boolean;
  extraMs: number;
  downtimeOverrideUntil: number;
  endedForDay: boolean;
  warned: boolean;
  awaySession?: number;
  awaySeen?: number;
}
export function localDay(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
export function initialUsage(now: number): Usage {
  return { day: localDay(now), usedMs: 0, now, monotonic: null, boot: null, observing: false,
    extraMs: 0, downtimeOverrideUntil: 0, endedForDay: false, warned: false };
}
export interface UsageSample { wall: number; monotonic: number; boot: number; observing: boolean; foregroundSince?: number;
  awayMs?: number; awaySession?: number }
export function advanceUsage(usage: Usage, sample: UsageSample): Usage {
  const elapsed = usage.boot === sample.boot && usage.monotonic !== null
    ? Math.max(0, sample.monotonic - usage.monotonic) : 0;
  // The persisted high-water clock also survives reboot with a rolled-back wall clock.
  const now = Math.max(sample.wall, usage.now + elapsed);
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const changedDay = localDay(now) !== usage.day;
  const next = changedDay ? initialUsage(now) : { ...usage };
  const foregroundElapsed = Math.max(0, sample.monotonic - (sample.foregroundSince ?? 0));
  const counted = usage.observing ? Math.min(elapsed, foregroundElapsed, Math.max(0, now - midnight.getTime())) : 0;
  // Screen time spent in other apps, added up natively while OpenPanel was in the background.
  const awayMs = sample.awayMs ?? 0;
  const away = sample.awaySession === undefined ? 0
    : sample.awaySession === usage.awaySession ? Math.max(0, awayMs - (usage.awaySeen ?? 0)) : awayMs;
  return { ...next, now, usedMs: next.usedMs + counted + Math.min(away, Math.max(0, now - midnight.getTime())),
    monotonic: sample.monotonic, boot: sample.boot, observing: sample.observing,
    awaySession: sample.awaySession, awaySeen: awayMs };
}
function minuteOfDay(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}
export function timeLimitStatus(settings: TimeLimits, usage: Usage) {
  const date = new Date(usage.now);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const budget = weekend ? settings.weekendMinutes : settings.weekdayMinutes;
  const remainingMs = budget === 0 ? Infinity : Math.max(0, budget * 60_000 + usage.extraMs - usage.usedMs);
  const minute = date.getHours() * 60 + date.getMinutes();
  const start = minuteOfDay(settings.start), end = minuteOfDay(settings.end);
  const inDowntime = settings.downtimeEnabled && start !== end
    && (start < end ? minute >= start && minute < end : minute >= start || minute < end);
  const reason = usage.endedForDay ? null : inDowntime && usage.now >= usage.downtimeOverrideUntil
    ? "downtime" : remainingMs <= 0 ? "limit" : null;
  const nextMidnight = new Date(date); nextMidnight.setHours(24, 0, 0, 0);
  const downtimeEnd = new Date(date); downtimeEnd.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (downtimeEnd.getTime() <= usage.now) downtimeEnd.setDate(downtimeEnd.getDate() + 1);
  let unlockAt = reason === "downtime" ? downtimeEnd.getTime() : nextMidnight.getTime();
  // Exhausted daily time cannot unlock until both the reset and downtime have passed.
  if (reason === "downtime" && remainingMs <= 0) unlockAt = Math.max(unlockAt, nextMidnight.getTime());
  if (reason !== null && remainingMs <= 0 && settings.downtimeEnabled && start > end) {
    const endAfterReset = new Date(nextMidnight); endAfterReset.setHours(Math.floor(end / 60), end % 60, 0, 0);
    unlockAt = endAfterReset.getTime();
  }
  return { reason, remainingMs, unlockAt };
}
/** Wall time at which downtime will next lock the tablet, or -1 when it will not. */
export function nextDowntimeAt(settings: TimeLimits, usage: Usage): number {
  if (!settings.downtimeEnabled || usage.endedForDay) return -1;
  const start = minuteOfDay(settings.start);
  if (start === minuteOfDay(settings.end)) return -1;
  if (timeLimitStatus({ ...settings, weekdayMinutes: 0, weekendMinutes: 0 }, { ...usage, downtimeOverrideUntil: 0 }).reason === "downtime") {
    return Math.max(usage.now, usage.downtimeOverrideUntil);
  }
  const next = new Date(usage.now); next.setHours(Math.floor(start / 60), start % 60, 0, 0);
  if (next.getTime() <= usage.now) next.setDate(next.getDate() + 1);
  return next.getTime();
}
export function grantExtraTime(usage: Usage, settings: TimeLimits): Usage {
  const day = new Date(usage.now).getDay();
  const budget = day === 0 || day === 6 ? settings.weekendMinutes : settings.weekdayMinutes;
  return { ...usage, extraMs: Math.max(usage.extraMs, usage.usedMs - budget * 60_000) + 15 * 60_000,
    downtimeOverrideUntil: usage.now + 15 * 60_000, warned: false };
}

export function availableLabel(unlockAt: number, now: number): string {
  const unlock = new Date(unlockAt);
  const time = unlock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (unlock.toDateString() === new Date(now).toDateString()) return `Available ${time}`;
  return unlock.getHours() === 0 && unlock.getMinutes() === 0 ? "Available tomorrow" : `Available tomorrow ${time}`;
}
