import { afterEach, describe, expect, it, vi } from "vitest";
import { clearWatchHistory, getWatchHistory, isPlay, recordWatch, watchedCount } from "./youtubeHistory";

const store = () => {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
};
const sample = (n: number, position: number, duration = 600) =>
  ({ videoId: String(n).padStart(11, "0"), channelId: "a", title: "Clip", duration, position });
afterEach(() => vi.unstubAllGlobals());

describe("watch history", () => {
  it("counts a play after 30 s or 20%, whichever is smaller, once per session", () => {
    expect(isPlay(29, 600)).toBe(false);
    expect(isPlay(30, 600)).toBe(true);
    expect(isPlay(11, 60)).toBe(false);
    expect(isPlay(12, 60)).toBe(true);
    store();
    const counted = new Set<string>();
    recordWatch(sample(1, 10), 1, counted);
    expect(watchedCount(getWatchHistory())).toBe(0);
    recordWatch(sample(1, 40), 2, counted);
    recordWatch(sample(1, 50), 3, counted);
    expect(getWatchHistory()).toEqual([expect.objectContaining({ plays: 1, firstWatchedAt: 1, lastWatchedAt: 3 })]);
    recordWatch(sample(1, 60), 4, new Set());
    expect(getWatchHistory()[0].plays).toBe(2);
  });
  it("keeps the furthest ratio and marks completion at 90%", () => {
    store();
    const counted = new Set<string>();
    recordWatch(sample(1, 570), 1, counted);
    recordWatch(sample(1, 100), 2, counted);
    expect(getWatchHistory()[0]).toMatchObject({ ratio: .95, completed: true });
  });
  it("keeps only the newest 500 entries and clears on request", () => {
    store();
    for (let n = 1; n <= 502; n++) recordWatch(sample(n, 100), n, new Set());
    const history = getWatchHistory();
    expect(history).toHaveLength(500);
    expect(history.some(entry => entry.videoId === sample(1, 1).videoId)).toBe(false);
    clearWatchHistory();
    expect(getWatchHistory()).toEqual([]);
  });
  it("ignores invalid samples and treats corrupt storage as empty", () => {
    store();
    recordWatch({ ...sample(1, 100), videoId: "bad" }, 1, new Set());
    recordWatch(sample(1, 100, 0), 1, new Set());
    recordWatch(sample(1, NaN), 1, new Set());
    expect(getWatchHistory()).toEqual([]);
    vi.stubGlobal("localStorage", { getItem: () => "{" });
    expect(getWatchHistory()).toEqual([]);
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify([{ videoId: "00000000001" }, null, 4]) });
    expect(getWatchHistory()).toEqual([]);
  });
});
