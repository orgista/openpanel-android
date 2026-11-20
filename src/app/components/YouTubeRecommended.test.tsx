import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "../App";
import type { FeedVideo } from "../native/youtubeFeed";
import type { WatchEntry } from "../native/youtubeHistory";
import { YouTubeShelves } from "./YouTubeShelves";
import { YouTubeUpNext } from "./YouTubeUpNext";

const feed = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("../native/useYouTubeFeed", async importOriginal => ({
  ...await importOriginal<typeof import("../native/useYouTubeFeed")>(),
  useYouTubeFeed: () => feed.value,
}));

const now = Date.parse("2026-11-10T12:00:00Z");
const id = (n: number) => String(n).padStart(11, "0");
const channel = (key: string): ContentItem => ({ id: `yt:${key}`, title: key, coverUrl: "", category: "youtube",
  youtubeItem: { id: `channel:${key}`, kind: "channel", sourceId: key, sourceLabel: key, title: key, addedAt: 1 } });
const video = (n: number, channelId: string): FeedVideo => ({ videoId: id(n), channelId, channelTitle: channelId,
  title: `Clip ${n}`, thumbnailUrl: "", publishedAt: new Date(now - n * 86400000).toISOString(), duration: 600 });
const entry = (n: number): WatchEntry => ({ videoId: id(900 + n), channelId: "UCaaaaaaaaaaaaaaaaaaaaaa", title: "Done", duration: 600,
  ratio: 1, completed: true, plays: 1, firstWatchedAt: now, lastWatchedAt: now });
const channels = [channel("UCaaaaaaaaaaaaaaaaaaaaaa"), channel("UCbbbbbbbbbbbbbbbbbbbbbb")];
const videos = Array.from({ length: 12 }, (_, i) => video(i + 1, i % 2 ? "UCaaaaaaaaaaaaaaaaaaaaaa" : "UCbbbbbbbbbbbbbbbbbbbbbb"));
const setFeed = (history: WatchEntry[]) => { feed.value = { channels, loading: false, videos, progress: {}, history, now }; };
const watchedFive = [1, 2, 3, 4, 5].map(entry);

describe("Recommended shelf", () => {
  beforeEach(() => setFeed(watchedFive));
  it("sits above Videos once the threshold is met and removes repeats from the first screen", () => {
    const html = renderToStaticMarkup(<YouTubeShelves items={[]} recommendAfter={5} onLaunch={vi.fn()} />);
    expect(html.indexOf('aria-label="Recommended"')).toBeGreaterThan(-1);
    expect(html.indexOf('aria-label="Recommended"')).toBeLessThan(html.indexOf('aria-label="Videos"'));
    const videosShelf = html.slice(html.indexOf('aria-label="Videos"'));
    const recommended = html.slice(html.indexOf('aria-label="Recommended"'), html.indexOf('aria-label="Videos"'));
    const firstRecommended = recommended.match(/aria-label="Play (Clip \d+)"/)![1];
    expect(videosShelf).not.toContain(`Play ${firstRecommended}"`);
  });
  it("is hidden below the threshold and when Off", () => {
    setFeed(watchedFive.slice(0, 4));
    expect(renderToStaticMarkup(<YouTubeShelves items={[]} recommendAfter={5} onLaunch={vi.fn()} />)).not.toContain("Recommended");
    setFeed(watchedFive);
    expect(renderToStaticMarkup(<YouTubeShelves items={[]} recommendAfter={0} onLaunch={vi.fn()} />)).not.toContain("Recommended");
  });
});

describe("Up next", () => {
  const props = { items: [], recommendAfter: 5, autoplay: false, ended: false, onPlay: vi.fn(), onClose: vi.fn() };
  it("shows three cards without the current video, plus Close", () => {
    setFeed(watchedFive);
    const html = renderToStaticMarkup(<YouTubeUpNext {...props} currentVideoId={id(1)} />);
    expect((html.match(/yt-video-card/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain(`Play Clip 1"`);
    expect(html).toContain('aria-label="Close up next"');
    expect(html).not.toContain("yt-upnext-ring");
  });
  it("falls back to the ordered feed before the threshold and when Off", () => {
    setFeed([]);
    for (const recommendAfter of [5, 0]) {
      const html = renderToStaticMarkup(<YouTubeUpNext {...props} recommendAfter={recommendAfter} currentVideoId={id(1)} />);
      expect((html.match(/yt-video-card/g) ?? [])).toHaveLength(3);
      expect(html).not.toContain(`Play Clip 1"`);
    }
  });
  it("shows the countdown ring on the first card only with Autoplay next, once the video has ended", () => {
    setFeed(watchedFive);
    expect(renderToStaticMarkup(<YouTubeUpNext {...props} autoplay currentVideoId={id(1)} />)).not.toContain("yt-upnext-ring");
    const html = renderToStaticMarkup(<YouTubeUpNext {...props} autoplay ended currentVideoId={id(1)} />);
    expect((html.match(/yt-upnext-ring/g) ?? [])).toHaveLength(1);
    expect(html.indexOf("yt-upnext-ring")).toBeLessThan(html.indexOf("yt-video-card", html.indexOf("yt-video-card") + 1));
  });
  it("is a strip while the video plays and fills the screen once it ends", () => {
    setFeed(watchedFive);
    expect(renderToStaticMarkup(<YouTubeUpNext {...props} currentVideoId={id(1)} />)).not.toContain("data-ended");
    expect(renderToStaticMarkup(<YouTubeUpNext {...props} ended currentVideoId={id(1)} />)).toContain('data-ended="true"');
  });
  it("renders nothing when there is nothing to play next", () => {
    feed.value = { channels, loading: false, videos: [video(1, "UCaaaaaaaaaaaaaaaaaaaaaa")], progress: {}, history: [], now };
    expect(renderToStaticMarkup(<YouTubeUpNext {...props} currentVideoId={id(1)} />)).toBe("");
  });
});
