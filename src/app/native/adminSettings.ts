import { normalizeTabletPreferences, type TabletPreferences } from "./tabletAppearance";

const KEY = "openpanel.adminSettings.v1";

export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 8;
export const RECOMMEND_AFTER_CHOICES = [0, 3, 5, 10] as const;
export const DEFAULT_RECOMMEND_AFTER = 5;

export interface AdminSettings extends TabletPreferences {
  hiddenAppIds: string[];
  inactivityTimeoutMinutes: number;
  allowSameChannelRecommendations: boolean;
  recommendAfter: number;
  autoplayNext: boolean;
  manageNotifications: boolean;
  libraryEnabled: boolean;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const defaultStorage = (): StorageLike | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

export const normalizeInactivityTimeoutMinutes = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
  return Math.min(60, Math.max(1, Math.round(numeric)));
};

const normalize = (value: Partial<AdminSettings> | null | undefined): AdminSettings => ({
  ...normalizeTabletPreferences(value),
  hiddenAppIds: Array.from(
    new Set(
      Array.isArray(value?.hiddenAppIds)
        ? value.hiddenAppIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [],
    ),
  ),
  inactivityTimeoutMinutes: normalizeInactivityTimeoutMinutes(value?.inactivityTimeoutMinutes),
  allowSameChannelRecommendations:
    typeof value?.allowSameChannelRecommendations === "boolean"
      ? value.allowSameChannelRecommendations
      : true,
  recommendAfter: RECOMMEND_AFTER_CHOICES.find(choice => choice === value?.recommendAfter) ?? DEFAULT_RECOMMEND_AFTER,
  autoplayNext: value?.autoplayNext === true,
  manageNotifications:
    typeof value?.manageNotifications === "boolean" ? value.manageNotifications : true,
  libraryEnabled:
    typeof value?.libraryEnabled === "boolean" ? value.libraryEnabled : false,
});

export function loadAdminSettings(storage: StorageLike | null = defaultStorage()): AdminSettings {
  if (!storage) return normalize(null);
  try {
    const raw = storage.getItem(KEY);
    return normalize(raw ? (JSON.parse(raw) as Partial<AdminSettings>) : null);
  } catch {
    return normalize(null);
  }
}

export function saveAdminSettings(
  settings: AdminSettings,
  storage: StorageLike | null = defaultStorage(),
): AdminSettings {
  const normalized = normalize(settings);
  if (storage) {
    try {
      storage.setItem(KEY, JSON.stringify(normalized));
    } catch {
      // The in-memory state remains usable when persistent storage is unavailable.
    }
  }
  return normalized;
}
