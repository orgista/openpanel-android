import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ContentItem } from "../App";
import { channelIdForYouTubeItem } from "../native/youtube";
import { orderFeed } from "../native/youtubeFeed";
import { recommend } from "../native/youtubeRecommend";
import { feedVideoLaunchItem, useYouTubeFeed } from "../native/useYouTubeFeed";
import { YouTubeVideoCard } from "./YouTubeVideoCard";

export const UP_NEXT_COUNT = 3;
export const AUTOPLAY_SECONDS = 10;

export interface UpNextConfig {
  items: ContentItem[];
  recommendAfter: number;
  autoplay: boolean;
  onPlay: (item: ContentItem) => void;
}

export function YouTubeUpNext({ items, recommendAfter, autoplay, onPlay, currentVideoId, ended, onClose }: UpNextConfig & {
  currentVideoId: string;
  /** While the video still plays this is a strip along the bottom; once it ends it fills the screen. */
  ended: boolean;
  onClose: () => void;
}) {
  const { channels, videos, progress, history, now } = useYouTubeFeed(items);
  const cards = useMemo(() => {
    const approvedChannelIds = channels.map(item => channelIdForYouTubeItem(item.youtubeItem!));
    const picks = recommendAfter > 0 ? recommend(videos, history, approvedChannelIds, now, { threshold: recommendAfter }) : [];
    const seen = new Set([currentVideoId]);
    return [...picks, ...orderFeed(videos, { approvedChannelIds, progress }, now)]
      .filter(video => !seen.has(video.videoId) && !!seen.add(video.videoId)).slice(0, UP_NEXT_COUNT);
  }, [channels, videos, history, progress, now, recommendAfter, currentVideoId]);
  const [cancelled, setCancelled] = useState(false);
  const playRef = useRef<() => void>(() => undefined);
  playRef.current = () => onPlay(feedVideoLaunchItem(channels, cards[0], now));
  const counting = autoplay && ended && !cancelled && cards.length > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = window.setTimeout(() => playRef.current(), AUTOPLAY_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [counting]);
  if (!cards.length) return null;
  return (
    <div role="dialog" aria-label="Up next" className="yt-upnext" data-ended={ended || undefined} onPointerDown={() => setCancelled(true)}>
      <header>
        <h2>Up next</h2>
        <button type="button" aria-label="Close up next" onClick={onClose}><X className="size-5" /> <span>Close</span></button>
      </header>
      <div className="yt-upnext-cards">
        {cards.map((video, index) => <div key={video.videoId} className="yt-upnext-slot">
          <YouTubeVideoCard video={video} channelTitle={video.channelTitle} progress={progress[video.videoId]}
            onPlay={() => onPlay(feedVideoLaunchItem(channels, video, now))} />
          {index === 0 && counting && <span className="yt-upnext-ring" aria-hidden="true">
            <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" pathLength="100" /></svg>
          </span>}
        </div>)}
      </div>
    </div>
  );
}
