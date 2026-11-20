import type { YouTubeChannelVideoResult } from "./SystemBridge";
import type { YouTubeProgress } from "./youtubeProgress";

export interface FeedVideo extends YouTubeChannelVideoResult {
  channelId: string;
  channelTitle: string;
}

interface FeedState {
  approvedChannelIds: readonly string[];
  progress: Readonly<Record<string, YouTubeProgress>>;
}

export function publishedTime(value: string, now: number): number {
  const relative = value.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s? ago/i);
  if (relative) {
    const days: Record<string, number> = { second: 1 / 86400, minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 };
    return now - Number(relative[1]) * days[relative[2].toLowerCase()] * 86400000;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isFeedCandidate(video: FeedVideo, approved: ReadonlySet<string>): boolean {
  return approved.has(video.channelId) && /^[\w-]{11}$/.test(video.videoId)
    && !video.isShort && !(video.duration !== undefined && video.duration < 61);
}

export function orderFeed(videos: readonly FeedVideo[], state: FeedState, now: number): FeedVideo[] {
  const approved = new Set(state.approvedChannelIds);
  const score = (video: FeedVideo) => {
    const progress = state.progress[video.videoId];
    const ratio = progress && progress.duration > 0 ? progress.position / progress.duration : 0;
    const freshness = 2 ** (-Math.max(0, now - publishedTime(video.publishedAt, now)) / (14 * 86400000));
    return freshness + (ratio >= .9 ? -10 : ratio > .05 && ratio < .9 ? 2 : 0);
  };
  const compare = (a: FeedVideo, b: FeedVideo) => score(b) - score(a)
    || publishedTime(b.publishedAt, now) - publishedTime(a.publishedAt, now)
    || (a.videoId < b.videoId ? -1 : a.videoId > b.videoId ? 1 : 0);
  const sorted = videos.filter(v => isFeedCandidate(v, approved)).sort(compare);
  const seen = new Set<string>();
  const queues = new Map<string, FeedVideo[]>();
  for (const video of sorted) {
    if (seen.has(video.videoId)) continue;
    seen.add(video.videoId);
    const queue = queues.get(video.channelId) ?? [];
    queue.push(video);
    queues.set(video.channelId, queue);
  }
  const result: FeedVideo[] = [];
  // Each round starts with the highest-scoring channel head. Exhausted channels
  // leave the rotation; a sole remaining channel can finish its queue.
  while (queues.size) {
    const round = [...queues.entries()].sort((a, b) => compare(a[1][0], b[1][0]));
    for (const [channel, queue] of round) {
      result.push(queue.shift()!);
      if (!queue.length) queues.delete(channel);
    }
  }
  return result;
}
