import { useEffect, useMemo, useState } from "react";
import type { ContentItem } from "../App";
import { channelIdForYouTubeItem } from "./youtube";
import { getYouTubeChannelVideos } from "./youtubeChannelVideos";
import type { FeedVideo } from "./youtubeFeed";
import { getWatchHistory } from "./youtubeHistory";
import { getYouTubeProgress } from "./youtubeProgress";

export const approvedChannels = (items: readonly ContentItem[]): ContentItem[] =>
  items.filter(item => item.youtubeItem?.kind === "channel" && channelIdForYouTubeItem(item.youtubeItem));

export function feedVideoLaunchItem(channels: readonly ContentItem[], video: FeedVideo, now: number): ContentItem {
  const channel = channels.find(item => channelIdForYouTubeItem(item.youtubeItem!) === video.channelId)!;
  return { ...channel, id: `yt:video:${video.videoId}`, title: video.title, youtubeItem: {
    id: `video:${video.videoId}`, kind: "video", sourceId: video.videoId, sourceLabel: video.videoId,
    title: video.title, thumbnailUrl: video.thumbnailUrl, addedAt: now, channelId: video.channelId,
  } };
}

export function useYouTubeFeed(items: readonly ContentItem[]) {
  const channels = useMemo(() => approvedChannels(items), [items]);
  const [loaded, setLoaded] = useState<{ channels: ContentItem[]; videos: FeedVideo[] } | null>(null);
  const [progress, setProgress] = useState(getYouTubeProgress);
  const [history, setHistory] = useState(getWatchHistory);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => { setProgress(getYouTubeProgress()); setHistory(getWatchHistory()); setNow(Date.now()); };
    window.addEventListener("youtube-progress", update);
    window.addEventListener("youtube-history", update);
    return () => { window.removeEventListener("youtube-progress", update); window.removeEventListener("youtube-history", update); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!channels.length) return;
    void Promise.all(channels.map(async item => {
      const channelId = channelIdForYouTubeItem(item.youtubeItem!);
      try {
        const page = await getYouTubeChannelVideos(channelId);
        return page.videos.map(video => ({ ...video, channelId, channelTitle: item.title }));
      } catch (error) {
        console.warn("Could not load approved channel videos", error);
        return [];
      }
    })).then(pages => {
      if (!cancelled) { setLoaded({ channels, videos: pages.flat() }); setNow(Date.now()); }
    });
    return () => { cancelled = true; };
  }, [channels]);
  return { channels, loading: loaded?.channels !== channels, videos: loaded?.channels === channels ? loaded.videos : [], progress, history, now };
}
