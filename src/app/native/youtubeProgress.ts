export interface YouTubeProgress {
  videoId: string;
  position: number;
  duration: number;
  updatedAt: number;
}

const KEY = "openpanel.youtube.progress.v1";

export function getYouTubeProgress(): Record<string, YouTubeProgress> {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(entries)) return {};
    return Object.fromEntries(entries.filter((entry): entry is YouTubeProgress =>
      entry && /^[\w-]{11}$/.test(entry.videoId) && Number.isFinite(entry.position)
      && entry.position >= 0 && Number.isFinite(entry.duration) && entry.duration > 0
      && Number.isFinite(entry.updatedAt)).map(entry => [entry.videoId, entry]));
  } catch {
    return {};
  }
}

export function saveYouTubeProgress(entry: YouTubeProgress): void {
  if (!/^[\w-]{11}$/.test(entry.videoId) || !Number.isFinite(entry.position) || entry.position < 0
    || !Number.isFinite(entry.duration) || entry.duration <= 0 || !Number.isFinite(entry.updatedAt)) return;
  const progress = getYouTubeProgress();
  progress[entry.videoId] = { ...entry, position: Math.min(entry.position, entry.duration) };
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.values(progress).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 500)));
    window.dispatchEvent(new Event("youtube-progress"));
  } catch (error) {
    console.warn("Could not save YouTube progress", error);
  }
}
