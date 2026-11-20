export interface WatchEntry {
  videoId: string;
  channelId: string;
  title: string;
  duration: number;
  ratio: number;
  completed: boolean;
  plays: number;
  firstWatchedAt: number;
  lastWatchedAt: number;
}

export interface WatchSample {
  videoId: string;
  channelId: string;
  title: string;
  duration: number;
  position: number;
}

const KEY = "openpanel.youtube.history.v1";
const MAX_ENTRIES = 500;
const COMPLETED_RATIO = .9;

const valid = (entry: unknown): entry is WatchEntry => {
  const e = entry as WatchEntry | null;
  return !!e && typeof e === "object" && /^[\w-]{11}$/.test(e.videoId) && typeof e.channelId === "string"
    && typeof e.title === "string" && Number.isFinite(e.duration) && e.duration > 0
    && Number.isFinite(e.ratio) && e.ratio >= 0 && e.ratio <= 1 && typeof e.completed === "boolean"
    && Number.isInteger(e.plays) && e.plays >= 0 && Number.isFinite(e.firstWatchedAt) && Number.isFinite(e.lastWatchedAt);
};

export function getWatchHistory(): WatchEntry[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(entries) ? entries.filter(valid) : [];
  } catch {
    return [];
  }
}

export const watchedCount = (history: readonly WatchEntry[]): number => history.filter(entry => entry.plays > 0).length;

/** A play counts once it passes 30 s or 20% of the video, whichever is smaller. */
export const isPlay = (position: number, duration: number): boolean => position >= Math.min(30, duration * .2);

/** `counted` holds the videos already counted as a play in this player session. */
export function recordWatch(sample: WatchSample, now: number, counted: Set<string>): void {
  if (!/^[\w-]{11}$/.test(sample.videoId) || !Number.isFinite(sample.duration) || sample.duration <= 0
    || !Number.isFinite(sample.position) || sample.position <= 0) return;
  const ratio = Math.min(1, sample.position / sample.duration);
  const newPlay = isPlay(sample.position, sample.duration) && !counted.has(sample.videoId);
  const history = getWatchHistory();
  const previous = history.find(entry => entry.videoId === sample.videoId);
  const furthest = Math.max(ratio, previous?.ratio ?? 0);
  const entry: WatchEntry = {
    videoId: sample.videoId, channelId: sample.channelId || previous?.channelId || "",
    title: sample.title, duration: sample.duration, ratio: furthest, completed: furthest >= COMPLETED_RATIO,
    plays: (previous?.plays ?? 0) + (newPlay ? 1 : 0),
    firstWatchedAt: previous?.firstWatchedAt ?? now, lastWatchedAt: now,
  };
  if (newPlay) counted.add(sample.videoId);
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...history.filter(item => item !== previous)]
      .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt).slice(0, MAX_ENTRIES)));
    window.dispatchEvent(new Event("youtube-history"));
  } catch (error) {
    console.warn("Could not save YouTube watch history", error);
  }
}

export function clearWatchHistory(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("youtube-history"));
  } catch (error) {
    console.warn("Could not clear YouTube watch history", error);
  }
}
