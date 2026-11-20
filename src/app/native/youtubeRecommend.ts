import { isFeedCandidate, publishedTime, type FeedVideo } from "./youtubeFeed";
import { watchedCount, type WatchEntry } from "./youtubeHistory";

export const RECOMMEND_WEIGHTS = { channel: 3, topic: 1.5, length: 1, freshness: 1.5, resume: 10 } as const;
const DAY = 86400000;
const AFFINITY_HALF_LIFE_DAYS = 21;
const FRESHNESS_HALF_LIFE_DAYS = 14;
const COMPLETED_BONUS = .5;
const ABANDONED_RATIO = .25;
const MAX_IN_A_ROW = 2;
const EXPLORE_EVERY = 5;
const STOP_WORDS = new Set(["this", "that", "with", "from", "your", "what", "when", "have", "will", "into", "about", "their", "they", "them", "then", "than", "video", "videos", "official", "full", "episode"]);

export interface RecommendOptions {
  threshold: number;
  limit?: number;
}

const words = (title: string): Set<string> =>
  new Set((title.toLowerCase().match(/\p{L}{4,}/gu) ?? []).filter(word => !STOP_WORDS.has(word)));

const abandoned = (entry: WatchEntry) => !entry.completed && entry.plays > 0 && entry.ratio < ABANDONED_RATIO;

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

export function recommend(candidates: readonly FeedVideo[], history: readonly WatchEntry[],
  approvedChannelIds: readonly string[], now: number, options: RecommendOptions): FeedVideo[] {
  if (watchedCount(history) < options.threshold) return [];
  const approved = new Set(approvedChannelIds);
  const byId = new Map(history.map(entry => [entry.videoId, entry]));
  const decay = (entry: WatchEntry, halfLifeDays: number) =>
    2 ** (-Math.max(0, now - entry.lastWatchedAt) / (halfLifeDays * DAY));

  const channelRaw = new Map<string, number>();
  const channelSeen = new Map<string, number>();
  const topic = new Map<string, number>();
  for (const entry of history) {
    const weight = decay(entry, AFFINITY_HALF_LIFE_DAYS);
    if (approved.has(entry.channelId)) {
      channelRaw.set(entry.channelId, (channelRaw.get(entry.channelId) ?? 0) + weight * (entry.ratio + (entry.completed ? COMPLETED_BONUS : 0)));
      if (entry.plays > 0) channelSeen.set(entry.channelId, (channelSeen.get(entry.channelId) ?? 0) + 1);
    }
    const sign = entry.completed ? 1 : abandoned(entry) ? -1 : 0;
    if (sign) for (const word of words(entry.title)) topic.set(word, (topic.get(word) ?? 0) + sign * weight);
  }
  const maxChannel = Math.max(0, ...channelRaw.values());
  const completedDurations = history.filter(entry => entry.completed).map(entry => entry.duration).sort((a, b) => a - b);
  const median = completedDurations.length
    ? (completedDurations[(completedDurations.length - 1) >> 1] + completedDurations[completedDurations.length >> 1]) / 2 : 0;

  const seen = new Set<string>();
  const day = Math.floor(now / DAY);
  const ranked = candidates.filter(video => {
    if (!isFeedCandidate(video, approved) || seen.has(video.videoId)) return false;
    seen.add(video.videoId);
    const entry = byId.get(video.videoId);
    return !entry?.completed && !(entry && entry.plays >= 2 && entry.ratio < ABANDONED_RATIO);
  }).map(video => {
    const ratio = byId.get(video.videoId)?.ratio ?? 0;
    const titleWords = [...words(video.title)];
    const topicScore = titleWords.length
      ? Math.max(-1, Math.min(1, titleWords.reduce((sum, word) => sum + (topic.get(word) ?? 0), 0) / titleWords.length)) : 0;
    const lengthScore = !median || !video.duration ? .5 : Math.max(0, Math.min(1, 2 - Math.abs(Math.log2(video.duration / median))));
    const age = Math.max(0, now - publishedTime(video.publishedAt, now));
    const score = RECOMMEND_WEIGHTS.channel * (maxChannel ? (channelRaw.get(video.channelId) ?? 0) / maxChannel : 0)
      + RECOMMEND_WEIGHTS.topic * topicScore + RECOMMEND_WEIGHTS.length * lengthScore
      + RECOMMEND_WEIGHTS.freshness * 2 ** (-age / (FRESHNESS_HALF_LIFE_DAYS * DAY))
      + (ratio > .05 && ratio < .9 ? RECOMMEND_WEIGHTS.resume : 0);
    return { video, score, tie: hash(`${day}:${video.videoId}`) };
  }).sort((a, b) => b.score - a.score || a.tie - b.tie || (a.video.videoId < b.video.videoId ? -1 : 1));

  const result: FeedVideo[] = [];
  const limit = options.limit ?? 20;
  const runBlocked = (video: FeedVideo) => result.length >= MAX_IN_A_ROW
    && result.slice(-MAX_IN_A_ROW).every(picked => picked.channelId === video.channelId);
  while (result.length < limit && ranked.length) {
    let pool = ranked;
    if ((result.length + 1) % EXPLORE_EVERY === 0) {
      const fewest = Math.min(...ranked.map(item => channelSeen.get(item.video.channelId) ?? 0));
      const exploring = ranked.filter(item => (channelSeen.get(item.video.channelId) ?? 0) === fewest);
      if (exploring.some(item => !runBlocked(item.video))) pool = exploring;
    }
    // The run limit only applies while another channel still has a candidate.
    const pick = pool.find(item => !runBlocked(item.video)) ?? ranked[0];
    result.push(pick.video);
    ranked.splice(ranked.indexOf(pick), 1);
  }
  return result;
}
