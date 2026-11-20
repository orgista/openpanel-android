import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { YouTubeVideoCard } from "./YouTubeVideoCard";
import { YouTubeShelves } from "./YouTubeShelves";
import { YouTubeChannelBrowser } from "./YouTubeChannelBrowser";

const video = { videoId: "00000000001", title: "Science", thumbnailUrl: "art", publishedAt: "", duration: 125 };
describe("touch YouTube views", () => {
  it("shows duration, channel and progress without art overlays", () => {
    const html = renderToStaticMarkup(<YouTubeVideoCard video={video} channelTitle="Science channel"
      progress={{ videoId: video.videoId, position: 50, duration: 100, updatedAt: 1 }} onPlay={vi.fn()} />);
    expect(html).toContain("2:05");
    expect(html).toContain("Science channel");
    expect(html).toContain('width:50%');
    expect(html).not.toContain("gradient");
    expect(html).not.toContain("<svg");
    const unwatched = renderToStaticMarkup(<YouTubeVideoCard video={video} channelTitle="Science" onPlay={vi.fn()} />);
    expect(unwatched).not.toContain('class="yt-progress"');
  });
  it("renders no shelves without approved channels", () => {
    expect(renderToStaticMarkup(<YouTubeShelves items={[]} onLaunch={vi.fn()} />)).toBe("");
  });
  it("uses shaped placeholders on touch without changing remote loading", () => {
    const props = { item: { id: "channel:1", kind: "channel" as const, sourceId: "UUfPyVJEBD7Di1YYjTdS2v8g",
      sourceLabel: "UCfPyVJEBD7Di1YYjTdS2v8g", title: "Science", addedAt: 1 }, onClose: vi.fn(), onPlay: vi.fn() };
    const touch = renderToStaticMarkup(<YouTubeChannelBrowser {...props} touch />);
    expect(touch).toContain("yt-video-placeholder");
    expect(touch).not.toContain("animate-spin");
    expect(touch).not.toContain("Browse channel videos");
    const remote = renderToStaticMarkup(<YouTubeChannelBrowser {...props} />);
    expect(remote).toContain("Loading channel videos");
    expect(remote).not.toContain("yt-channel-page");
  });
});
