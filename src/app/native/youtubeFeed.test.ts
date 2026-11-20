import { describe, expect, it } from "vitest";
import { orderFeed, type FeedVideo } from "./youtubeFeed";

const now = Date.parse("2026-11-10T00:00:00Z");
const video = (id: number, channelId = "a", days = 0): FeedVideo => ({
  videoId: String(id).padStart(11, "0"), channelId, channelTitle: channelId,
  title: String(id), thumbnailUrl: "", publishedAt: new Date(now - days * 86400000).toISOString(),
});
const state = { approvedChannelIds: ["a", "b", "c"], progress: {} };

describe("orderFeed", () => {
  it("keeps only approved, playable, unique long-form videos", () => {
    const videos = [video(1), video(1), video(2, "unapproved"), { ...video(3), videoId: "" },
      { ...video(4), duration: 60 }, { ...video(5), isShort: true }, { ...video(6), duration: 61 }];
    expect(orderFeed(videos, state, now).map(v => v.videoId)).toEqual([video(1).videoId, video(6).videoId]);
  });
  it("uses freshness with a 14 day half-life", () => {
    expect(orderFeed([video(1, "a", 28), video(2, "a", 14), video(3)], state, now).map(v => v.title)).toEqual(["3", "2", "1"]);
  });
  it("sinks finished videos and boosts partial watches", () => {
    const progress = {
      [video(1).videoId]: { videoId: video(1).videoId, position: 95, duration: 100, updatedAt: now },
      [video(2).videoId]: { videoId: video(2).videoId, position: 40, duration: 100, updatedAt: now },
    };
    expect(orderFeed([video(1), video(2, "a", 50), video(3)], { ...state, progress }, now).map(v => v.title)).toEqual(["2", "3", "1"]);
  });
  it("interleaves prolific channels and covers channels in the first round", () => {
    const videos = [...Array.from({ length: 20 }, (_, i) => video(i)), video(21, "b", 90), video(22, "c", 100)];
    const ordered = orderFeed(videos, state, now);
    expect(new Set(ordered.slice(0, 3).map(v => v.channelId)).size).toBe(3);
    expect(ordered.slice(0, 6).map(v => v.channelId)).toEqual(["a", "b", "c", "a", "a", "a"]);
  });
  it("is deterministic, does not mutate input, and breaks ties by date then id", () => {
    const videos = [video(3), video(2), video(1)];
    expect(orderFeed(videos, state, now)).toEqual(orderFeed([...videos].reverse(), state, now));
    expect(videos.map(v => v.title)).toEqual(["3", "2", "1"]);
    expect(orderFeed(videos, state, now).map(v => v.title)).toEqual(["1", "2", "3"]);
  });
  it("handles relative catalog dates and caps the first round at eight channels", () => {
    const channels = Array.from({ length: 10 }, (_, i) => String(i));
    const videos = channels.map((c, i) => ({ ...video(i, c), publishedAt: `${i + 1} days ago` }));
    expect(new Set(orderFeed(videos, { ...state, approvedChannelIds: channels }, now).slice(0, 8).map(v => v.channelId)).size).toBe(8);
    expect(orderFeed([{ ...video(1), publishedAt: "2 weeks ago" }, video(2, "a", 1)], state, now)[0].title).toBe("2");
  });
});
