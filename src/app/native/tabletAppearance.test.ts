import { describe, expect, it } from "vitest";
import { defaultTabletPreferences, normalizeTabletPreferences, pictureWallpapers, resolveWallpaper, wallpapers } from "./tabletAppearance";
import { loadAdminSettings, saveAdminSettings, type AdminSettings } from "./adminSettings";

describe("tablet preferences", () => {
  it("round trips normalized identity and appearance in the existing settings store", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); } };
    const settings: AdminSettings = { ...loadAdminSettings(storage), tabletName: "   abcdefghijklmnopqrstuvwxyz   ",
      tabletIcon: "cat", tabletColor: "#597a96", wallpaperId: "photo:one", clockStyle: "analog" as const,
      lockBackground: "wallpaper" as const };
    saveAdminSettings(settings, storage);
    expect(loadAdminSettings(storage)).toEqual({ ...settings, tabletName: "abcdefghijklmnopqrstuvwx" });
    expect(saveAdminSettings({ ...settings, tabletName: "abcdefghijklmnopqrstuvw more" }, storage).tabletName).toBe("abcdefghijklmnopqrstuvw");
    saveAdminSettings({ ...settings, tabletName: "   " }, storage);
    expect(loadAdminSettings(storage).tabletName).toBe("");
  });

  it("defaults missing or invalid preferences for existing devices", () => {
    const settings = loadAdminSettings({ getItem: () => JSON.stringify({ tabletIcon: "invalid", tabletColor: "red",
      clockStyle: "invalid", lockBackground: "invalid", tabletName: 123 }), setItem: () => {} });
    for (const key of Object.keys(defaultTabletPreferences) as (keyof typeof defaultTabletPreferences)[]) {
      expect(settings[key]).toEqual(defaultTabletPreferences[key]);
    }
  });

  it("round trips the weather place and unit and keeps weather off without a valid place", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); } };
    const place = { name: "Springfield", region: "Illinois", country: "United States", latitude: 39.8, longitude: -89.64 };
    const settings: AdminSettings = { ...loadAdminSettings(storage), weatherEnabled: true, weatherPlace: place, weatherUnit: "celsius" };
    saveAdminSettings(settings, storage);
    expect(loadAdminSettings(storage)).toEqual(settings);
    for (const weatherPlace of [null, { ...place, name: " " }, { ...place, latitude: 91 }, { ...place, longitude: "-89" }, "Springfield"]) {
      const normalized = normalizeTabletPreferences({ weatherEnabled: true, weatherPlace } as never);
      expect(normalized.weatherPlace).toBeNull(); expect(normalized.weatherEnabled).toBe(false);
    }
    expect(normalizeTabletPreferences({}).lockScreenEnabled).toBe(true);
    expect(normalizeTabletPreferences({ lockScreenEnabled: false }).lockScreenEnabled).toBe(false);
    expect(normalizeTabletPreferences({ weatherUnit: "kelvin" } as never).weatherUnit).toBe(defaultTabletPreferences.weatherUnit);
    expect(normalizeTabletPreferences({ weatherPlace: { ...place, region: 4 } } as never).weatherPlace).toEqual({ ...place, region: "" });
  });

  it("resolves built-ins and local photos and falls back for unknown or removed photos", () => {
    expect(wallpapers).toHaveLength(12);
    for (const wallpaper of wallpapers) expect(resolveWallpaper(wallpaper.id, []).id).toBe(wallpaper.id);
    expect(pictureWallpapers).toHaveLength(27);
    expect(new Set([...wallpapers, ...pictureWallpapers].map(item => item.id)).size).toBe(39);
    for (const picture of pictureWallpapers) {
      expect(picture.photoUrl).toContain(`${picture.id}.jpg`); expect(picture.thumbUrl).toContain(`${picture.id}.thumb.jpg`);
      expect(resolveWallpaper(picture.id, [])).toBe(picture);
    }
    expect(resolveWallpaper("missing", []).id).toBe(defaultTabletPreferences.wallpaperId);
    const photo = { id: "photo:one", url: "https://localhost/_capacitor_file_/photo.jpg" };
    expect(resolveWallpaper(photo.id, [photo]).photoUrl).toBe(photo.url);
    expect(resolveWallpaper(photo.id, []).id).toBe(defaultTabletPreferences.wallpaperId);
  });
});
