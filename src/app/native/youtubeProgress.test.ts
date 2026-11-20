import { afterEach, describe, expect, it, vi } from "vitest";
import { getYouTubeProgress, saveYouTubeProgress } from "./youtubeProgress";

afterEach(() => vi.unstubAllGlobals());
describe("YouTube progress", () => {
  it("persists valid progress, clamps position and rejects invalid playback samples", () => {
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value) });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    const entry = { videoId: "00000000001", position: 101, duration: 100, updatedAt: 1 };
    saveYouTubeProgress(entry);
    expect(getYouTubeProgress()[entry.videoId].position).toBe(100);
    saveYouTubeProgress({ ...entry, position: NaN });
    saveYouTubeProgress({ ...entry, duration: 0 });
    expect(Object.keys(getYouTubeProgress())).toEqual([entry.videoId]);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });
  it("ignores corrupt storage", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{" });
    expect(getYouTubeProgress()).toEqual({});
  });
});
