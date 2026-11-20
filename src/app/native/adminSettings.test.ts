import { describe, expect, it } from "vitest";
import { defaultTabletPreferences } from "./tabletAppearance";
import {
  DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
  loadAdminSettings,
  saveAdminSettings,
} from "./adminSettings";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("admin settings", () => {
  it("persists hidden apps and the screen-saver timeout", () => {
    const storage = new MemoryStorage();
    saveAdminSettings(
      {
        ...defaultTabletPreferences,
        hiddenAppIds: ["com.example.game"],
        inactivityTimeoutMinutes: 12,
        allowSameChannelRecommendations: false,
        recommendAfter: 10,
        autoplayNext: true,
        manageNotifications: false,
        libraryEnabled: true,
      },
      storage,
    );

    expect(loadAdminSettings(storage)).toEqual({
      ...defaultTabletPreferences,
      hiddenAppIds: ["com.example.game"],
      inactivityTimeoutMinutes: 12,
      allowSameChannelRecommendations: false,
      recommendAfter: 10,
      autoplayNext: true,
      manageNotifications: false,
      libraryEnabled: true,
    });
  });

  it("sanitizes corrupt or out-of-range stored values", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "openpanel.adminSettings.v1",
      JSON.stringify({ hiddenAppIds: ["ok", "ok", 42], inactivityTimeoutMinutes: 999 }),
    );

    expect(loadAdminSettings(storage)).toEqual({
      ...defaultTabletPreferences,
      hiddenAppIds: ["ok"],
      inactivityTimeoutMinutes: 60,
      allowSameChannelRecommendations: true,
      recommendAfter: 5,
      autoplayNext: false,
      manageNotifications: true,
      libraryEnabled: false,
    });
  });

  it("keeps Off and the offered thresholds but rejects other recommendation values", () => {
    for (const [stored, expected] of [[0, 0], [3, 3], [7, 5], ["3", 5]] as const) {
      const storage = new MemoryStorage();
      storage.setItem("openpanel.adminSettings.v1", JSON.stringify({ recommendAfter: stored }));
      expect(loadAdminSettings(storage).recommendAfter).toBe(expected);
    }
  });

  it("falls back safely when no settings exist", () => {
    expect(loadAdminSettings(new MemoryStorage())).toEqual({
      ...defaultTabletPreferences,
      hiddenAppIds: [],
      inactivityTimeoutMinutes: DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
      allowSameChannelRecommendations: true,
      recommendAfter: 5,
      autoplayNext: false,
      manageNotifications: true,
      libraryEnabled: false,
    });
  });
});
