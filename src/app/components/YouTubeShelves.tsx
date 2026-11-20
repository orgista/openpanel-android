import { useMemo } from "react";
import type { ContentItem } from "../App";
import { channelIdForYouTubeItem } from "../native/youtube";
import { DEFAULT_RECOMMEND_AFTER } from "../native/adminSettings";
import { orderFeed, type FeedVideo } from "../native/youtubeFeed";
import { recommend } from "../native/youtubeRecommend";
import { feedVideoLaunchItem, useYouTubeFeed } from "../native/useYouTubeFeed";
import { ArtImage, LetterAvatar } from "./ArtImage";
import { YouTubeVideoCard, YouTubeVideoPlaceholders } from "./YouTubeVideoCard";

const MIN_RECOMMENDED = 4;
const FIRST_SCREEN = 6;

export function YouTubeShelves({ items, recommendAfter = DEFAULT_RECOMMEND_AFTER, onLaunch, onArtFailure }: {
  items: ContentItem[];
  recommendAfter?: number;
  onLaunch: (item: ContentItem) => void;
  onArtFailure?: (item: ContentItem) => void;
}) {
  const { channels, loading, videos: loadedVideos, progress, history, now } = useYouTubeFeed(items);
  const approvedChannelIds = useMemo(() => channels.map(item => channelIdForYouTubeItem(item.youtubeItem!)), [channels]);
  const ordered = useMemo(() => orderFeed(loadedVideos, { approvedChannelIds, progress }, now),
    [loadedVideos, approvedChannelIds, progress, now]);
  const recommended = useMemo(() => {
    const picks = recommendAfter > 0 ? recommend(loadedVideos, history, approvedChannelIds, now, { threshold: recommendAfter }) : [];
    return picks.length >= MIN_RECOMMENDED ? picks : [];
  }, [recommendAfter, loadedVideos, history, approvedChannelIds, now]);
  const recommendedIds = new Set(recommended.map(video => video.videoId));
  const videos = ordered.filter((video, index) => index >= FIRST_SCREEN || !recommendedIds.has(video.videoId));
  if (!channels.length) return null;
  const card = (video: FeedVideo) => <YouTubeVideoCard key={video.videoId} video={video} channelTitle={video.channelTitle}
    progress={progress[video.videoId]} onPlay={() => onLaunch(feedVideoLaunchItem(channels, video, now))} />;
  return <>
    <section className="yt-shelf" aria-label="Channels">
      <h2>Channels</h2>
      <div className="yt-channel-scroll">
        {channels.map(item => <button type="button" key={item.id} className="app-icon yt-channel"
          aria-label={`Open ${item.title}`} data-content-id={item.id} onClick={() => onLaunch(item)}>
          <span className="yt-channel-avatar">
            <ArtImage src={item.iconUrl ?? ""} className="size-full object-cover" onPermanentFailure={() => onArtFailure?.(item)}
              fallback={<LetterAvatar label={item.title} className="size-full text-3xl" />} />
          </span>
          <span className="app-icon-label">{item.title}</span>
        </button>)}
      </div>
    </section>
    {recommended.length > 0 && <section className="yt-shelf" aria-label="Recommended">
      <h2>Recommended</h2>
      <div className="yt-video-scroll">{recommended.map(card)}</div>
    </section>}
    <section className="yt-shelf" aria-label="Videos">
      <h2>Videos</h2>
      {loading ? <YouTubeVideoPlaceholders /> : <div className="yt-video-scroll">
        {videos.map(card)}
      </div>}
    </section>
  </>;
}
