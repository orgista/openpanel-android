import { motion } from "motion/react";
import { X, Plus, Trash2, Youtube, Lock, Unlock, Smartphone, Monitor, Check, AlertTriangle, RefreshCw, HeartPulse, Library, LayoutGrid, Mic, Volume2 } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type KioskYouTubeItem, cleanThumbnailUrl, thumbnailUrl } from "../native/youtube";
import { SystemBridge, type DeviceProfile, type KioskStatus } from "../native/SystemBridge";
import type { AppMode } from "../appConfig";
import { YouTubeSearchPanel } from "./YouTubeSearchPanel";
import { PermissionsManager } from "./PermissionsManager";
import { NotificationSoundPicker } from "./NotificationSoundPicker";
import { dismissSoftKeyboard } from "../native/keyboard";
import { RemoveButton } from "./RemoveButton";
import { DEFAULT_RECOMMEND_AFTER, RECOMMEND_AFTER_CHOICES } from "../native/adminSettings";
import { clearWatchHistory } from "../native/youtubeHistory";
import { clearDiagnostics, getDiagnostics, type DiagnosticEntry } from "../native/diagnostics";
import { DeviceHealthPanel } from "./DeviceHealthPanel";
import { LibraryManager } from "./LibraryManager";
import { AppIcon } from "./AppIcon";
import { ToggleSwitch } from "./ToggleSwitch";
import { NetworkPrivacyPanel } from "./NetworkPrivacyPanel";

interface App {
  id: string;
  name: string;
  icon: LucideIcon;
  iconUrl?: string;
  artBackgroundUrl?: string;
  artForegroundUrl?: string;
}

import { parseLinkInput, type ManagedLink, type ManagedSettings } from "../native/managedSettings";

interface AdminPanelProps {
  managedSettings?: ManagedSettings | null;
  /** Web links added by hand on this tablet (touch home only). */
  links?: ManagedLink[];
  onSetLinks?: (links: ManagedLink[]) => Promise<boolean>;
  embedded?: boolean;
  isOpen: boolean;
  onClose: () => void;
  apps: App[];
  availableApps: App[];
  onAddApp: (appId: string) => void;
  onRemoveApp: (appId: string) => void;
  inactivityTimeout: number;
  onSetInactivityTimeout: (minutes: number) => void;
  allowSameChannelRecommendations: boolean;
  onSetAllowSameChannelRecommendations: (allowed: boolean) => void;
  recommendAfter?: number;
  onSetRecommendAfter?: (videos: number) => void;
  autoplayNext?: boolean;
  onSetAutoplayNext?: (enabled: boolean) => void;
  manageNotifications?: boolean;
  onSetManageNotifications?: (enabled: boolean) => void;
  libraryEnabled?: boolean;
  onSetLibraryEnabled?: (enabled: boolean) => void;
  // Locked YouTube videos, channels, and playlists.
  videos: KioskYouTubeItem[];
  onAddVideo: (url: string, title: string, thumbnailUrl?: string | null) => boolean; // false if source is invalid
  onRemoveVideo: (id: string) => void;
  deviceProfile?: DeviceProfile | null;
  // Standalone (non-ArborXR) kiosk lockdown
  standalone: boolean;
  appMode: AppMode;
  onSetAppMode: (mode: AppMode) => void;
  kioskStatus: KioskStatus | null;
  onRefreshKiosk: () => void;
  onSetDefaultLauncher: () => void;
  onRequestDeviceAdmin: () => void;
  onLockKiosk: () => Promise<void> | void;
  onUnlockKiosk: () => Promise<void> | void;
  onClearDeviceOwner: () => void;
  onResetAdmin: () => void;
  onLibraryChanged?: () => void;
  initialTab?: AdminTab;
}

type AdminTab = "apps" | "content" | "general" | "health";

const ADMIN_TAB_DETAILS: Record<AdminTab, {
  label: string;
  televisionLabel?: string;
  icon: LucideIcon;
}> = {
  apps: { label: "Apps", icon: LayoutGrid },
  content: { label: "Content", icon: Library },
  general: { label: "General", icon: Monitor },
  health: { label: "Health", icon: HeartPulse },
};

export function adminTabsForDevice(_standalone: boolean, _isTelevision: boolean): AdminTab[] {
  return ["apps", "content", "general", "health"];
}

const adminBodyFocusableSelector = [
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function resetAdminPanelScroll(panel: HTMLDivElement | null) {
  if (panel) panel.scrollTop = 0;
}

export function kioskActionErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "The kiosk action failed.";
}

export function AdminPanel({
  embedded = false,
  isOpen,
  onClose,
  apps,
  availableApps,
  onAddApp,
  onRemoveApp,
  inactivityTimeout,
  onSetInactivityTimeout,
  allowSameChannelRecommendations,
  onSetAllowSameChannelRecommendations,
  recommendAfter = DEFAULT_RECOMMEND_AFTER,
  onSetRecommendAfter = () => {},
  autoplayNext = false,
  onSetAutoplayNext = () => {},
  manageNotifications = true,
  onSetManageNotifications = () => {},
  libraryEnabled = false,
  onSetLibraryEnabled = () => {},
  videos,
  onAddVideo,
  onRemoveVideo,
  deviceProfile,
  standalone,
  appMode,
  onSetAppMode,
  kioskStatus,
  onRefreshKiosk,
  onSetDefaultLauncher,
  onRequestDeviceAdmin,
  onLockKiosk,
  onUnlockKiosk,
  onClearDeviceOwner,
  onResetAdmin,
  onLibraryChanged,
  managedSettings,
  links = [],
  onSetLinks,
  initialTab = "apps",
}: AdminPanelProps) {
  const touch = deviceProfile?.touchUi === true && !deviceProfile.remoteUi;
  const isTelevision = deviceProfile?.isTelevision === true;
  const legacyTelevision = isTelevision && (deviceProfile?.sdk ?? 999) <= 28;
  const tabOrder = useMemo(
    () => adminTabsForDevice(standalone, isTelevision),
    [isTelevision, standalone],
  );
  const [activeTab, setActiveTab] = useState<AdminTab>(() => (
    adminTabsForDevice(standalone, isTelevision).includes(initialTab) ? initialTab : "apps"
  ));
  useEffect(() => { if (embedded) setActiveTab(initialTab); }, [embedded, initialTab]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [videoUrlListening, setVideoUrlListening] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [kioskActionError, setKioskActionError] = useState<string | null>(null);
  const [kioskActionBusy, setKioskActionBusy] = useState(false);
  const [timeoutDraft, setTimeoutDraft] = useState(String(inactivityTimeout));
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>(
    () => getDiagnostics().slice().reverse(),
  );
  const [volumeLimitEnabled, setVolumeLimitEnabled] = useState(false);
  const [volumeLimitPercent, setVolumeLimitPercent] = useState(25);
  const [volumeLimitDraft, setVolumeLimitDraft] = useState("25");
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<typeof activeTab, HTMLButtonElement | null>>>({});
  const isFireOs = deviceProfile?.isFireOs === true
    || kioskStatus?.homeControlMode?.startsWith("fire-") === true;
  const kioskActive = !!kioskStatus?.lockTaskActive
    || (isFireOs && !!kioskStatus?.kioskEnabled);

  const refreshDiagnostics = () => setDiagnostics(getDiagnostics().slice().reverse());

  const runKioskAction = async (action: () => Promise<void> | void) => {
    setKioskActionBusy(true);
    setKioskActionError(null);
    try {
      await action();
    } catch (error) {
      setKioskActionError(kioskActionErrorMessage(error));
    } finally {
      setKioskActionBusy(false);
    }
  };

  const bodyFocusableElements = () => Array.from(
    bodyRef.current?.querySelectorAll<HTMLElement>(adminBodyFocusableSelector) ?? [],
  ).filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  const focusFirstBodyControl = () => {
    const first = bodyFocusableElements()[0];
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const focusAdminTab = (tab: AdminTab) => {
    const element = tabRefs.current[tab];
    if (!element) return;
    element.focus({ preventScroll: true });
    const tabs = element.parentElement;
    if (!tabs) return;
    const left = element.offsetLeft;
    const right = left + element.offsetWidth;
    if (left < tabs.scrollLeft) tabs.scrollLeft = left;
    else if (right > tabs.scrollLeft + tabs.clientWidth) {
      tabs.scrollLeft = right - tabs.clientWidth;
    }
  };

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    if (tab === "general") setConfirmReset(false);
  };

  const handleTabKeyDown = (tab: AdminTab, event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" && tab === activeTab) {
      event.preventDefault();
      focusFirstBodyControl();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const index = tabOrder.indexOf(tab);
    const offset = event.key === "ArrowLeft" ? -1 : 1;
    const next = tabOrder[Math.min(tabOrder.length - 1, Math.max(0, index + offset))];
    if (next === tab) return;
    event.preventDefault();
    event.stopPropagation();
    selectTab(next);
    window.requestAnimationFrame(() => focusAdminTab(next));
  };

  const handleBodyKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowUp") return;
    const [first] = bodyFocusableElements();
    if (!first || document.activeElement !== first) return;
    event.preventDefault();
    event.stopPropagation();
    tabRefs.current[activeTab]?.focus();
  };

  useEffect(() => {
    setTimeoutDraft(String(inactivityTimeout));
  }, [inactivityTimeout]);

  useEffect(() => {
    void SystemBridge.getVolumeLimit().then(({ enabled, percent }) => {
      setVolumeLimitEnabled(enabled);
      setVolumeLimitPercent(percent);
      setVolumeLimitDraft(String(percent));
    });
  }, []);

  const updateVolumeLimit = (enabled: boolean, percent?: number) => {
    const p = percent ?? volumeLimitPercent;
    setVolumeLimitEnabled(enabled);
    if (percent !== undefined) {
      setVolumeLimitPercent(percent);
      setVolumeLimitDraft(String(percent));
    }
    void SystemBridge.setVolumeLimit({ enabled, percent: p });
  };

  const commitVolumeDraft = () => {
    const parsed = Number(volumeLimitDraft);
    const pct = Number.isFinite(parsed) && volumeLimitDraft.trim() !== ""
      ? Math.min(100, Math.max(1, Math.round(parsed)))
      : volumeLimitPercent;
    setVolumeLimitPercent(pct);
    setVolumeLimitDraft(String(pct));
    void SystemBridge.setVolumeLimit({ percent: pct });
  };

  useEffect(() => {
    if (!tabOrder.includes(activeTab)) setActiveTab("apps");
  }, [activeTab, tabOrder]);

  useEffect(() => {
    resetAdminPanelScroll(bodyRef.current);
    if (!isOpen) return;
    if (activeTab === "general" || activeTab === "health") refreshDiagnostics();
    if (touch) return;
    const focusTimer = window.setTimeout(() => focusAdminTab(activeTab), 0);
    return () => window.clearTimeout(focusTimer);
  }, [touch, activeTab, isOpen]);

  const updateTimeoutDraft = (next: string) => {
    setTimeoutDraft(next);
    if (!/^\d+$/.test(next)) return;
    const minutes = Number(next);
    if (minutes >= 1 && minutes <= 60) onSetInactivityTimeout(minutes);
  };

  const commitTimeoutDraft = () => {
    const parsed = Number(timeoutDraft);
    const minutes = Number.isFinite(parsed) && timeoutDraft.trim() !== ""
      ? Math.min(60, Math.max(1, Math.round(parsed)))
      : inactivityTimeout;
    setTimeoutDraft(String(minutes));
    onSetInactivityTimeout(minutes);
  };

  const handleAddVideo = async () => {
    await dismissSoftKeyboard();
    if (!onAddVideo(videoUrl, videoTitle)) {
      setVideoError("Use a YouTube video, playlist, or channel URL.");
      return;
    }
    setVideoUrl("");
    setVideoTitle("");
    setVideoError(null);
  };

  const handleAddLink = async () => {
    await dismissSoftKeyboard();
    const link = parseLinkInput(linkTitle, linkUrl);
    if (!link) { setLinkError("Use an https web address."); return; }
    if (!await onSetLinks?.([...links.filter(other => other.url !== link.url), link])) { setLinkError("Could not save the link."); return; }
    setLinkTitle("");
    setLinkUrl("");
    setLinkError(null);
  };

  const dictateVideoUrl = async () => {
    setVideoUrlListening(true);
    setVideoError(null);
    try {
      const { text } = await SystemBridge.requestVoiceInput({
        prompt: "Say the YouTube link or channel name",
      });
      const spoken = text.trim();
      if (spoken) setVideoUrl(spoken);
    } catch {
      setVideoError(deviceProfile?.remoteUi
        ? "Select the URL box and press your remote's microphone button to dictate."
        : "Voice input isn't available right now.");
    } finally {
      setVideoUrlListening(false);
    }
  };

  const diagnosticLog = (<>
              <div className="mb-12">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>{touch ? "Diagnostics" : "Persistent Bug Log"}</h3>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={refreshDiagnostics}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[oklch(26.9%_0_0)] text-[oklch(87%_0_0)] hover:bg-[oklch(34%_0_0)]"
                    >
                      <RefreshCw className="size-4" /> Refresh
                    </button>
                    {touch ? <RemoveButton itemTitle="diagnostics" onRemove={() => { clearDiagnostics(); refreshDiagnostics(); }} icon={<span>Clear</span>} confirmLabel="Clear" className="settings-destructive" /> : (
                    <button
                      type="button"
                      onClick={() => { clearDiagnostics(); refreshDiagnostics(); }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(76%_0.16_22)] hover:bg-[oklch(63.7%_0.237_25.331)]/30"
                    >
                      <Trash2 className="size-4" /> Clear
                    </button>
                    )}
                  </div>
                </div>

                {diagnostics.length === 0 ? (
                  <div
                    tabIndex={0}
                    role="status"
                    className="rounded-lg border border-dashed border-[oklch(43.9%_0_0)] px-6 py-10 text-center text-[oklch(70.8%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                  >
                    No diagnostic events have been recorded yet.
                  </div>
                ) : (
                  <div className="system-list space-y-3">
                    {diagnostics.map((entry) => (
                      <article
                        key={entry.id}
                        tabIndex={0}
                        className="system-list-row rounded-lg border border-[oklch(32%_0_0)] bg-[oklch(17%_0_0)] p-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                      >
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className={`text-xs uppercase tracking-wide ${
                            entry.level === "error"
                              ? "text-[oklch(76%_0.16_22)]"
                              : entry.level === "warning"
                                ? "text-[oklch(82%_0.14_80)]"
                                : "text-[oklch(72%_0.12_240)]"
                          }`} style={{ fontWeight: 650 }}>
                            {entry.level}
                          </span>
                          <time className="text-[oklch(55.6%_0_0)] text-xs">
                            {new Date(entry.timestamp).toLocaleString()}
                          </time>
                        </div>
                        <p className="text-[oklch(92%_0_0)] text-sm break-words" style={{ fontWeight: 500 }}>{entry.message}</p>
                        {entry.details && (
                          <pre className="mt-2 text-[oklch(64%_0_0)] text-xs whitespace-pre-wrap break-words font-mono">{entry.details}</pre>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>

  </>);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={legacyTelevision ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={legacyTelevision ? { duration: 0 } : undefined}
      data-dpad-scope
      data-legacy-tv={legacyTelevision ? "true" : "false"}
      data-input-mode={deviceProfile?.remoteUi ? "remote" : deviceProfile?.touchUi ? "touch" : undefined}
      className={`${embedded ? "admin-embedded" : ""} admin-panel-backdrop fixed inset-0 bg-[oklch(14.5%_0_0)]/80 z-50 flex items-center justify-center ${legacyTelevision ? "" : "backdrop-blur-xl"}`}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <motion.div
        initial={legacyTelevision ? false : { opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={legacyTelevision ? { duration: 0 } : undefined}
        onClick={(e) => e.stopPropagation()}
        className="admin-panel-card bg-[oklch(20.5%_0_0)] rounded-none sm:rounded-2xl w-full max-w-5xl max-h-[100dvh] sm:max-h-[85dvh] overflow-hidden flex flex-col border border-[oklch(26.9%_0_0)]"
      >
        <div className="admin-panel-header flex items-center justify-between p-4 sm:p-8 border-b border-[oklch(26.9%_0_0)]">
          <h2 className="text-3xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Admin Panel</h2>
          <button
            onClick={onClose}
            aria-label="Close Admin Panel"
            className="p-2 hover:bg-[oklch(26.9%_0_0)] rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-[oklch(70.8%_0_0)]" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Admin sections"
          className="admin-panel-tabs flex shrink-0 gap-2 px-4 sm:px-8 pt-4 sm:pt-6 pb-4 border-b border-[oklch(26.9%_0_0)] overflow-x-auto"
        >
          {tabOrder.map((tab) => {
            const details = ADMIN_TAB_DETAILS[tab];
            const Icon = details.icon;
            const label = isTelevision && details.televisionLabel
              ? details.televisionLabel
              : details.label;
            return (
              <button
                key={tab}
                id={`admin-tab-${tab}`}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls="admin-tabpanel"
                ref={(element) => { tabRefs.current[tab] = element; }}
                onClick={() => selectTab(tab)}
                onKeyDown={(event) => handleTabKeyDown(tab, event)}
                className={`flex items-center gap-2 px-4 py-2 in-data-[input-mode=touch]:min-h-11 in-data-[input-mode=touch]:text-base rounded-lg transition-colors ${
                  activeTab === tab
                    ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                    : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
                }`}
                style={{ fontWeight: 500 }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        <div
          id="admin-tabpanel"
          role="tabpanel"
          aria-labelledby={`admin-tab-${activeTab}`}
          ref={bodyRef}
          data-dpad-content
          onKeyDownCapture={handleBodyKeyDownCapture}
          className="admin-panel-body flex-1 overflow-y-auto p-4 sm:p-8 select-none [&_input]:select-text [&_textarea]:select-text"
        >
          {activeTab === "apps" && (
            <>
              <div className="mb-12">
                <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Allowed Applications</h3>
                <div className="admin-app-grid grid grid-cols-2 md:grid-cols-4 gap-4">
                  {apps.map((app) => (
                    <div
                      key={app.id}
                      className="admin-app-item relative group bg-[oklch(26.9%_0_0)] rounded-lg p-6 hover:bg-[oklch(43.9%_0_0)]/30 transition-colors border border-[oklch(26.9%_0_0)] hover:border-[oklch(43.9%_0_0)]"
                    >
                      {deviceProfile?.touchUi && !deviceProfile.remoteUi ? (
                        <AppIcon item={{ ...app, title: app.name }} size={84} />
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          {app.iconUrl
                            ? <img src={app.iconUrl} alt="" draggable={false} className="size-14 rounded-xl object-cover" />
                            : <app.icon className="w-12 h-12 text-[oklch(70.8%_0_0)]" />}
                        <span className="text-[oklch(87%_0_0)] text-sm text-center" style={{ fontWeight: 400 }}>{app.name}</span>
                      </div>
                      )}
                      {touch ? <RemoveButton itemTitle={app.name} onRemove={() => onRemoveApp(app.id)}
                        icon={<span>Hide</span>} confirmLabel="Hide" className="admin-app-action" /> : (
                      <button
                        onClick={() => onRemoveApp(app.id)}
                        className="admin-app-action absolute top-2 right-2 p-2 in-data-[input-mode=touch]:p-3.5 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 in-data-[input-mode=touch]:opacity-100 in-data-[input-mode=touch]:bg-black/30 in-data-[input-mode=touch]:text-white/60 active:text-[oklch(70.4%_0.191_22.216)] transition-opacity hover:bg-[oklch(63.7%_0.237_25.331)]/30"
                        aria-label={`Hide ${app.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      )}
                    </div>
                  ))}
                  {apps.length === 0 && (
                    <div
                      tabIndex={0}
                      role="status"
                      aria-label="No allowed applications"
                      className="col-span-full rounded-lg border border-dashed border-[oklch(43.9%_0_0)] px-6 py-8 text-center text-[oklch(70.8%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                    >
                      {touch ? "No allowed apps" : "No allowed applications are available on this device."}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Available Applications</h3>
                <div className="admin-app-grid grid grid-cols-2 md:grid-cols-4 gap-4">
                  {availableApps
                    .filter((app) => !apps.find((a) => a.id === app.id))
                    .map((app) => (
                      <div
                        key={app.id}
                        className="admin-app-item relative group bg-[oklch(26.9%_0_0)]/50 rounded-lg p-6 hover:bg-[oklch(43.9%_0_0)]/30 transition-colors border-2 border-dashed border-[oklch(43.9%_0_0)]"
                      >
                        {deviceProfile?.touchUi && !deviceProfile.remoteUi ? (
                          <AppIcon item={{ ...app, title: app.name }} size={84} />
                        ) : (
                        <div className="flex flex-col items-center gap-3">
                          {app.iconUrl
                            ? <img src={app.iconUrl} alt="" draggable={false} className="size-14 rounded-xl object-cover opacity-80" />
                            : <app.icon className="w-12 h-12 text-[oklch(55.6%_0_0)]" />}
                          <span className="text-[oklch(70.8%_0_0)] text-sm text-center" style={{ fontWeight: 400 }}>{app.name}</span>
                        </div>
                        )}
                        <button
                          onClick={() => onAddApp(app.id)}
                          className="admin-app-action absolute top-2 right-2 p-2 in-data-[input-mode=touch]:p-3.5 bg-[oklch(48.8%_0.243_264.376)]/20 text-[oklch(48.8%_0.243_264.376)] rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 in-data-[input-mode=touch]:opacity-100 transition-opacity hover:bg-[oklch(48.8%_0.243_264.376)]/30"
                          aria-label={`Show ${app.name}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  {availableApps.filter((app) => !apps.find((allowed) => allowed.id === app.id)).length === 0 && (
                    <div
                      tabIndex={0}
                      role="status"
                      aria-label="No additional applications"
                      className="col-span-full rounded-lg border border-dashed border-[oklch(43.9%_0_0)] px-6 py-8 text-center text-[oklch(70.8%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                    >
                      {touch ? "No additional apps" : "No additional applications are available to add."}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "content" && (
            <>
              {/* Books & Audio — hidden on TV */}
              {!isTelevision && (
                <div className="mb-12">
                  <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Books &amp; Audio</h3>
                  <div className="space-y-5">
                    <div className="system-list system-list-row flex min-h-16 items-center justify-between gap-4 rounded-xl border border-[oklch(40%_0_0)] bg-[oklch(25%_0_0)] p-4">
                      <div>
                        <p className="text-base text-[oklch(98%_0_0)]" style={{ fontWeight: 600 }}>Show Books &amp; Audio on Home</p>
                      </div>
                      <ToggleSwitch
                        checked={libraryEnabled}
                        onChange={onSetLibraryEnabled}
                        ariaLabel="Show Books and Audio on Home"
                      />
                    </div>
                    <LibraryManager touch={touch} onLibraryChanged={onLibraryChanged} />
                  </div>
                </div>
              )}

              {/* YouTube */}
              <div>
                <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>YouTube Videos, Channels &amp; Playlists</h3>

                <div className="system-list system-list-row flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-[oklch(43.9%_0_0)] bg-[oklch(26.9%_0_0)] p-4 sm:p-5 mb-6">
                  <div className="text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>
                    Same channel recommendations
                  </div>
                  <ToggleSwitch
                    checked={allowSameChannelRecommendations}
                    onChange={onSetAllowSameChannelRecommendations}
                    ariaLabel="Allow same-channel YouTube recommendations"
                  />
                </div>

                {touch && <div className="system-list bg-[oklch(26.9%_0_0)] rounded-lg p-4 sm:p-5 mb-6">
                  <div className="text-[oklch(98.5%_0_0)] mb-4" style={{ fontWeight: 500 }}>Recommendations</div>
                  <div className="flex flex-wrap gap-3 mb-4" role="group" aria-label="Recommendations">
                    {RECOMMEND_AFTER_CHOICES.map(choice => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => onSetRecommendAfter(choice)}
                        aria-pressed={recommendAfter === choice}
                        className={`px-4 py-2.5 rounded-lg transition-colors ${recommendAfter === choice ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]" : "bg-[oklch(20.5%_0_0)] text-[oklch(70.8%_0_0)] border border-[oklch(43.9%_0_0)] hover:text-[oklch(87%_0_0)]"}`}
                        style={{ fontWeight: 500 }}
                      >
                        {choice === 0 ? "Off" : `After ${choice} videos`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Autoplay next</div>
                    <ToggleSwitch checked={autoplayNext} onChange={onSetAutoplayNext} ariaLabel="Autoplay next video" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Clear watch history</div>
                    <RemoveButton itemTitle="watch history" onRemove={clearWatchHistory} icon={<span>Clear</span>} confirmLabel="Clear" className="settings-destructive" />
                  </div>
                </div>}

                {touch && managedSettings?.links !== undefined && <div className="system-list">
                  <h3>Links · Managed</h3>
                  {managedSettings.links.map(link => <div key={link.url} className="system-list-row settings-value-row">{link.title}<span>Managed</span></div>)}
                </div>}
                {touch && onSetLinks && managedSettings?.links === undefined && <div className="system-list mb-8">
                  <h3>Links</h3>
                  <div className="flex flex-col sm:flex-row gap-3 mb-3 px-3">
                    <input type="text" enterKeyHint="next" autoComplete="off" aria-label="Link title" placeholder="Title"
                      value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)}
                      className="min-w-0 flex-1 px-4 py-2.5 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none placeholder:text-[oklch(43.9%_0_0)]" />
                    <input type="text" inputMode="url" enterKeyHint="done" autoComplete="off" autoCapitalize="none" aria-label="Web address" placeholder="Web address"
                      value={linkUrl} onChange={(e) => { setLinkUrl(e.target.value); setLinkError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleAddLink(); }}
                      className="min-w-0 flex-1 px-4 py-2.5 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none placeholder:text-[oklch(43.9%_0_0)]" />
                    <button type="button" onClick={() => void handleAddLink()} aria-label="Add link"
                      className="flex items-center gap-2 px-5 py-2.5 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors"
                      style={{ fontWeight: 500 }}>
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                  {linkError && <p role="alert" className="mb-3 text-[oklch(70.4%_0.191_22.216)] text-sm">{linkError}</p>}
                  {links.map(link => <div key={link.url} className="system-list-row settings-value-row">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{link.title}</div>
                      <div className="text-[oklch(55.6%_0_0)] text-xs truncate">{new URL(link.url).hostname}</div>
                    </div>
                    <RemoveButton itemTitle={link.title} onRemove={() => void onSetLinks(links.filter(other => other.url !== link.url))}
                      className="shrink-0 p-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors" />
                  </div>)}
                </div>}
                {touch && managedSettings?.youtubeChannels !== undefined && <h3>Channels · Managed</h3>}
                <ManagedContentControls managed={touch && managedSettings?.youtubeChannels !== undefined}>
                <YouTubeSearchPanel
                  approvedItems={videos}
                  deviceProfile={deviceProfile}
                  onAdd={onAddVideo}
                />

                <div className="system-list bg-[oklch(26.9%_0_0)] rounded-lg p-4 sm:p-5 mb-8">
                  <div className="text-[oklch(98.5%_0_0)] mb-4" style={{ fontWeight: 500 }}>Add a YouTube Video</div>
                  <label className="block text-[oklch(70.8%_0_0)] text-sm mb-2" style={{ fontWeight: 500 }}>YouTube URL</label>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      inputMode="url"
                      enterKeyHint="next"
                      autoComplete="off"
                      value={videoUrl}
                      onChange={(e) => { setVideoUrl(e.target.value); setVideoError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddVideo(); }}
                      placeholder={touch ? "YouTube URL" : "youtube.com video, playlist, or channel URL"}
                      className="min-w-0 flex-1 px-4 py-2.5 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none placeholder:text-[oklch(43.9%_0_0)]"
                      style={{ fontWeight: 400 }}
                    />
                    <button
                      type="button"
                      onClick={dictateVideoUrl}
                      disabled={videoUrlListening}
                      aria-label="Enter URL by voice"
                      title="Enter URL by voice"
                      className={`shrink-0 size-11 inline-flex items-center justify-center rounded-lg ${touch ? "border border-[oklch(43.9%_0_0)] bg-[oklch(20.5%_0_0)] text-[oklch(85%_0_0)] hover:bg-[oklch(26%_0_0)]" : "bg-[oklch(36%_0.12_264)] text-white hover:bg-[oklch(44%_0.16_264)]"} disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80`}
                    >
                      {videoUrlListening
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                  <label className="block text-[oklch(70.8%_0_0)] text-sm mb-2" style={{ fontWeight: 500 }}>Title (optional)</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      enterKeyHint="done"
                      autoComplete="off"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddVideo(); }}
                      placeholder={touch ? "Title" : "Shown on the tile"}
                      className="flex-1 px-4 py-2.5 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none placeholder:text-[oklch(43.9%_0_0)]"
                      style={{ fontWeight: 400 }}
                    />
                    <button
                      onClick={handleAddVideo}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                  {videoError && <p className="mt-3 text-[oklch(70.4%_0.191_22.216)] text-sm">{videoError}</p>}
                </div>

                </ManagedContentControls>

                <h4 className="text-lg text-[oklch(98.5%_0_0)] mb-3" style={{ fontWeight: 500 }}>
                  Allowed YouTube Sources ({videos.length})
                </h4>
                {videos.length === 0 ? (
                  <div className="text-center p-8 text-[oklch(55.6%_0_0)]">{touch ? "No approved sources" : "No approved YouTube sources yet. Verify a channel above or paste a link."}</div>
                ) : (
                  <div className="system-list system-list-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {videos.map((v) => (
                      <div
                        key={v.id}
                        className="system-list-row relative group flex min-h-24 items-center gap-4 rounded-xl border border-[oklch(36%_0_0)] bg-[oklch(24%_0_0)] p-4 hover:border-[oklch(48%_0_0)] transition-colors"
                      >
                        {v.kind === "video" || v.thumbnailUrl ? (
                          <img
                            src={v.kind === "video" ? thumbnailUrl(v.sourceId) : cleanThumbnailUrl(v.thumbnailUrl)}
                            alt=""
                            loading="lazy"
                            className={`youtube-channel-art shrink-0 object-cover bg-[oklch(20.5%_0_0)] ${v.kind === "channel" ? "size-16 rounded-full" : "h-16 w-28 rounded-lg"}`}
                            draggable={false}
                          />
                        ) : (
                          <div className="youtube-channel-art size-16 rounded-full bg-red-800 shrink-0 flex flex-col items-center justify-center text-white">
                            <Youtube className="w-7 h-7" />
                            <span className="text-[10px] uppercase tracking-wide mt-1">{v.kind}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[oklch(98.5%_0_0)] text-sm truncate" style={{ fontWeight: 500 }}>{v.title}</div>
                          <div className="text-[oklch(55.6%_0_0)] text-xs truncate" style={{ fontWeight: 400 }}>{v.sourceLabel}</div>
                        </div>
                        {v.id.startsWith("managed:") ? <span>Managed</span> : <RemoveButton
                          itemTitle={v.title}
                          onRemove={() => onRemoveVideo(v.id)}
                          className="shrink-0 p-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors"
                        />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "general" && (
            <>
              <div className="mb-12">
                <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Screen Saver</h3>
                <div className="system-list bg-[oklch(26.9%_0_0)] rounded-lg p-6 mb-10">
                  <div className="system-list-row flex items-center justify-between">
                    <div className="text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Start after</div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="60"
                        value={timeoutDraft}
                        onChange={(e) => updateTimeoutDraft(e.target.value)}
                        onBlur={commitTimeoutDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="w-24 px-3 py-2 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none text-center"
                        style={{ fontWeight: 400 }}
                      />
                      <span className="text-[oklch(70.8%_0_0)]" style={{ fontWeight: 400 }}>minutes</span>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Volume Limit</h3>
                <div className="system-list bg-[oklch(26.9%_0_0)] rounded-lg p-6">
                  <div className={`system-list-row flex items-center justify-between ${volumeLimitEnabled ? "mb-5" : ""}`}>
                    <p className="text-base text-[oklch(98%_0_0)]" style={{ fontWeight: 600 }}>Maximum volume</p>
                    <ToggleSwitch
                      checked={volumeLimitEnabled}
                      onChange={(enabled) => updateVolumeLimit(enabled)}
                      ariaLabel="Enable volume limit"
                    />
                  </div>
                  {volumeLimitEnabled && (
                    <div className="flex items-center gap-4 pt-4 border-t border-[oklch(32%_0_0)]">
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={volumeLimitPercent}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setVolumeLimitPercent(v);
                            setVolumeLimitDraft(String(v));
                            void SystemBridge.setVolumeLimit({ percent: v });
                          }}
                          className="flex-1 accent-[oklch(48.8%_0.243_264.376)]"
                          aria-label="Volume limit percentage"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="100"
                            value={volumeLimitDraft}
                            onChange={(e) => setVolumeLimitDraft(e.target.value)}
                            onBlur={commitVolumeDraft}
                            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                            className="w-16 px-2 py-2 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none text-center text-sm"
                            style={{ fontWeight: 400 }}
                          />
                          <span className="text-[oklch(70.8%_0_0)] text-sm">%</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void SystemBridge.testVolumeLimit()}
                        className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[oklch(36%_0_0)] text-[oklch(87%_0_0)] hover:bg-[oklch(42%_0_0)] transition-colors"
                        style={{ fontWeight: 500 }}
                        aria-label="Test volume at current limit"
                        title="Play a test tone at the limited volume"
                      >
                        <Volume2 className="w-4 h-4" /> Test
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {touch && <NotificationSoundPicker managed={kioskStatus?.arborXrManaged} />}

              {/* Kiosk Lock — only for standalone */}
              {standalone && (
                <div className="mb-12">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Kiosk Lock</h3>
                    <button onClick={onRefreshKiosk} className="text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)] text-sm" style={{ fontWeight: 500 }}>Refresh status</button>
                  </div>

                  {/* Management mode */}
                  {!isFireOs && <div className="system-list bg-[oklch(26.9%_0_0)] rounded-lg p-5 mb-6">
                    <div className="text-[oklch(98.5%_0_0)] mb-4" style={{ fontWeight: 500 }}>Management mode</div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => onSetAppMode("standalone")}
                        disabled={appMode === "standalone"}
                        aria-pressed={appMode === "standalone"}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors disabled:cursor-default ${appMode === "standalone" ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]" : "bg-[oklch(20.5%_0_0)] text-[oklch(70.8%_0_0)] border border-[oklch(43.9%_0_0)] hover:text-[oklch(87%_0_0)]"}`}
                        style={{ fontWeight: 500 }}
                      >
                        <Smartphone className="w-4 h-4" /> Standalone
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetAppMode("companion")}
                        disabled={appMode === "companion"}
                        aria-pressed={appMode === "companion"}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors disabled:cursor-default ${appMode === "companion" ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]" : "bg-[oklch(20.5%_0_0)] text-[oklch(70.8%_0_0)] border border-[oklch(43.9%_0_0)] hover:text-[oklch(87%_0_0)]"}`}
                        style={{ fontWeight: 500 }}
                      >
                        <Monitor className="w-4 h-4" /> Companion (ArborXR)
                      </button>
                    </div>
                  </div>}

                  {/* Setup steps. On a non-Device-Owner TV, OpenPanel cannot flip Home
                      itself (no permission to disable the OEM launcher), so a
                      "Choose" button here would never turn the row green — show the
                      literal adb recovery command instead of a dead-end action
                      (item 7 / stage2 H2, L1). enableKioskLock rejects with the
                      same wording. */}
                  {(() => {
                    const nonDoTvNeedsHome = isTelevision && !isFireOs
                      && !kioskStatus?.deviceOwner && !kioskStatus?.defaultLauncher;
                    return (
                  <div className="system-list space-y-3 mb-6">
                    {[
                      {
                        label: isFireOs
                          ? "Fire OS Home redirect"
                          : "Set OpenPanel as Home launcher",
                        ok: !!kioskStatus?.defaultLauncher || kioskStatus?.homeControlMode === "fire-redirect",
                        action: isFireOs
                          ? () => { void SystemBridge.openAccessibilitySettings(); }
                          : (nonDoTvNeedsHome ? undefined : onSetDefaultLauncher),
                        actionLabel: isFireOs ? "Enable" : "Choose",
                        hint: isFireOs
                          ? "Fire OS keeps its protected launcher; OpenPanel intercepts Home through accessibility."
                          : nonDoTvNeedsHome
                            ? "adb shell pm disable-user --user 0 com.google.android.tvlauncher"
                            : undefined as string | undefined,
                      },
                      { label: "Enable OpenPanel device admin", ok: !!kioskStatus?.deviceAdmin, action: onRequestDeviceAdmin, actionLabel: "Enable", hint: undefined as string | undefined },
                    ].map((row) => (
                      <div key={row.label} className="system-list-row flex items-center justify-between p-4 bg-[oklch(26.9%_0_0)] rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          {row.ok
                            ? <Check className="w-5 h-5 text-[oklch(72%_0.19_142)] shrink-0" />
                            : <AlertTriangle className="w-5 h-5 text-[oklch(70.4%_0.191_22.216)] shrink-0" />}
                          <div className="min-w-0">
                            <div className="text-[oklch(98.5%_0_0)] text-sm" style={{ fontWeight: 500 }}>{row.label}</div>
                            {!touch && row.hint && <div className="text-[oklch(55.6%_0_0)] text-xs" style={{ fontWeight: 400 }}>{row.hint}</div>}
                          </div>
                        </div>
                        {touch && kioskStatus?.arborXrManaged ? <span>{row.ok ? "Granted" : "Managed by ArborXR"}</span> : row.action && !row.ok && (
                          <button
                            onClick={row.action}
                            className="shrink-0 px-4 py-2 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors text-sm"
                            style={{ fontWeight: 500 }}
                          >
                            {row.actionLabel}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                    );
                  })()}

                  {kioskStatus?.deviceOwner && kioskStatus.systemUpdateWaitingSince != null && (
                    <div className="system-list mb-6">
                      <div className="system-list-row flex items-center justify-between p-4 bg-[oklch(26.9%_0_0)] rounded-lg">
                        <div className="text-[oklch(98.5%_0_0)] text-sm" style={{ fontWeight: 500 }}>System update waiting</div>
                        <span className="text-[oklch(70.8%_0_0)] text-sm">Installs 2–5 AM</span>
                      </div>
                    </div>
                  )}

                  {/* Permissions & special app access (Fully-style). Managed-device
                      grants can be automatic; the rest deep-link to Settings. */}
                  <div className="mb-6">
                    <div className="text-[oklch(98.5%_0_0)] mb-3" style={{ fontWeight: 500 }}>Permissions &amp; device access</div>
                    <PermissionsManager touch={touch} arborXrManaged={kioskStatus?.arborXrManaged} />
                  </div>

                  {/* Lock / unlock */}
                  {kioskActive ? (
                    <button
                      onClick={() => void runKioskAction(onUnlockKiosk)}
                      disabled={kioskActionBusy}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Unlock className="w-5 h-5" /> {isFireOs
                        ? "Disable Fire kiosk"
                        : `Unlock kiosk (${kioskStatus?.lockTaskMode ?? "none"})`}
                    </button>
                  ) : (
                    <button
                      onClick={() => void runKioskAction(onLockKiosk)}
                      disabled={kioskActionBusy}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Lock className="w-5 h-5" /> {isFireOs ? "Enable Fire kiosk" : "Lock device into kiosk"}
                    </button>
                  )}

                  {kioskActionError && (
                    <p role="alert" className="mt-3 rounded-lg border border-[oklch(70.4%_0.191_22.216)]/40 bg-[oklch(70.4%_0.191_22.216)]/10 px-4 py-3 text-sm text-[oklch(82%_0.12_22)]">
                      {touch ? "Kiosk action unavailable" : kioskActionError}
                    </p>
                  )}

                  {!isFireOs && kioskStatus?.deviceOwner && (
                    touch ? <RemoveButton itemTitle="Device Owner" onRemove={onClearDeviceOwner}
                      icon={<span>Remove Device Owner</span>} className="settings-destructive" /> : (
                    <button
                      onClick={onClearDeviceOwner}
                      className="w-full mt-3 flex items-center justify-center gap-3 py-3 bg-[oklch(63.7%_0.237_25.331)]/15 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/25 transition-colors text-sm"
                      style={{ fontWeight: 500 }}
                    >
                      <AlertTriangle className="w-4 h-4" /> Remove Device Owner (unmanage device)
                    </button>
                    )
                  )}

                </div>
              )}

              {!touch && diagnosticLog}

              {touch && !standalone && <div className="mb-8"><h3>Permissions &amp; device access</h3><PermissionsManager touch arborXrManaged={kioskStatus?.arborXrManaged} /></div>}

              {/* Security */}
              <div>
                <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Admin Access</h3>

                <div className="system-list bg-[oklch(26.9%_0_0)] rounded-lg p-6">
                  {!touch && <div className="text-[oklch(98.5%_0_0)] mb-5" style={{ fontWeight: 500 }}>Reset Admin setup</div>}

                  {!confirmReset ? (
                    <button
                      onClick={() => setConfirmReset(true)}
                      className="px-5 py-3 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      Reset Admin setup…
                    </button>
                  ) : (
                    <div className="rounded-lg border border-[oklch(70.4%_0.191_22.216)]/40 bg-[oklch(70.4%_0.191_22.216)]/10 p-4">
                      <p className="text-[oklch(87%_0_0)] text-sm mb-4" style={{ fontWeight: 500 }}>
                        {touch ? "Reset Admin setup?" : "Are you sure? The next person entering Admin Mode will create a new PIN and recovery question."}
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setConfirmReset(false)}
                          className="px-5 py-2.5 bg-[oklch(20.5%_0_0)] text-[oklch(70.8%_0_0)] rounded-lg hover:text-[oklch(87%_0_0)] transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          Keep Admin setup
                        </button>
                        <button
                          onClick={onResetAdmin}
                          className="px-5 py-2.5 bg-[oklch(63.7%_0.237_25.331)] text-white rounded-lg hover:opacity-90 transition-opacity"
                          style={{ fontWeight: 500 }}
                        >
                          Reset Admin setup
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "health" && (
            <>
              {touch && <details className="settings-diagnostics"><summary>Diagnostics</summary>{diagnosticLog}</details>}
              <DeviceHealthPanel
                touch={touch}
                manageNotifications={manageNotifications}
                onSetManageNotifications={onSetManageNotifications}
                isFireOs={isFireOs}
              />
              {(touch || deviceProfile?.isTelevision || isFireOs) && <NetworkPrivacyPanel touch={touch} arborXrManaged={kioskStatus?.arborXrManaged} />}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ManagedContentControls({ managed, children }: { managed: boolean; children: ReactNode }) {
  return managed ? <fieldset disabled>{children}</fieldset> : <>{children}</>;
}
