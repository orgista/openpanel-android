import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties, type SetStateAction } from "react";
import { type PluginListenerHandle } from "@capacitor/core";
import { Gamepad2, Headphones } from "lucide-react";
import { StatusBar } from "./components/StatusBar";
import { SettingsModal } from "./components/SettingsModal";
import { AdminPanel } from "./components/AdminPanel";
import { TouchSettingsSheet, type TouchSettingsSection } from "./components/TouchSettingsSheet";
import { TimeLimitsPanel } from "./components/TimeLimitsPanel";
import { AppearancePanel, ThisTabletPanel } from "./components/TabletSettings";
import { WeatherPanel } from "./components/WeatherSettings";
import { useWeather } from "./native/useWeather";
import { TabletWallpaper } from "./components/TabletWallpaper";
import { TabletLockScreen } from "./components/TabletLockScreen";
import { normalizeTabletPreferences, resolveWallpaper, defaultTabletPreferences, type TabletPreferences } from "./native/tabletAppearance";
import { useTabletPhotos } from "./native/useTabletPhotos";
import { AdminAuth } from "./components/AdminAuth";
import { useMinuteClock } from "./native/useMinuteClock";
import { useManagedSettings } from "./native/useManagedSettings";
import { managedTabletPreferences, preserveLocalManagedValues, type ManagedLink } from "./native/managedSettings";
import { useTimeLimits } from "./native/useTimeLimits";
import { availableLabel } from "./native/timeLimits";
import { HomeScreen } from "./components/HomeScreen";
import { YouTubePlayer } from "./components/YouTubePlayer";
import { YouTubeChannelBrowser } from "./components/YouTubeChannelBrowser";
import { ModeSetup } from "./components/ModeSetup";
import { StandaloneOnboarding, PinStep } from "./components/StandaloneOnboarding";
import {
  addYouTubeItem,
  channelIdForYouTubeItem,
  channelMetadataNeedsRefresh,
  compactChannelArtUrl,
  displayTitleForYouTubeItem,
  getYouTubeItems,
  initializeApprovedYouTubeItems,
  removeYouTubeItem,
  thumbnailUrl,
  type KioskYouTubeItem,
} from "./native/youtube";
import {
  getAppMode,
  setAppMode as persistAppMode,
  isAppModeConfigured,
  isStandaloneOnboarded,
  setStandaloneOnboarded,
  type AppMode,
} from "./appConfig";
import { SystemBridge, type DeviceProfile, type InstalledApp, type KioskStatus } from "./native/SystemBridge";
import type { YouTubeChannelVideoResult } from "./native/SystemBridge";
import { deriveExitKioskNotice } from "./native/exitKiosk";
import { allowedAppsForDevice } from "./native/catalog";
import { loadAdminSettings, normalizeInactivityTimeoutMinutes, saveAdminSettings } from "./native/adminSettings";
import { clearAdminConfiguration, getAdminToken, isAdminConfigured } from "./native/adminAuth";
import { installKeyboardViewportTracking } from "./native/keyboard";
import { ensureDpadFocus, installDpadNavigation } from "./native/dpadNavigation";
import { televisionCanvasScale, televisionCanvasStyle } from "./native/tvLayout";
import { recordDiagnostic } from "./native/diagnostics";
import { LibraryBridge, type LibraryPublication } from "./native/LibraryBridge";
import { LibraryCatalogBrowser } from "./components/LibraryCatalogBrowser";
import { OpenPanelBrand } from "./components/OpenPanelBrand";
import { MotionConfig } from "motion/react";

export interface ContentItem {
  id: string;
  title: string;
  imageUrl?: string;
  iconUrl?: string;
  /**
   * Wide Leanback banner art (the app's own TV lockup). Tile-only on purpose:
   * a banner is 512x288, so stretching it across the 1920px hero upscales it
   * ~6x and looks worse than the gradient treatment it replaced.
   */
  bannerUrl?: string;
  /** Adaptive icon layers (full 108dp canvas); tiles and hero use both or neither. */
  artForegroundUrl?: string;
  artBackgroundUrl?: string;
  coverUrl: string;
  description?: string;
  genre?: string;
  category: string;
  packageName?: string;
  youtubeItem?: KioskYouTubeItem;
  libraryPublication?: LibraryPublication;
  libraryAction?: "browse";
  duration?: string;
  year?: number;
  rating?: string;
  matchPct?: number;
  badge?: "new" | "top10" | "trending";
  tileType?: "portrait" | "landscape";
}

const GRADIENTS = [
  "#dc2626, #450a0a",
  "#1d4ed8, #172554",
  "#7c3aed, #3b0764",
  "#0891b2, #164e63",
  "#d97706, #78350f",
  "#059669, #064e3b",
  "#ea580c, #7c2d12",
  "#db2777, #831843",
];

function gradientFor(packageName: string): string {
  let hash = 0;
  for (let i = 0; i < packageName.length; i++) {
    hash = (hash * 31 + packageName.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * Returns `value` only once it has stopped changing for `delayMs`. The first
 * value is adopted immediately so the hero is never blank on first paint.
 */
function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  const hasSettledOnce = useRef(false);
  useEffect(() => {
    if (!hasSettledOnce.current) {
      hasSettledOnce.current = true;
      setSettled(value);
      return;
    }
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

// The background layer is WebP unless it has alpha, so sniff the base64 magic.
function imageDataUrl(base64: string): string {
  return `data:image/${base64.startsWith("iVBORw0KGgo") ? "png" : "webp"};base64,${base64}`;
}

function toContentItem(app: InstalledApp): ContentItem {
  return {
    id: app.packageName,
    title: app.label,
    packageName: app.packageName,
    // A Leanback banner is the app's own wide TV art — what the stock Google TV
    // launcher puts in its app row. Tile art only; the hero keeps the gradient
    // + icon treatment, which stays sharp at hero size.
    bannerUrl: app.banner ? `data:image/webp;base64,${app.banner}` : undefined,
    iconUrl: app.icon ? `data:image/png;base64,${app.icon}` : undefined,
    artForegroundUrl: app.iconForeground ? `data:image/png;base64,${app.iconForeground}` : undefined,
    artBackgroundUrl: app.iconBackground ? imageDataUrl(app.iconBackground) : undefined,
    coverUrl: gradientFor(app.packageName),
    category: "apps",
    tileType: "landscape",
  };
}

function toYouTubeContentItem(item: KioskYouTubeItem): ContentItem {
  const displayTitle = displayTitleForYouTubeItem(item);
  return {
    id: `yt:${item.id}`,
    title: displayTitle,
    youtubeItem: item,
    imageUrl: item.kind === "video" ? thumbnailUrl(item.sourceId) : undefined,
    iconUrl: item.kind === "channel" ? item.thumbnailUrl : undefined,
    coverUrl: gradientFor(item.sourceId),
    genre: item.kind === "channel" ? "YouTube Channel" : item.kind === "playlist" ? "YouTube Playlist" : "YouTube Video",
    category: "youtube",
    tileType: "landscape",
  };
}

function toLibraryContentItem(publication: LibraryPublication): ContentItem {
  const audio = publication.format === "audiobook" || publication.format === "audio";
  return {
    id: `library:${publication.id}`,
    title: publication.title,
    libraryPublication: publication,
    imageUrl: publication.coverUrl ?? undefined,
    coverUrl: audio ? "#7c3aed, #2e1065" : "#2563eb, #172554",
    description: `${publication.authors.join(", ") || "Unknown author"}${publication.progression ? ` · ${Math.round(publication.progression * 100)}% complete` : ""}`,
    genre: audio ? "Audiobook" : publication.format.toUpperCase(),
    category: "library",
    tileType: "portrait",
  };
}

const browseLibraryItem: ContentItem = {
  id: "library:browse",
  title: "Browse Library",
  libraryAction: "browse",
  coverUrl: "#0f766e, #042f2e",
  description: "Save books and audiobooks from approved catalogs for offline reading.",
  genre: "Library Catalogs",
  category: "library",
  tileType: "portrait",
};

function restoreElementFocus(element: HTMLElement | null): void {
  window.setTimeout(() => {
    if (!element?.isConnected) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, 0);
}

function restoreContentTileFocus(contentId: string): void {
  window.setTimeout(() => {
    const tile = Array.from(document.querySelectorAll<HTMLElement>("[data-content-id]"))
      .find((element) => element.dataset.contentId === contentId);
    restoreElementFocus(tile ?? null);
  }, 0);
}

export default function App() {
  const [initialAdminSettings] = useState(loadAdminSettings);
  const [localTabletPreferences, setLocalTabletPreferences] = useState(() => normalizeTabletPreferences(initialAdminSettings));
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [apps, setApps] = useState<ContentItem[]>([]);
  const [hiddenApps, setHiddenApps] = useState<Set<string>>(
    () => new Set(initialAdminSettings.hiddenAppIds),
  );
  const [featuredItem, setFeaturedItem] = useState<ContentItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"wifi" | "bluetooth">("wifi");
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [battery, setBattery] = useState({ level: -1, isCharging: false });
  const [wifi, setWifi] = useState({ connected: false, ssid: undefined as string | undefined });
  const [btConnected, setBtConnected] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [isHomeScrolled, setIsHomeScrolled] = useState(false);

  useEffect(() => {
    const updateScrolled = () => setIsHomeScrolled(window.scrollY > 24);
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);
  const [sleepTime, setSleepTime] = useState(new Date());
  const [inactivityTimeout, setInactivityTimeout] = useState(initialAdminSettings.inactivityTimeoutMinutes);
  const [allowSameChannelRecommendations, setAllowSameChannelRecommendations] = useState(
    initialAdminSettings.allowSameChannelRecommendations,
  );
  const [recommendAfter, setRecommendAfter] = useState(initialAdminSettings.recommendAfter);
  const [autoplayNext, setAutoplayNext] = useState(initialAdminSettings.autoplayNext);
  const [manageNotifications, setManageNotifications] = useState(
    initialAdminSettings.manageNotifications,
  );
  const [libraryEnabled, setLibraryEnabled] = useState(initialAdminSettings.libraryEnabled);
  const lastActivityRef = useRef(Date.now());
  const launchingRef = useRef(false);
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null);
  const adminReturnFocusRef = useRef<HTMLElement | null>(null);

  const [appMode, setAppMode] = useState<AppMode>(getAppMode());
  const [managementResolved, setManagementResolved] = useState(false);
  // Decided after first-run detection (see effect below); a stored choice wins.
  const [needsModeSetup, setNeedsModeSetup] = useState(false);
  // Standalone first-run only: gate the panel behind the onboarding wizard until
  // the operator has set a PIN, granted permissions, and picked apps.
  const [needsOnboarding, setNeedsOnboarding] = useState(
    () => getAppMode() === "standalone" && !isStandaloneOnboarded(),
  );
  // Companion devices skip the standalone onboarding wizard (ArborXR owns
  // lockdown), so nothing there forces an admin PIN. Track whether a local admin
  // credential exists; when it doesn't on a companion device we force PIN
  // creation before the kiosk is usable (see needsCompanionAdminSetup below), so
  // a child can't be the first to create one from Settings -> Admin Mode.
  const [adminConfigured, setAdminConfigured] = useState(() => isAdminConfigured());
  const [youtubeItems, setYouTubeItems] = useState<KioskYouTubeItem[]>(initializeApprovedYouTubeItems());
  const [browsingYouTubeChannel, setBrowsingYouTubeChannel] = useState<KioskYouTubeItem | null>(null);
  const [playingYouTube, setPlayingYouTube] = useState<KioskYouTubeItem | null>(null);
  const [libraryPublications, setLibraryPublications] = useState<LibraryPublication[]>([]);
  const [isLibraryBrowserOpen, setIsLibraryBrowserOpen] = useState(false);
  const [kioskStatus, setKioskStatus] = useState<KioskStatus | null>(null);
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile | null>(null);
  const touchSettings = deviceProfile?.touchUi === true && !deviceProfile.remoteUi;
  const managed = useManagedSettings(touchSettings);
  const [localLinks, setLocalLinks] = useState<ManagedLink[]>([]);
  useEffect(() => {
    if (!touchSettings) return;
    void SystemBridge.getLocalLinks().then(result => setLocalLinks(result.links), () => recordDiagnostic("warning", "Links unavailable"));
  }, [touchSettings]);
  const saveLocalLinks = useCallback(async (links: ManagedLink[]) => {
    try {
      setLocalLinks((await SystemBridge.setLocalLinks({ links, adminToken: getAdminToken() ?? undefined })).links);
      return true;
    } catch { return false; }
  }, []);
  const tabletPreferences = managedTabletPreferences(localTabletPreferences, managed.settings?.tablet);
  const tabletLockScreenOff = touchSettings && !tabletPreferences.lockScreenEnabled;
  const setTabletPreferences = useCallback((next: SetStateAction<TabletPreferences>) => {
    setLocalTabletPreferences(current => preserveLocalManagedValues(current,
      typeof next === "function" ? next(current) : next, managed.settings?.tablet));
  }, [managed.settings?.tablet]);
  const lockTime = useMinuteClock(isSleeping && touchSettings);
  const weather = useWeather(touchSettings && tabletPreferences.weatherEnabled, tabletPreferences.weatherPlace, tabletPreferences.weatherUnit);
  const tabletPhotos = useTabletPhotos(touchSettings);
  const tabletWallpaper = resolveWallpaper(tabletPreferences.wallpaperId, tabletPhotos.photos);
  useEffect(() => {
    if (!touchSettings || !tabletPhotos.ready) return;
    if (tabletPreferences.wallpaperId !== tabletWallpaper.id) {
      setTabletPreferences(current => ({ ...current, wallpaperId: defaultTabletPreferences.wallpaperId }));
    }
  }, [touchSettings, tabletPhotos.ready, tabletPreferences.wallpaperId, tabletWallpaper.id]);
  const [touchSection, setTouchSection] = useState<TouchSettingsSection>('wifi');
  const timeLimits = useTimeLimits(touchSettings, managed.settings?.timeLimits);
  const timeLocked = touchSettings && timeLimits.status.reason !== null;
  const [timeAuth, setTimeAuth] = useState(false);
  const [timeOverride, setTimeOverride] = useState(false);
  useEffect(() => {
    if (timeLocked) {
      setPlayingYouTube(null);
      setBrowsingYouTubeChannel(null);
      setIsLibraryBrowserOpen(false);
      setIsSleeping(false);
    } else { setTimeAuth(false); setTimeOverride(false); }
  }, [timeLocked]);

  const isStandalone = appMode === "standalone";
  // Force first-time admin PIN creation on companion devices before the panel is
  // reachable. Standalone's onboarding wizard already guarantees a PIN, so this
  // gate only applies to companion mode; it also re-triggers if the admin
  // credential is later cleared (e.g. Reset Admin) while in companion mode.
  const needsCompanionAdminSetup =
    appMode === "companion" && managementResolved && !needsModeSetup && !adminConfigured;
  const panelReady = managementResolved && !needsModeSetup && !needsOnboarding && !needsCompanionAdminSetup;
  const legacyTelevision = deviceProfile?.isTelevision === true
    && (deviceProfile.sdk ?? 999) <= 28;
  const libraryAvailable = deviceProfile !== null && deviceProfile.isTelevision !== true;
  const televisionScale = televisionCanvasScale(
    deviceProfile?.isTelevision === true,
    typeof window === "undefined" ? 1600 : window.innerWidth,
  );

  useEffect(() => installKeyboardViewportTracking(), []);
  useEffect(
    () => installDpadNavigation(
      !!deviceProfile?.remoteUi,
      deviceProfile?.isTelevision === true && (deviceProfile.sdk ?? 999) <= 28,
    ),
    [deviceProfile?.isTelevision, deviceProfile?.remoteUi, deviceProfile?.sdk],
  );

  // Watchdog. The foreground-return hook covers the common case, but the device
  // bug log also showed focus landing on <body> straight after cold start and
  // after a modal closed. On a remote-only device that state is indistinguishable
  // from a broken remote, so poll cheaply and put focus back wherever it is lost.
  // hasLostDpadFocus() is false whenever any real control (including a text
  // field) holds focus, so this never steals focus from the user.
  useEffect(() => {
    if (!deviceProfile?.remoteUi) return;
    const timer = window.setInterval(() => ensureDpadFocus("watchdog"), 1500);
    return () => window.clearInterval(timer);
  }, [deviceProfile?.remoteUi]);

  const chooseAppMode = useCallback((mode: AppMode) => {
    // Persist even when the choice matches the in-memory default. Previously,
    // choosing companion mode could appear to work but prompt again next boot.
    persistAppMode(mode);
    setAppMode(mode);
    setNeedsModeSetup(false);
    setManagementResolved(true);
    // Fresh standalone setups run the onboarding wizard before the panel.
    setNeedsOnboarding(mode === "standalone" && !isStandaloneOnboarded());
  }, []);

  // Onboarding's app picker reports the apps the operator left unchecked; hide
  // exactly those. Everything else (including apps installed later) shows by
  // default and stays fully manageable from the Admin Panel's Applications tab.
  const finishOnboarding = useCallback((hiddenPackages: string[]) => {
    setHiddenApps(new Set(hiddenPackages));
    // Optional setup can add approved YouTube channels after this component's
    // initial state was created. Refresh immediately so the new tile appears
    // on the launcher without requiring an app restart.
    setYouTubeItems(getYouTubeItems());
    if (libraryAvailable) {
      // The library row is off by default; anything added during setup turns it on.
      void Promise.all([LibraryBridge.listPublications(), LibraryBridge.listCatalogs()])
        .then(([{ publications }, { catalogs }]) => {
          setLibraryPublications(publications);
          if (publications.length > 0 || catalogs.length > 0) setLibraryEnabled(true);
        })
        .catch((error) => console.error("Failed to refresh onboarding library", error));
    } else {
      setLibraryPublications([]);
    }
    setStandaloneOnboarded(true);
    setNeedsOnboarding(false);
  }, [libraryAvailable]);

  useEffect(() => {
    // These two effects run on every mount/mode change, not just from an
    // interactive admin action, so they must carry the admin token themselves
    // (item 3) rather than relying on the current isAdmin UI-unlock state. The
    // token is just the stored PIN verifier — reading it needs no active admin
    // session, only that a PIN exists (see adminAuth.getAdminToken()).
    SystemBridge.setManagementMode({ mode: appMode, adminToken: getAdminToken() ?? undefined }).catch((e) => {
      console.error("Failed to sync management mode", e);
    });
  }, [appMode]);

  useEffect(() => {
    SystemBridge.setNotificationManagement({
      enabled: manageNotifications,
      adminToken: getAdminToken() ?? undefined,
    })
      .then((result) => recordDiagnostic("info", "Notification policy synced", {
        enabled: manageNotifications,
        available: result.available,
        changed: result.changed ?? 0,
      }))
      .catch((error) => console.error("Failed to sync notification policy", error));
  }, [manageNotifications]);

  useEffect(() => {
    SystemBridge.getDeviceProfile()
      .then((profile) => {
        setDeviceProfile(profile);
        recordDiagnostic("info", "Device profile detected", { ...profile, named: initialAdminSettings.tabletName.length > 0 });
      })
      .catch((error) => console.error("Failed to detect device capabilities", error));
  }, []);

  const refreshKiosk = useCallback(async () => {
    try { setKioskStatus(await SystemBridge.getKioskStatus()); } catch (e) { console.error("Failed to read kiosk status", e); }
  }, []);

  const youtubeContentItems = useMemo(
    () => [...(managed.settings?.youtubeChannels === undefined ? youtubeItems : [...youtubeItems.filter(item => item.kind !== "channel"), ...managed.channels])]
      .sort((a, b) => b.addedAt - a.addedAt)
      .map(toYouTubeContentItem),
    [youtubeItems, managed.settings?.youtubeChannels, managed.channels],
  );
  const libraryContentItems = useMemo(
    () => [
      browseLibraryItem,
      ...[...libraryPublications]
        .sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt))
        .map(toLibraryContentItem),
    ],
    [libraryPublications],
  );

  const loadLibrary = useCallback(async () => {
    if (!libraryAvailable) {
      setLibraryPublications([]);
      return;
    }
    try {
      const { publications } = await LibraryBridge.listPublications();
      setLibraryPublications(publications);
    } catch (error) {
      console.error("Failed to load books and audio", error);
    }
  }, [libraryAvailable]);

  // Channel art durability: the WebView's own image loads flake on some
  // tablets/networks (no IPv4-first DNS) and remote URLs rot, so channel art is
  // fetched through the native HTTP stack and persisted inline as a data URL.
  const inlineChannelArt = useCallback(async (artUrl: string): Promise<string | null> => {
    try {
      const { dataUrl } = await SystemBridge.fetchImageAsDataUrl({ url: compactChannelArtUrl(artUrl) });
      return dataUrl || null;
    } catch {
      return null;
    }
  }, []);

  // Migrate any channel still storing a remote art URL to inline art.
  const migratedArtRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const pending = youtubeItems.filter((item) =>
      item.kind === "channel"
      && item.thumbnailUrl
      && !item.thumbnailUrl.startsWith("data:")
      && !migratedArtRef.current.has(item.id));
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      let changed = false;
      for (const item of pending) {
        if (cancelled) return;
        migratedArtRef.current.add(item.id);
        const channelId = channelIdForYouTubeItem(item);
        if (!channelId || !item.thumbnailUrl) continue;
        // Stored URL first; if it rotted, re-resolve the channel for fresh art.
        let inline = await inlineChannelArt(item.thumbnailUrl);
        let title = item.title;
        if (!inline) {
          try {
            const { channel } = await SystemBridge.resolveYouTubeChannel({ input: channelId });
            if (channel?.thumbnailUrl) {
              inline = await inlineChannelArt(channel.thumbnailUrl);
              if (channel.title) title = channel.title;
            }
          } catch (error) {
            recordDiagnostic("warning", "Channel art repair could not resolve channel", {
              channelId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        if (!inline) {
          migratedArtRef.current.delete(item.id); // retry on a later pass
          recordDiagnostic("warning", "Channel art could not be fetched natively", { channelId });
          continue;
        }
        if (addYouTubeItem(`https://www.youtube.com/channel/${channelId}`, title, inline)) {
          recordDiagnostic("info", "Channel art stored inline", { channelId });
          changed = true;
        }
      }
      if (changed && !cancelled) setYouTubeItems(getYouTubeItems());
    })();
    return () => { cancelled = true; };
  }, [youtubeItems, inlineChannelArt]);

  // Self-healing channel art: when a channel avatar permanently fails to load
  // (stored URL rotted), re-resolve the channel and persist fresh inline art.
  const healedArtRef = useRef<Set<string>>(new Set());
  const handleYouTubeArtFailure = useCallback(async (content: ContentItem) => {
    const youtubeItem = content.youtubeItem;
    if (!youtubeItem || youtubeItem.kind !== "channel" || youtubeItem.id.startsWith("managed:")) return;
    const channelId = channelIdForYouTubeItem(youtubeItem);
    if (!channelId || healedArtRef.current.has(channelId)) return;
    healedArtRef.current.add(channelId);
    try {
      const { channel } = await SystemBridge.resolveYouTubeChannel({ input: channelId });
      if (!channel?.thumbnailUrl) return;
      const art = (await inlineChannelArt(channel.thumbnailUrl)) ?? channel.thumbnailUrl;
      if (art === youtubeItem.thumbnailUrl) return;
      if (addYouTubeItem(channel.sourceUrl, channel.title || youtubeItem.title, art)) {
        setYouTubeItems(getYouTubeItems());
      }
    } catch (error) {
      console.warn("Could not refresh saved YouTube channel art", error);
      healedArtRef.current.delete(channelId); // a later failure may retry (e.g. once online)
    }
  }, [inlineChannelArt]);

  useEffect(() => {
    const staleChannels = youtubeItems.filter(channelMetadataNeedsRefresh);
    if (staleChannels.length === 0) return;
    let cancelled = false;

    Promise.all(staleChannels.map(async (item) => {
      const channelId = channelIdForYouTubeItem(item);
      if (!channelId) return false;
      try {
        const response = await SystemBridge.getYouTubeChannelVideos({ channelId });
        const channelTitle = response.channelTitle.trim();
        if (!channelTitle || /^YouTube Channel$/i.test(channelTitle) || cancelled) {
          return false;
        }
        return addYouTubeItem(
          `https://www.youtube.com/channel/${channelId}`,
          channelTitle,
          item.thumbnailUrl,
        ) !== null;
      } catch (error) {
        console.warn("Could not refresh saved YouTube channel metadata", error);
        return false;
      }
    })).then((results) => {
      if (cancelled || !results.some(Boolean)) return;
      const refreshedItems = getYouTubeItems();
      setYouTubeItems(refreshedItems);
      setFeaturedItem((current) => {
        const youtubeItem = current?.youtubeItem;
        if (!youtubeItem) return current;
        const refreshed = refreshedItems.find((item) => item.id === youtubeItem.id);
        return refreshed ? toYouTubeContentItem(refreshed) : current;
      });
      setBrowsingYouTubeChannel((current) => {
        if (!current) return current;
        return refreshedItems.find((item) => item.id === current.id) ?? current;
      });
    });

    return () => { cancelled = true; };
  }, [youtubeItems]);

  const loadApps = useCallback(async () => {
    try {
      const [{ apps: installed }, management] = await Promise.all([
        SystemBridge.getInstalledApps({ includeIconLayers: deviceProfile?.touchUi === true }),
        appMode === "companion"
          ? SystemBridge.getKioskStatus().catch((error) => {
              console.warn("Could not verify ArborXR management while loading apps", error);
              return null;
            })
          : Promise.resolve(null),
      ]);
      if (management) setKioskStatus(management);
      const allowed = allowedAppsForDevice(
        installed,
        appMode,
        // Treat an unreadable management state as managed. The fallback must
        // only activate after Android positively reports that ArborXR is not
        // the Device Owner. Debug builds also fall back, so they can be tested
        // with ArborXR switched to the device's default home (empty allowlist).
        (management?.arborXrManaged ?? true) && deviceProfile?.debugBuild !== true,
      )
        .map(toContentItem);
      allowed.sort((a, b) => a.title.localeCompare(b.title));
      setApps(allowed);
      setAppsLoaded(true);
      // Keep the current selection across refreshes (YouTube sources aren't in the
      // installed-apps list, so they'd otherwise be deselected every poll).
      setFeaturedItem(prev => prev && (
        prev.youtubeItem || prev.libraryPublication || prev.libraryAction || allowed.some(a => a.id === prev.id)
      ) ? prev : allowed[0] ?? null);
    } catch (e) {
      console.error("Failed to load apps", e);
    }
  }, [appMode, deviceProfile?.touchUi, deviceProfile?.debugBuild]);

  // ArborXR restarts OpenPanel right after updating it, before it has
  // re-applied its app allowlist. Without this the home stays empty until the
  // 60 s poll.
  useEffect(() => {
    if (appMode !== "companion" || apps.length > 0) return;
    const timer = setInterval(loadApps, 5000);
    return () => clearInterval(timer);
  }, [appMode, apps.length, loadApps]);

  const refreshStatus = useCallback(async () => {
    try {
      const [bat, wf, bt] = await Promise.all([
        deviceProfile?.showBattery === true
          ? SystemBridge.getBatteryInfo()
          : Promise.resolve(null),
        SystemBridge.getWifiStatus(),
        SystemBridge.getBluetoothStatus(),
      ]);
      if (bat) setBattery(bat);
      setWifi({ connected: wf.connected, ssid: wf.ssid });
      setBtConnected(!!bt.enabled && !!bt.devices?.some(d => d.connected));
    } catch (e) {
      console.error("Failed to refresh status", e);
    }
  }, [deviceProfile?.showBattery]);

  const openSettings = useCallback((tab: "wifi" | "bluetooth") => {
    settingsReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    recordDiagnostic("info", "Settings opened", { tab });
    setTouchSection(tab);
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    recordDiagnostic("info", "Settings closed");
    setIsSettingsOpen(false);
    setIsAdmin(false);
    setIsAdminPanelOpen(false);
    refreshStatus();
    restoreElementFocus(settingsReturnFocusRef.current);
  }, [refreshStatus]);

  const openAdminPanel = useCallback(() => {
    adminReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    recordDiagnostic("info", "Admin Panel opened");
    setIsAdminPanelOpen(true);
    if (isStandalone) refreshKiosk();
  }, [isStandalone, refreshKiosk]);

  const closeAdminPanel = useCallback(() => {
    recordDiagnostic("info", "Admin Panel closed");
    setIsAdminPanelOpen(false);
    restoreElementFocus(adminReturnFocusRef.current);
  }, []);

  useEffect(() => {
    if (!panelReady) return;
    loadApps();
    loadLibrary();
    refreshStatus();
    const statusTimer = setInterval(
      refreshStatus,
      deviceProfile?.isTelevision === true ? 30000 : 15000,
    );
    const appsTimer = setInterval(loadApps, 60000);

    const onResume = () => {
      if (document.visibilityState === "visible") {
        recordDiagnostic("info", "OpenPanel returned to foreground");
        SystemBridge.getKioskStatus()
          .then((status) => recordDiagnostic("info", "Launcher state after foreground return", {
            managementMode: status.managementMode,
            arborXrManaged: status.arborXrManaged,
            defaultLauncher: status.defaultLauncher,
            homeControlMode: status.homeControlMode,
            lockTaskMode: status.lockTaskMode,
          }))
          .catch((error) => console.warn("Could not capture launcher return state", error));
        loadApps();
        refreshStatus();
        // Coming back from a launched app routinely leaves focus on <body>, and
        // in that state the remote looks dead: no highlight, and OK/BACK do
        // nothing because the spatial handler only recovers on arrow keys.
        // Two frames so the resumed render has committed first.
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => ensureDpadFocus("foreground-return"));
        });
      }
    };
    document.addEventListener("visibilitychange", onResume);

    // Reflect plug/unplug the instant it happens instead of waiting for the
    // 15s poll (which made the header read "charging" for a beat after the
    // charger was pulled). The poll stays as a backstop.
    let batteryListener: PluginListenerHandle | undefined;
    if (deviceProfile?.showBattery === true) {
      void SystemBridge.addListener("batteryChanged", (info) => setBattery(info))
        .then((handle) => { batteryListener = handle; });
    }

    return () => {
      clearInterval(statusTimer);
      clearInterval(appsTimer);
      document.removeEventListener("visibilitychange", onResume);
      void batteryListener?.remove();
    };
  }, [deviceProfile?.isTelevision, deviceProfile?.showBattery, loadApps, loadLibrary, panelReady, refreshStatus]);

  const handleLaunch = async (item: ContentItem) => {
    if (timeLocked) return;
    if (item.libraryAction === "browse") {
      recordDiagnostic("info", "Library catalog browser opened");
      setIsLibraryBrowserOpen(true);
      return;
    }
    if (item.libraryPublication) {
      try {
        recordDiagnostic("info", "Publication opened", {
          id: item.libraryPublication.id,
          format: item.libraryPublication.format,
        });
        await LibraryBridge.openPublication({ id: item.libraryPublication.id });
        await loadLibrary();
      } catch (error) {
        console.error("Failed to open publication", error);
      }
      return;
    }
    // Approved YouTube sources open the in-app player instead of another app.
    if (item.youtubeItem) {
      if (item.youtubeItem.kind === "channel") {
        recordDiagnostic("info", "YouTube channel browser opened", {
          channel: item.youtubeItem.title,
          sourceId: item.youtubeItem.sourceLabel,
        });
        setBrowsingYouTubeChannel(item.youtubeItem);
        setPlayingYouTube(null);
        return;
      }
      setPlayingYouTube(item.youtubeItem);
      return;
    }
    if (!item.packageName || launchingRef.current) return;
    launchingRef.current = true;
    try {
      recordDiagnostic("info", "Launching allowed application", {
        packageName: item.packageName,
        title: item.title,
      });
      await SystemBridge.launchApp({ packageName: item.packageName });
      recordDiagnostic("info", "External application launch accepted", {
        packageName: item.packageName,
        title: item.title,
      });
    } catch (e) {
      console.error("Failed to launch", item.packageName, e);
    } finally {
      setTimeout(() => { launchingRef.current = false; }, 1500);
    }
  };

  // handleLaunch closes over a lot of state, so it is a new function every
  // render. ContentTile is memo()'d, and an unstable onLaunch would defeat that
  // for every tile on screen — so hand the rows a permanently stable wrapper
  // that forwards to the current implementation through a ref.
  const handleLaunchRef = useRef(handleLaunch);
  handleLaunchRef.current = handleLaunch;
  const launchItem = useCallback((item: ContentItem) => {
    void handleLaunchRef.current(item);
  }, []);

  const youtubeArtFailureRef = useRef(handleYouTubeArtFailure);
  youtubeArtFailureRef.current = handleYouTubeArtFailure;
  const youtubeArtFailure = useCallback((item: ContentItem) => {
    void youtubeArtFailureRef.current(item);
  }, []);

  useEffect(() => {
    if (isStandalone) refreshKiosk();
  }, [isStandalone, refreshKiosk]);

  // Fire OS always uses OpenPanel's standalone Home/accessibility kiosk path.
  // Other devices retain a stored choice; on first run ArborXR ownership is
  // detected before the management prompt is shown.
  useEffect(() => {
    if (!deviceProfile) return;
    if (deviceProfile.isFireOs) {
      setNeedsModeSetup(false);
      if (appMode !== "standalone" || !isAppModeConfigured()) {
        chooseAppMode("standalone");
      } else {
        setManagementResolved(true);
      }
      return;
    }
    if (isAppModeConfigured()) {
      setManagementResolved(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const k = await SystemBridge.getKioskStatus();
        if (cancelled) return;
        if (k.arborXrManaged) { chooseAppMode("companion"); return; }
      } catch (e) {
        console.error("Management detection failed", e);
      }
      if (!cancelled) {
        setNeedsModeSetup(true);
        setManagementResolved(true);
      }
    })();
    return () => { cancelled = true; };
  }, [appMode, chooseAppMode, deviceProfile]);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    if (playingYouTube) setIsSleeping(false);
  }, [playingYouTube]);

  // Televisions are fixed, powered displays and must remain available for the
  // remote and ADB troubleshooting. Tablets retain the battery-friendly rule
  // of keeping the screen awake only during playback.
  useEffect(() => {
    const shouldKeepAwake = deviceProfile?.isTelevision === true || !!playingYouTube;
    if (!shouldKeepAwake) return;
    const syncScreenAwake = () => {
      SystemBridge.setKeepScreenOn({ enabled: document.visibilityState === "visible" })
        .catch((error) => console.error("Failed to update playback screen state", error));
    };
    syncScreenAwake();
    document.addEventListener("visibilitychange", syncScreenAwake);
    return () => {
      document.removeEventListener("visibilitychange", syncScreenAwake);
      SystemBridge.setKeepScreenOn({ enabled: false })
        .catch((error) => console.error("Failed to release playback screen state", error));
    };
  }, [deviceProfile?.isTelevision, playingYouTube]);

  // Android 9 TCL televisions need software WebView rendering during setup so
  // D-pad focus repaints remain visible. The longer launcher surface stays on
  // hardware rendering to avoid exhausting the legacy compositor's tile pool.
  useEffect(() => {
    if (deviceProfile?.isTelevision !== true) return;
    SystemBridge.setLegacyTvCompatRendering({
      enabled: needsModeSetup || needsOnboarding,
    }).catch((error) => console.error("Failed to update legacy TV rendering mode", error));
  }, [deviceProfile?.isTelevision, needsModeSetup, needsOnboarding]);

  // Sleeping ends an open admin session, so waking the tablet never lands in Admin.
  const closeSettingsOnSleepRef = useRef(() => {});
  closeSettingsOnSleepRef.current = () => { if (touchSettings && isSettingsOpen) closeSettings(); };

  useEffect(() => {
    if (deviceProfile?.isTelevision === true || timeLocked || tabletLockScreenOff) {
      setIsSleeping(false);
      return;
    }
    const handleActivity = (event: Event) => {
      if (touchSettings && event.target instanceof Element && event.target.closest(".tablet-lock-screen")) return;
      lastActivityRef.current = Date.now();
      setIsSleeping(false);
    };
    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    const check = setInterval(() => {
      if (playingYouTube) return;
      const inactive = (Date.now() - lastActivityRef.current) / 1000 / 60;
      if (inactive >= inactivityTimeout) { closeSettingsOnSleepRef.current(); setIsSleeping(true); }
    }, 30000);
    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearInterval(check);
    };
  }, [deviceProfile?.isTelevision, inactivityTimeout, playingYouTube, tabletLockScreenOff, timeLocked, touchSettings]);

  // The display going dark locks at once, so the tablet wakes to this lock screen. The listener
  // waits for the device profile: native retains a screen-off that happened before it registered,
  // and it must always consume that event so it cannot fire later when the lock screen is switched on.
  const lockOnScreenOffRef = useRef(false);
  lockOnScreenOffRef.current = touchSettings && !playingYouTube && !timeLocked && !tabletLockScreenOff;
  const profileKnown = deviceProfile != null;
  useEffect(() => {
    if (!profileKnown) return;
    let listener: PluginListenerHandle | undefined;
    let stopped = false;
    void SystemBridge.addListener("screenOff", () => {
      closeSettingsOnSleepRef.current();
      if (lockOnScreenOffRef.current) setIsSleeping(true);
    }).then((handle) => {
      if (stopped) void handle.remove(); else listener = handle;
    });
    return () => { stopped = true; void listener?.remove(); };
  }, [profileKnown]);

  const [volumeHint, setVolumeHint] = useState(false);
  useEffect(() => {
    if (!touchSettings) return;
    let listener: PluginListenerHandle | undefined;
    let stopped = false;
    void SystemBridge.addListener("volumeHint", () => setVolumeHint(true)).then((handle) => {
      if (stopped) void handle.remove(); else listener = handle;
    });
    return () => { stopped = true; void listener?.remove(); };
  }, [touchSettings]);
  useEffect(() => {
    if (!volumeHint) return;
    const timer = window.setTimeout(() => setVolumeHint(false), 6000);
    return () => window.clearTimeout(timer);
  }, [volumeHint]);

  useEffect(() => {
    if (!isSleeping) return;
    setSleepTime(new Date());
    const timer = setInterval(() => setSleepTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, [isSleeping]);

  useEffect(() => {
    saveAdminSettings({
      ...localTabletPreferences,
      hiddenAppIds: Array.from(hiddenApps),
      inactivityTimeoutMinutes: inactivityTimeout,
      allowSameChannelRecommendations,
      recommendAfter,
      autoplayNext,
      manageNotifications,
      libraryEnabled,
    });
  }, [allowSameChannelRecommendations, autoplayNext, recommendAfter, hiddenApps, inactivityTimeout, libraryEnabled, manageNotifications, localTabletPreferences]);

  const updateHiddenApps = useCallback((update: (current: Set<string>) => Set<string>) => {
    setHiddenApps((current) => update(current));
  }, []);

  const updateInactivityTimeout = useCallback((minutes: number) => {
    setInactivityTimeout(normalizeInactivityTimeoutMinutes(minutes));
    lastActivityRef.current = Date.now();
  }, []);

  const visibleApps = apps.filter(a => !hiddenApps.has(a.id));
  // The tile pop must track the D-pad instantly, but the hero underneath is by
  // far the most expensive thing on screen. Deferring only the hero's copy of
  // the selection lets React keep focus movement responsive while scrubbing a
  // row and settle the hero once the user pauses — the same feel as the stock
  // Google TV home, where the detail area trails the highlight.
  // A removed channel or publication must not linger in the hero.
  const featuredStillExists = !!featuredItem
    && (!featuredItem.youtubeItem || youtubeItems.some((item) => item.id === featuredItem.youtubeItem?.id))
    && (!featuredItem.libraryPublication
      || libraryPublications.some((publication) => publication.id === featuredItem.libraryPublication?.id));
  const featured = featuredItem
    && featuredStillExists
    && !hiddenApps.has(featuredItem.id)
    && (libraryAvailable && libraryEnabled
      || (!featuredItem.libraryPublication && !featuredItem.libraryAction))
    ? featuredItem
    : visibleApps[0]
      ?? (libraryAvailable && libraryEnabled ? libraryContentItems[0] : null)
      ?? youtubeContentItems[0]
      ?? null;
  // The stock Google TV home does not repaint its backdrop on every D-pad step:
  // the highlight moves instantly and the detail area catches up once you stop.
  // Copy that. Measured on the TCL TV, the hero is by far the most expensive
  // thing on screen (hiding it took the p95 frame from 138ms to 50ms), so not
  // touching it while the user scrubs a row is worth more than any amount of
  // micro-optimisation inside it. useDeferredValue was not enough here — React
  // still re-rendered the hero for every intermediate selection.
  const heroItem = useSettledValue(featured, deviceProfile?.remoteUi ? 220 : 0);

  return (
    <MotionConfig reducedMotion={legacyTelevision ? "always" : "user"}>
      <div
        data-dpad-scope
        data-device-type={deviceProfile?.deviceType ?? "detecting"}
        data-legacy-tv={legacyTelevision ? "true" : "false"}
        data-input-mode={deviceProfile?.remoteUi ? "remote" : deviceProfile?.touchUi ? "touch" : "detecting"}
        className="openpanel-shell size-full min-h-dvh bg-[oklch(11%_0_0)] overflow-y-auto overflow-x-hidden relative"
        style={televisionCanvasStyle(televisionScale) as CSSProperties | undefined}
      >
      {touchSettings && <TabletWallpaper wallpaper={tabletWallpaper} home />}
      {/* Sleep Screen */}
      {isSleeping && (touchSettings ? <TabletLockScreen preferences={tabletPreferences} wallpaper={tabletWallpaper} time={lockTime} weather={weather.cache}
        onWake={() => { lastActivityRef.current = Date.now(); setIsSleeping(false); }} /> : (
        <div
          className="fixed inset-0 bg-black z-[200] flex items-center justify-center cursor-pointer"
          onClick={() => { lastActivityRef.current = Date.now(); setIsSleeping(false); }}
        >
          <div className="text-center select-none">
            <div className="text-[oklch(70%_0_0)] text-5xl mb-3 tracking-tight" style={{ fontWeight: 300 }}>
              {sleepTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </div>
            <div className="text-[oklch(38%_0_0)] text-sm tracking-widest uppercase">
              {deviceProfile?.remoteUi ? "Press any button to wake" : "Tap anywhere to wake"}
            </div>
          </div>
        </div>
      ))}

      <StatusBar
        tabletPreferences={touchSettings ? tabletPreferences : undefined}
        onSettingsClick={() => openSettings("wifi")}
        onWifiClick={() => openSettings("wifi")}
        onBluetoothClick={() => openSettings("bluetooth")}
        isWifiConnected={wifi.connected}
        wifiSsid={wifi.ssid}
        isBluetoothConnected={btConnected}
        batteryLevel={battery.level}
        isCharging={battery.isCharging}
        showBattery={deviceProfile?.showBattery === true}
        isScrolled={isHomeScrolled}
      />

      {timeLocked ? <div className="time-lock-screen" data-input-mode="touch">
        {timeAuth ? <AdminAuth onAuthenticated={() => { setTimeAuth(false); setTimeOverride(true); }} onCancel={() => setTimeAuth(false)} />
          : timeOverride ? <div className="time-lock-actions">
            <h2>Time Limits</h2>
            <button onClick={() => { timeLimits.addTime(); setTimeOverride(false); }}>Add 15 minutes</button>
            <button onClick={() => { timeLimits.endToday(); setTimeOverride(false); }}>End lock for today</button>
            <button onClick={() => setTimeOverride(false)}>Cancel</button>
          </div> : <>
            <h1>{timeLimits.status.reason === 'downtime' ? 'Bedtime' : "Time’s up"}</h1>
            <p>{availableLabel(timeLimits.status.unlockAt, Date.now())}</p>
            <button onClick={() => setTimeAuth(true)}>Admin</button>
          </>}
      </div> : <>
      {touchSettings && timeLimits.banner && <div className="time-warning" role="status">5 minutes left</div>}
      <HomeScreen
        touch={deviceProfile?.touchUi === true && !deviceProfile?.remoteUi}
        remoteMode={deviceProfile?.remoteUi === true}
        apps={visibleApps}
        appsLoading={!appsLoaded}
        libraryItems={libraryAvailable && libraryEnabled ? libraryContentItems : []}
        links={managed.settings?.links ?? localLinks}
        onLink={link => { void SystemBridge.openManagedLink({ url: link.url }).catch(() => recordDiagnostic("warning", "Managed link unavailable")); }}
        youtubeItems={youtubeContentItems}
        recommendAfter={recommendAfter}
        featured={featured}
        heroItem={heroItem}
        standalone={isStandalone}
        onSelect={setFeaturedItem}
        onLaunch={launchItem}
        onHeroLaunch={handleLaunch}
        onArtFailure={youtubeArtFailure}
        weather={touchSettings && tabletPreferences.weatherPlace ? { ...weather, place: tabletPreferences.weatherPlace.name,
          paused: isSleeping || isSettingsOpen || !!playingYouTube || !!browsingYouTubeChannel || isLibraryBrowserOpen } : null}
      />

      </>}

      <TouchSettingsSheet enabled={touchSettings} isOpen={isSettingsOpen} isAdmin={isAdmin}
        section={touchSection} onSection={setTouchSection} onClose={closeSettings}
        onUnlock={() => setIsAdmin(true)} onExitAdmin={() => { setIsAdmin(false); setIsAdminPanelOpen(false); }}>
      {touchSettings && touchSection === 'appearance' && <AppearancePanel preferences={tabletPreferences}
        onChange={setTabletPreferences} photos={tabletPhotos.photos} />}
      {touchSettings && touchSection === 'weather' && <WeatherPanel preferences={tabletPreferences} onChange={setTabletPreferences} />}
      {touchSettings && isAdmin && touchSection === 'tablet' && <ThisTabletPanel managed={managed.settings?.tablet} preferences={tabletPreferences}
        onChange={setTabletPreferences} photos={tabletPhotos.photos} photosReady={tabletPhotos.ready}
        photoBusy={tabletPhotos.busy} photoStatus={tabletPhotos.status} onAddPhoto={() => { void tabletPhotos.add(); }}
        onRemovePhoto={id => { void tabletPhotos.remove(id).then(removed => {
          if (removed) setTabletPreferences(current => current.wallpaperId === id ? { ...current, wallpaperId: defaultTabletPreferences.wallpaperId } : current);
        }); }} />}
      {touchSettings && isAdmin && touchSection === 'time' && <div className="touch-settings-scroll">
        <TimeLimitsPanel managed={managed.settings?.timeLimits} settings={timeLimits.settings} onChange={timeLimits.updateSettings} usedMs={timeLimits.usage.usedMs} />
      </div>}
      <SettingsModal
        embedded={touchSettings}
        maintenanceOnly={touchSettings && touchSection === 'general'}
        isOpen={isSettingsOpen && (!touchSettings || touchSection === "wifi" || touchSection === "bluetooth" || (isAdmin && touchSection === "general"))}
        onClose={closeSettings}
        isStandalone={isStandalone}
        arborXrManaged={kioskStatus?.arborXrManaged ?? true}
        onExitKiosk={async () => {
          let notice: { message?: string } | void;
          try {
            const result = await SystemBridge.exitKioskToSystemHome({ adminToken: getAdminToken() ?? undefined });
            notice = deriveExitKioskNotice(result);
          } catch (e) { console.error("exit kiosk", e); }
          refreshKiosk();
          return notice;
        }}
        isAdmin={isAdmin}
        onEnterAdmin={() => setIsAdmin(true)}
        onExitAdmin={() => { setIsAdmin(false); setIsAdminPanelOpen(false); }}
        onOpenAdminPanel={openAdminPanel}
        deviceProfile={deviceProfile}
        initialTab={touchSettings ? (touchSection === "bluetooth" ? "bluetooth" : "wifi") : settingsTab}
        onNetworkChange={refreshStatus}
      />

      <AdminPanel
        embedded={touchSettings}
        initialTab={touchSettings && (touchSection === 'apps' || touchSection === 'content' || touchSection === 'general' || touchSection === 'health') ? touchSection : 'apps'}
        isOpen={touchSettings ? isSettingsOpen && isAdmin && ['apps', 'content', 'general', 'health'].includes(touchSection) : isAdminPanelOpen}
        onClose={closeAdminPanel}
        apps={visibleApps.map(g => ({
          id: g.id, name: g.title, icon: Gamepad2,
          iconUrl: g.iconUrl, artBackgroundUrl: g.artBackgroundUrl, artForegroundUrl: g.artForegroundUrl,
        }))}
        availableApps={apps.map(g => ({
          id: g.id, name: g.title, icon: Gamepad2,
          iconUrl: g.iconUrl, artBackgroundUrl: g.artBackgroundUrl, artForegroundUrl: g.artForegroundUrl,
        }))}
        onAddApp={(id) => updateHiddenApps((current) => { const next = new Set(current); next.delete(id); return next; })}
        onRemoveApp={(id) => updateHiddenApps((current) => new Set(current).add(id))}
        inactivityTimeout={inactivityTimeout}
        onSetInactivityTimeout={updateInactivityTimeout}
        allowSameChannelRecommendations={allowSameChannelRecommendations}
        onSetAllowSameChannelRecommendations={setAllowSameChannelRecommendations}
        recommendAfter={recommendAfter}
        onSetRecommendAfter={setRecommendAfter}
        autoplayNext={autoplayNext}
        onSetAutoplayNext={setAutoplayNext}
        manageNotifications={manageNotifications}
        onSetManageNotifications={setManageNotifications}
        libraryEnabled={libraryEnabled}
        onSetLibraryEnabled={setLibraryEnabled}
        managedSettings={touchSettings ? managed.settings : null}
        links={localLinks}
        onSetLinks={saveLocalLinks}
        videos={managed.settings?.youtubeChannels === undefined ? youtubeItems : [...youtubeItems.filter(item => item.kind !== "channel"), ...managed.channels]}
        onAddVideo={(url, title, artworkUrl) => {
          const item = addYouTubeItem(url, title, artworkUrl);
          if (!item) return false;
          setYouTubeItems(getYouTubeItems());
          setFeaturedItem(toYouTubeContentItem(item));
          return true;
        }}
        onRemoveVideo={(id) => { removeYouTubeItem(id); setYouTubeItems(getYouTubeItems()); }}
        deviceProfile={deviceProfile}
        standalone={isStandalone}
        appMode={appMode}
        onSetAppMode={chooseAppMode}
        kioskStatus={kioskStatus}
        onRefreshKiosk={refreshKiosk}
        onSetDefaultLauncher={() => SystemBridge.openLauncherSettings({ adminToken: getAdminToken() ?? undefined })}
        onRequestDeviceAdmin={async () => { try { await SystemBridge.requestDeviceAdmin(); } catch (e) { console.error("device admin", e); } setTimeout(refreshKiosk, 500); }}
        onLockKiosk={async () => {
          const packages = visibleApps.map(a => a.packageName).filter((p): p is string => !!p);
          try {
            await SystemBridge.enableKioskLock({ packages, adminToken: getAdminToken() ?? undefined });
            await refreshKiosk();
          } catch (e) {
            console.error("lock kiosk", e);
            await refreshKiosk();
            throw e;
          }
        }}
        onUnlockKiosk={async () => {
          try {
            await SystemBridge.disableKioskLock({ adminToken: getAdminToken() ?? undefined });
            await refreshKiosk();
          } catch (e) {
            console.error("unlock kiosk", e);
            await refreshKiosk();
            throw e;
          }
        }}
        onClearDeviceOwner={async () => { try { await SystemBridge.clearDeviceOwner({ adminToken: getAdminToken() ?? undefined }); } catch (e) { console.error("clear device owner", e); } setTimeout(refreshKiosk, 500); }}
        onResetAdmin={() => {
          setTouchSection("wifi");
          clearAdminConfiguration();
          setAdminConfigured(false);
          setIsAdmin(false);
          setIsAdminPanelOpen(false);
        }}
        onLibraryChanged={loadLibrary}
      />
      </TouchSettingsSheet>

      {volumeHint && <div className="volume-hint" role="status">
        <Headphones aria-hidden="true" /><span>Try headphones</span>
        {!playingYouTube && <button type="button" onClick={() => { setVolumeHint(false); openSettings("bluetooth"); }}>Bluetooth</button>}
      </div>}

      {playingYouTube && (
        <YouTubePlayer
          item={playingYouTube}
          trackProgress={deviceProfile?.touchUi === true && !deviceProfile?.remoteUi}
          touch={deviceProfile?.touchUi === true && !deviceProfile?.remoteUi}
          upNext={deviceProfile?.touchUi === true && !deviceProfile?.remoteUi ? {
            items: youtubeContentItems, recommendAfter, autoplay: autoplayNext,
            onPlay: next => { if (!timeLocked) launchItem(next); },
          } : undefined}
          allowSameChannelRecommendations={deviceProfile?.touchUi && !deviceProfile?.remoteUi ? false : allowSameChannelRecommendations}
          onClose={() => {
            const returnId = browsingYouTubeChannel ? null : `yt:${playingYouTube.id}`;
            lastActivityRef.current = Date.now();
            setPlayingYouTube(null);
            if (returnId) restoreContentTileFocus(returnId);
          }}
        />
      )}

      {browsingYouTubeChannel && (
        <YouTubeChannelBrowser
          item={browsingYouTubeChannel}
          touch={deviceProfile?.touchUi === true && !deviceProfile?.remoteUi}
          active={!playingYouTube}
          onClose={() => {
            const returnId = `yt:${browsingYouTubeChannel.id}`;
            recordDiagnostic("info", "YouTube channel browser closed");
            setBrowsingYouTubeChannel(null);
            restoreContentTileFocus(returnId);
          }}
          onPlay={(video: YouTubeChannelVideoResult) => {
            setPlayingYouTube({
              id: `video:${video.videoId}`,
              kind: "video",
              sourceId: video.videoId,
              sourceLabel: video.videoId,
              title: video.title,
              thumbnailUrl: video.thumbnailUrl,
              addedAt: Date.parse(video.publishedAt) || Date.now(),
              channelId: channelIdForYouTubeItem(browsingYouTubeChannel),
            });
          }}
        />
      )}

      {libraryAvailable && isLibraryBrowserOpen && (
        <LibraryCatalogBrowser
          onClose={() => {
            recordDiagnostic("info", "Library catalog browser closed");
            setIsLibraryBrowserOpen(false);
            restoreContentTileFocus("library:browse");
          }}
          onLibraryChanged={loadLibrary}
          touch={touchSettings}
        />
      )}

      {needsModeSetup && (
        <ModeSetup
          onChoose={chooseAppMode}
          isTelevision={deviceProfile?.isTelevision === true}
          isFireOs={deviceProfile?.isFireOs === true}
        />
      )}

      {needsOnboarding && (
        <StandaloneOnboarding
          deviceProfile={deviceProfile}
          manageNotifications={manageNotifications}
          onSetManageNotifications={setManageNotifications}
          onComplete={finishOnboarding}
        />
      )}

      {/* Companion first-run gate: force an admin PIN before the kiosk is usable
          so a child can't claim admin by being the first to set one. Reuses the
          onboarding PinStep (PIN -> confirm -> recovery question); it has no
          skip/cancel that dismisses, so the panel stays covered until a PIN
          exists. */}
      {needsCompanionAdminSetup && (
        <div
          data-dpad-scope
          data-input-mode={deviceProfile?.remoteUi ? "remote" : "touch"}
          className="fixed inset-0 z-[300] overflow-y-auto bg-[oklch(11%_0_0)] p-6 sm:p-10"
        >
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <OpenPanelBrand showIcon iconClassName="size-10" wordmarkClassName="text-3xl sm:text-4xl" />
              </div>
              <h1 className="text-xl sm:text-2xl text-[oklch(85%_0_0)] mb-2" style={{ fontWeight: 500 }}>
                Secure this device
              </h1>
              {deviceProfile?.remoteUi && (
                <p className="text-[oklch(70.8%_0_0)]">
                  Create an admin PIN before handing the device to a child. It's required to open Settings and Admin Mode.
                </p>
              )}
            </div>
            <PinStep deviceProfile={deviceProfile} onDone={() => setAdminConfigured(true)} />
          </div>
        </div>
      )}

      {!managementResolved && !needsModeSetup && (
        <div
          data-dpad-scope
          data-input-mode={deviceProfile?.remoteUi ? "remote" : "detecting"}
          className="fixed inset-0 z-[350] flex flex-col items-center justify-center gap-5 bg-black"
        >
          <OpenPanelBrand showIcon iconClassName="size-14" wordmarkClassName="text-5xl" />
          <p className="text-lg text-[oklch(65%_0_0)]">Checking device management…</p>
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        [data-dpad-scope] :focus-visible {
          outline: 3px solid rgba(255, 255, 255, 0.95) !important;
          outline-offset: 3px;
        }
        [data-input-mode="remote"] :focus,
        [data-input-mode="remote"] :focus-visible {
          --tw-ring-shadow: 0 0 #0000 !important;
          --tw-ring-offset-shadow: 0 0 #0000 !important;
          box-shadow: none !important;
          outline-width: 4px !important;
        }
      `}</style>
      </div>
    </MotionConfig>
  );
}
