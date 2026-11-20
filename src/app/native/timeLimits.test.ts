import { describe, expect, it } from "vitest";
import { advanceUsage, availableLabel, initialUsage, nextDowntimeAt, timeLimitStatus, defaultTimeLimits, grantExtraTime } from "./timeLimits";
const minute = 60_000;
const at = (day: string, hour: number, min = 0) => new Date(`${day}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`).getTime();
const settings = { ...defaultTimeLimits, weekdayMinutes: 15, weekendMinutes: 30 };
describe("time limits", () => {
  it("uses weekday and weekend budgets and locks at zero", () => {
    const friday = at("2026-11-13", 12), saturday = at("2026-11-14", 12);
    const usage = { ...initialUsage(friday), usedMs: 15 * minute };
    expect(timeLimitStatus(settings, usage).reason).toBe("limit");
    expect(timeLimitStatus(settings, { ...initialUsage(saturday), usedMs: 15 * minute }).remainingMs).toBe(15 * minute);
  });
  it("handles downtime across midnight, boundaries, and equal times", () => {
    const s = { ...defaultTimeLimits, downtimeEnabled: true, start: "20:00", end: "07:00" };
    for (const hour of [20, 23, 0, 6]) expect(timeLimitStatus(s, initialUsage(at("2026-11-10", hour))).reason).toBe("downtime");
    expect(timeLimitStatus(s, initialUsage(at("2026-11-10", 7))).reason).toBe(null);
    expect(timeLimitStatus({ ...s, end: "20:00" }, initialUsage(at("2026-11-10", 12))).reason).toBe(null);
    expect(timeLimitStatus({ ...s, start: "10:00", end: "11:00" }, initialUsage(at("2026-11-10", 10))).reason).toBe("downtime");
  });
  it("waits through next morning downtime when both locks apply before dawn", () => {
    const now = at("2026-11-10", 6);
    const s = { ...settings, downtimeEnabled: true };
    const status = timeLimitStatus(s, { ...initialUsage(now), usedMs: 15 * minute });
    expect(status.reason).toBe("downtime");
    expect(status.unlockAt).toBe(at("2026-11-11", 7));
  });
  it("counts only observed awake intervals and resets at local midnight", () => {
    const now = at("2026-11-10", 23, 59);
    let u = { ...initialUsage(now), monotonic: 0, boot: 1, observing: true };
    u = advanceUsage(u, { wall: now + minute, monotonic: minute, boot: 1, observing: true });
    expect(u.usedMs).toBe(0);
    u = advanceUsage(u, { wall: now + 2 * minute, monotonic: 2 * minute, boot: 1, observing: false });
    expect(u.usedMs).toBe(minute);
    u = advanceUsage(u, { wall: now + 3 * minute, monotonic: 3 * minute, boot: 1, observing: true });
    expect(u.usedMs).toBe(minute);
  });
  it("excludes time asleep or in another app when the WebView resumes", () => {
    const now = at("2026-11-10", 12);
    const u = { ...initialUsage(now), monotonic: minute, boot: 1, observing: true };
    const resumed = advanceUsage(u, { wall: now + 60 * minute, monotonic: 61 * minute,
      foregroundSince: 61 * minute, boot: 1, observing: true });
    expect(resumed.usedMs).toBe(0);
    expect(advanceUsage(resumed, { wall: now + 61 * minute, monotonic: 62 * minute,
      foregroundSince: 61 * minute, boot: 1, observing: true }).usedMs).toBe(minute);
  });
  it("does not grant time on rollback or reboot and survives serialization", () => {
    const now = at("2026-11-10", 12);
    const u = { ...initialUsage(now), usedMs: 10 * minute, monotonic: 50 * minute, boot: 1, observing: true };
    const rolled = advanceUsage(JSON.parse(JSON.stringify(u)), { wall: now - 3600000, monotonic: 51 * minute, boot: 1, observing: true });
    expect(rolled.now).toBe(now + minute);
    expect(rolled.usedMs).toBe(11 * minute);
    const reboot = advanceUsage(rolled, { wall: now - 3600000, monotonic: minute, boot: 2, observing: true });
    expect(reboot.usedMs).toBe(rolled.usedMs);
    expect(reboot.day).toBe(rolled.day);
    expect(reboot.now).toBe(rolled.now);
  });
  it("grants a full 15 minutes after the daily budget is reduced below usage", () => {
    const usage = { ...initialUsage(at("2026-11-10", 12)), usedMs: 60 * minute };
    expect(timeLimitStatus(settings, grantExtraTime(usage, settings)).remainingMs).toBe(15 * minute);
  });
  it("allows a timed extension during downtime and ends it after 15 minutes", () => {
    const now = at("2026-11-10", 21);
    const s = { ...settings, downtimeEnabled: true };
    const u = grantExtraTime({ ...initialUsage(now), usedMs: 15 * minute }, s);
    expect(timeLimitStatus(s, u).reason).toBe(null);
    expect(timeLimitStatus(s, { ...u, now: now + 15 * minute, usedMs: 30 * minute }).reason).toBe("downtime");
    expect(timeLimitStatus(s, { ...u, endedForDay: true }).reason).toBe(null);
  });
});

describe("availableLabel", () => {
  const now = new Date(2026, 10, 11, 21, 0).getTime();
  it("names tomorrow instead of a midnight clock time", () => {
    expect(availableLabel(new Date(2026, 10, 12, 0, 0).getTime(), now)).toBe("Available tomorrow");
    expect(availableLabel(new Date(2026, 10, 12, 7, 0).getTime(), now)).toMatch(/^Available tomorrow 7:00/);
    expect(availableLabel(new Date(2026, 10, 11, 22, 30).getTime(), now)).toMatch(/^Available 10:30/);
  });
  it("adds screen time spent in other apps once per native session", () => {
    const now = at("2026-11-13", 12);
    let u = { ...initialUsage(now), monotonic: 0, boot: 1 };
    const sample = { wall: now, monotonic: 0, boot: 1, observing: false, awaySession: 7 };
    u = advanceUsage(u, { ...sample, awayMs: 4 * minute });
    expect(u.usedMs).toBe(4 * minute);
    u = advanceUsage(u, { ...sample, awayMs: 4 * minute });
    expect(u.usedMs).toBe(4 * minute);
    u = advanceUsage(u, { ...sample, awayMs: 6 * minute });
    expect(u.usedMs).toBe(6 * minute);
    u = advanceUsage(u, { ...sample, awaySession: 8, awayMs: minute });
    expect(u.usedMs).toBe(7 * minute);
  });
  it("finds the next downtime start, or the end of a granted extension", () => {
    const s = { ...defaultTimeLimits, downtimeEnabled: true, start: "20:00", end: "07:00" };
    expect(nextDowntimeAt(s, initialUsage(at("2026-11-13", 12)))).toBe(at("2026-11-13", 20));
    expect(nextDowntimeAt(s, initialUsage(at("2026-11-13", 21)))).toBe(at("2026-11-13", 21));
    const extended = { ...initialUsage(at("2026-11-13", 21)), downtimeOverrideUntil: at("2026-11-13", 21, 15) };
    expect(nextDowntimeAt(s, extended)).toBe(at("2026-11-13", 21, 15));
    expect(nextDowntimeAt({ ...s, downtimeEnabled: false }, initialUsage(at("2026-11-13", 12)))).toBe(-1);
    expect(nextDowntimeAt(s, { ...initialUsage(at("2026-11-13", 12)), endedForDay: true })).toBe(-1);
  });
});
