import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  BellOff,
  CheckCircle2,
  HardDrive,
  Loader2,
  MemoryStick,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  SystemBridge,
  type DebloatApp,
  type DeviceHealthActionResult,
  type DeviceHealthSnapshot,
} from "../native/SystemBridge";
import { getAdminToken } from "../native/adminAuth";
import { RemoveButton } from "./RemoveButton";
import { ToggleSwitch } from "./ToggleSwitch";

interface DeviceHealthPanelProps {
  touch?: boolean;
  manageNotifications: boolean;
  onSetManageNotifications: (enabled: boolean) => void;
  autoApply?: boolean;
  setupMode?: boolean;
  isFireOs?: boolean;
}

const buttonClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 disabled:opacity-50 transition-colors";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / (1024 ** unit);
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function statusLabel(app: DebloatApp): string {
  if (app.status === "hidden") return "Hidden by policy";
  if (app.status === "disabled-externally") return "Disabled outside OpenPanel";
  return "Active";
}

export function DeviceHealthPanel({
  touch = false,
  manageNotifications,
  onSetManageNotifications,
  autoApply = false,
  setupMode = false,
  isFireOs = false,
}: DeviceHealthPanelProps) {
  const [health, setHealth] = useState<DeviceHealthSnapshot | null>(null);
  const [apps, setApps] = useState<DebloatApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const autoApplied = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHealth, debloat] = await Promise.all([
        SystemBridge.getDeviceHealth(),
        SystemBridge.getDebloatApps(),
      ]);
      setHealth(nextHealth);
      setApps(debloat.apps);
    } catch (error) {
      setMessage(touch ? "Device action unavailable" : error instanceof Error ? error.message : "Device health could not be read.");
    } finally {
      setLoading(false);
    }
  }, [touch]);

  const consumeResult = useCallback(async (result: DeviceHealthActionResult) => {
    setMessage(touch ? (result.available ? "Updated" : "Device action unavailable") : result.message);
    if (result.apps) setApps(result.apps);
    else if (result.app) {
      const updatedApp = result.app;
      setApps((current) => current.map((app) => (
        app.packageName === updatedApp.packageName ? updatedApp : app
      )));
    }
    const nextHealth = await SystemBridge.getDeviceHealth();
    setHealth(nextHealth);
  }, [touch]);

  const optimize = useCallback(async () => {
    setBusyKey("optimize");
    try {
      await consumeResult(await SystemBridge.applyRecommendedDebloat({
        manageNotifications,
        adminToken: getAdminToken() ?? undefined,
      }));
    } catch (error) {
      setMessage(touch ? "Device action unavailable" : error instanceof Error ? error.message : "Device optimization failed.");
    } finally {
      setBusyKey(null);
    }
  }, [consumeResult, manageNotifications]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!autoApply || loading || !health?.canManageApps || autoApplied.current) return;
    autoApplied.current = true;
    void optimize();
  }, [autoApply, health?.canManageApps, loading, optimize]);

  const toggleNotifications = async () => {
    const enabled = !manageNotifications;
    // App.tsx owns the native sync: its manageNotifications effect calls
    // SystemBridge.setNotificationManagement whenever this state flips. The panel
    // must only update state here — calling the bridge as well applied the policy
    // twice per toggle. After flipping, re-read the real device snapshot so the
    // displayed health/app policy reflects the outcome App applies.
    onSetManageNotifications(enabled);
    setBusyKey("notifications");
    try {
      await refresh();
    } finally {
      setBusyKey(null);
    }
  };

  const updatePackage = async (app: DebloatApp, hidden: boolean) => {
    setBusyKey(app.packageName);
    try {
      await consumeResult(await SystemBridge.setDebloatPackageState({
        packageName: app.packageName,
        hidden,
        adminToken: getAdminToken() ?? undefined,
      }));
    } catch (error) {
      setMessage(touch ? "Device action unavailable" : error instanceof Error ? error.message : "The app policy could not be updated.");
    } finally {
      setBusyKey(null);
    }
  };

  const restoreAll = async () => {
    setBusyKey("restore");
    try {
      await consumeResult(await SystemBridge.restoreDebloatApps({ adminToken: getAdminToken() ?? undefined }));
    } catch (error) {
      setMessage(touch ? "Device action unavailable" : error instanceof Error ? error.message : "Managed apps could not be restored.");
    } finally {
      setBusyKey(null);
    }
  };

  const uninstall = async (app: DebloatApp) => {
    setBusyKey(app.packageName);
    setMessage(touch ? "Awaiting confirmation" : `Android will ask you to confirm uninstalling ${app.label}.`);
    try {
      const result = await SystemBridge.requestUninstallPackage({ packageName: app.packageName });
      setMessage(touch ? (result.uninstalled ? "Uninstalled" : "Kept") : result.uninstalled ? `${app.label} was uninstalled.` : `${app.label} was kept.`);
      await refresh();
    } catch (error) {
      setMessage(touch ? "Device action unavailable" : error instanceof Error ? error.message : "Android could not open uninstall confirmation.");
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && !health) {
    return (
      <section aria-labelledby="device-health-heading" className="device-health-panel space-y-4">
        <h3 id="device-health-heading" className="text-xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>
          Device Health
        </h3>
        <div role="status" className="flex items-center justify-center gap-3 py-16 text-[oklch(70.8%_0_0)]">
          {touch && message ? "Health unavailable" : <><Loader2 className="size-5 animate-spin" /> Detecting this device…</>}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="device-health-heading" className="device-health-panel space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="size-5 text-[oklch(70%_0.18_255)]" />
            <h3 id="device-health-heading" className="text-xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>
              Device Health
            </h3>
          </div>
          <p className="text-sm text-[oklch(70.8%_0_0)]">
            {health ? `${health.manufacturer} ${health.model} · Android ${health.androidVersion}` : "Device details unavailable"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || busyKey !== null}
          className={`${buttonClass} bg-[oklch(26.9%_0_0)] text-[oklch(90%_0_0)] hover:bg-[oklch(33%_0_0)]`}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {health && (
        <div className="system-list system-list-grid grid sm:grid-cols-2 gap-4">
          <div className="system-list-row rounded-xl border border-[oklch(35%_0_0)] bg-[oklch(24%_0_0)] p-4">
            <div className="flex items-center gap-2 text-[oklch(88%_0_0)] mb-2">
              <MemoryStick className="size-5" /> RAM in use
            </div>
            <div className="text-2xl text-white" style={{ fontWeight: 600 }}>
              {formatBytes(health.ramUsedBytes)} <span className="text-sm text-[oklch(65%_0_0)]">of {formatBytes(health.ramTotalBytes)}</span>
            </div>
            <div className="h-2 rounded-full bg-[oklch(18%_0_0)] mt-3 overflow-hidden">
              <div className="h-full bg-[oklch(58%_0.2_255)]" style={{ width: `${Math.min(100, health.ramUsedPercent)}%` }} />
            </div>
          </div>
          <div className="system-list-row rounded-xl border border-[oklch(35%_0_0)] bg-[oklch(24%_0_0)] p-4">
            <div className="flex items-center gap-2 text-[oklch(88%_0_0)] mb-2">
              <HardDrive className="size-5" /> Storage in use
            </div>
            <div className="text-2xl text-white" style={{ fontWeight: 600 }}>
              {formatBytes(health.storageUsedBytes)} <span className="text-sm text-[oklch(65%_0_0)]">of {formatBytes(health.storageTotalBytes)}</span>
            </div>
            <div className="h-2 rounded-full bg-[oklch(18%_0_0)] mt-3 overflow-hidden">
              <div className="h-full bg-[oklch(52%_0.16_150)]" style={{ width: `${Math.min(100, health.storageUsedPercent)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="system-list system-list-row flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[oklch(43.9%_0_0)] bg-[oklch(26.9%_0_0)] p-4">
        <div className="flex items-start gap-3">
          <BellOff className="size-5 mt-0.5 text-[oklch(75%_0.16_255)]" />
          <p className="text-[oklch(98%_0_0)]" style={{ fontWeight: 500 }}>Block app notifications</p>
        </div>
        <ToggleSwitch
          checked={manageNotifications}
          onChange={() => void toggleNotifications()}
          ariaLabel="Block app notifications"
          disabled={busyKey !== null}
        />
      </div>

      {/* Without Device Owner none of the hide/restore actions can work, so
          they are left out rather than shown disabled. */}
      {health?.canManageApps !== false && (
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void optimize()}
          disabled={!health?.canManageApps || busyKey !== null}
          className={`${buttonClass} bg-[oklch(48.8%_0.243_264.376)] text-white hover:brightness-110`}
        >
          {busyKey === "optimize" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {autoApply && busyKey === "optimize" ? "Optimizing…" : "Optimize now"}
        </button>
        <button
          type="button"
          onClick={() => void restoreAll()}
          disabled={!health?.canManageApps || busyKey !== null || !apps.some((app) => app.managedByOpenPanel)}
          className={`${buttonClass} bg-[oklch(26.9%_0_0)] text-[oklch(90%_0_0)] hover:bg-[oklch(33%_0_0)]`}
        >
          {busyKey === "restore" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          Restore apps
        </button>
      </div>
      )}

      {health && !health.canManageApps && (
        <p className="rounded-lg bg-[oklch(24%_0_0)] px-4 py-3 text-sm text-[oklch(80%_0_0)]">
          {touch ? (health.arborXrManaged ? "Managed by ArborXR" : "App management unavailable") : "Hiding and restoring these apps needs OpenPanel to be the Device Owner. Until then they stay as they are."}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-[oklch(24%_0_0)] px-4 py-3 text-sm text-[oklch(80%_0_0)]">
          {message}
        </p>
      )}

      <div>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h4 className="text-lg text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Detected optional apps</h4>
          </div>
          {health && <span className="text-xs text-[oklch(65%_0_0)]">{health.hiddenBloatCount} hidden</span>}
        </div>
        {apps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[oklch(40%_0_0)] p-6 text-center text-sm text-[oklch(70.8%_0_0)]">
            {touch ? "No optional apps" : "No reviewed optional packages were detected for this device."}
          </div>
        ) : (
          <div className="system-list space-y-3">
            {apps.map((app) => (
              <div key={app.packageName} className="system-list-row rounded-xl border border-[oklch(35%_0_0)] bg-[oklch(24%_0_0)] p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[oklch(96%_0_0)]" style={{ fontWeight: 500 }}>{app.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${app.status === "active"
                        ? "bg-[oklch(32%_0_0)] text-[oklch(85%_0_0)]"
                        : "bg-[oklch(40%_0.1_150)]/50 text-[oklch(82%_0.12_150)]"}`}>
                        {statusLabel(app)}
                      </span>
                    </div>
                    {!touch && <p className="text-sm text-[oklch(70.8%_0_0)] mt-1">{app.reason}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {app.status !== "disabled-externally" && health?.canManageApps !== false && (
                      <button
                        type="button"
                        onClick={() => void updatePackage(app, !app.hidden)}
                        disabled={!health?.canManageApps || busyKey !== null}
                        className={`${buttonClass} bg-[oklch(31%_0_0)] text-[oklch(90%_0_0)] hover:bg-[oklch(38%_0_0)]`}
                      >
                        {busyKey === app.packageName
                          ? <Loader2 className="size-4 animate-spin" />
                          : app.hidden ? <RotateCcw className="size-4" /> : <ShieldCheck className="size-4" />}
                        {app.hidden ? "Restore" : "Hide"}
                      </button>
                    )}
                    {app.canUninstall && !health.arborXrManaged && app.status !== "disabled-externally" && (
                      touch ? <RemoveButton itemTitle={app.label} onRemove={() => void uninstall(app)} disabled={busyKey !== null}
                        icon={<span>Uninstall</span>} confirmLabel="Uninstall" className="settings-destructive" /> : (
                      <button
                        type="button"
                        onClick={() => void uninstall(app)}
                        disabled={busyKey !== null}
                        className={`${buttonClass} bg-[oklch(40%_0.14_25)]/70 text-[oklch(88%_0.1_25)] hover:bg-[oklch(48%_0.16_25)]/70`}
                      >
                        <Trash2 className="size-4" /> Uninstall…
                      </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </section>
  );
}
