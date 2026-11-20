import type { YouTubeChannelVideoResult } from "../native/SystemBridge";
import type { YouTubeProgress } from "../native/youtubeProgress";
import { ArtImage, LetterAvatar } from "./ArtImage";

export function durationLabel(seconds: number): string {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
    : `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function YouTubeVideoCard({ video, channelTitle, progress, onPlay }: {
  video: YouTubeChannelVideoResult;
  channelTitle: string;
  progress?: YouTubeProgress;
  onPlay: () => void;
}) {
  const duration = video.duration ?? progress?.duration;
  return (
    <button type="button" className="yt-video-card" aria-label={`Play ${video.title}`} onClick={onPlay}>
      <span className="yt-video-art">
        <ArtImage src={video.thumbnailUrl} className="size-full object-cover"
          fallback={<LetterAvatar label={video.title} className="size-full text-3xl" />} />
        {duration !== undefined && duration > 0 && <span className="yt-duration">{durationLabel(duration)}</span>}
        {progress && progress.duration > 0 && progress.position > 0 && (
          <span className="yt-progress" style={{ width: `${Math.min(100, progress.position / progress.duration * 100)}%` }} />
        )}
      </span>
      <span className="yt-video-title">{video.title}</span>
      <span className="yt-video-channel">{channelTitle}</span>
    </button>
  );
}

export function YouTubeVideoPlaceholders() {
  return <div className="yt-video-loading" role="status" aria-label="Loading videos">
    {Array.from({ length: 4 }, (_, index) => <div key={index} className="yt-video-placeholder">
      <div className="yt-video-art" /><div className="yt-placeholder-title" /><div className="yt-placeholder-channel" />
    </div>)}
  </div>;
}
