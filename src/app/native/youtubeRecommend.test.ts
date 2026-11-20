import { describe, expect, it } from "vitest";
import type { FeedVideo } from "./youtubeFeed";
import type { WatchEntry } from "./youtubeHistory";
import { recommend } from "./youtubeRecommend";

const DAY = 86400000;
const now = Date.parse("2026-11-10T12:00:00Z");
const id = (n: number) => String(n).padStart(11, "0");
const video = (n: number, channelId = "a", days = 1, extra: Partial<FeedVideo> = {}): FeedVideo => ({
  videoId: id(n), channelId, channelTitle: channelId, title: `Clip ${n}`, thumbnailUrl: "",
  publishedAt: new Date(now - days * DAY).toISOString(), duration: 600, ...extra,
});
const watched = (n: number, channelId: string, ratio: number, extra: Partial<WatchEntry> = {}): WatchEntry => ({
  videoId: id(n), channelId, title: `Clip ${n}`, duration: 600, ratio, completed: ratio >= .9, plays: 1,
  firstWatchedAt: now - DAY, lastWatchedAt: now - DAY, ...extra,
});
const options = { threshold: 3 };
const base = [watched(901, "a", 1), watched(902, "a", 1), watched(903, "a", 1)];

describe("recommend", () => {
  it("returns nothing until enough videos were watched", () => {
    expect(recommend([video(1)], base.slice(0, 2), ["a"], now, options)).toEqual([]);
    expect(recommend([video(1)], base, ["a"], now, options)).toHaveLength(1);
  });
  it("puts the channel the child finishes ahead of the one they abandon", () => {
    const history = [watched(901, "a", 1), watched(902, "a", 1), watched(903, "a", 1),
      watched(904, "b", .08), watched(905, "b", .1)];
    const picks = recommend([video(1, "b"), video(2, "b"), video(3, "a"), video(4, "a")], history, ["a", "b"], now, options);
    expect(picks.slice(0, 2).map(v => v.channelId)).toEqual(["a", "a"]);
  });
  it("never returns completed or twice-abandoned videos, shorts or duplicates", () => {
    const history = [...base, watched(1, "a", .95), watched(2, "a", .1, { plays: 2 })];
    const picks = recommend([video(1), video(2), video(3), video(3), video(4, "a", 1, { isShort: true }),
      video(5, "a", 1, { duration: 60 }), video(6, "a", 1, { videoId: "bad" })], history, ["a"], now, options);
    expect(picks.map(v => v.videoId)).toEqual([id(3)]);
  });
  it("ranks started videos first", () => {
    const picks = recommend([video(1, "a", 1), video(2, "a", 30)], [...base, watched(2, "a", .4)], ["a"], now, options);
    expect(picks[0].videoId).toBe(id(2));
  });
  it("keeps runs to two per channel and gives every fifth slot to the channel with the least history", () => {
    const history = [...base, watched(904, "a", 1), watched(905, "b", 1)];
    const candidates = [...Array.from({ length: 8 }, (_, i) => video(i + 1, "a", 1)), video(20, "b", 3), video(21, "b", 4),
      video(30, "c", 10), video(31, "c", 11)];
    const picks = recommend(candidates, history, ["a", "b", "c"], now, options);
    expect(picks).toHaveLength(12);
    picks.forEach((pick, i) => {
      if (i >= 2) expect([picks[i - 1], picks[i - 2]].every(prev => prev.channelId === pick.channelId)).toBe(false);
    });
    expect(picks[4].channelId).toBe("c");
    expect(picks[9].channelId).toBe("c");
  });
  it("still recommends when only one channel is approved", () => {
    const picks = recommend(Array.from({ length: 6 }, (_, i) => video(i + 1)), base, ["a"], now, options);
    expect(picks).toHaveLength(6);
  });
  it("honours the limit and never returns unapproved channels even when they are in history", () => {
    const history = [...base, watched(910, "x", 1), watched(911, "x", 1)];
    const candidates = [video(1, "x"), ...Array.from({ length: 30 }, (_, i) => video(i + 2, i % 2 ? "a" : "b"))];
    const picks = recommend(candidates, history, ["a", "b"], now, { threshold: 3, limit: 7 });
    expect(picks).toHaveLength(7);
    expect(picks.some(v => v.channelId === "x")).toBe(false);
  });
  it("is deterministic and works with empty history or missing durations", () => {
    const candidates = [video(1, "a", 1, { duration: undefined }), video(2, "b", 1, { duration: undefined }), video(3, "a", 1)];
    expect(recommend(candidates, base, ["a", "b"], now, options)).toEqual(recommend(candidates, base, ["a", "b"], now, options));
    expect(recommend(candidates, [], ["a", "b"], now, { threshold: 0 })).toHaveLength(3);
    expect(recommend([], base, ["a"], now, options)).toEqual([]);
  });
  it("prefers lengths near what the child finishes and topics they finish", () => {
    const history = [...base.map(entry => ({ ...entry, title: "Space rockets" })), watched(904, "a", .05, { title: "Boring lecture" })];
    const picks = recommend([video(1, "a", 1, { title: "Boring lecture today" }), video(2, "a", 1, { title: "Space rockets launch" })],
      history, ["a"], now, options);
    expect(picks[0].videoId).toBe(id(2));
    const lengths = recommend([video(1, "a", 1, { duration: 5400 }), video(2, "a", 1, { duration: 600 })], base, ["a"], now, options);
    expect(lengths[0].videoId).toBe(id(2));
  });
});
