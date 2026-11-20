import { motion, AnimatePresence } from "motion/react";
import { X, Wifi, Bluetooth, LogOut, Shield, RefreshCw, ExternalLink, Loader2, Lock, LayoutGrid, Plus, Check } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { RemoveButton } from "./RemoveButton";
import { AdminAuth } from "./AdminAuth";
import { SystemBridge, type WifiNetwork, type BtDevice, type DeviceProfile } from "../native/SystemBridge";
import { recordDiagnostic } from "../native/diagnostics";
import { dismissSoftKeyboard } from "../native/keyboard";

interface SettingsModalProps {
  embedded?: boolean;
  maintenanceOnly?: boolean;
  isOpen: boolean;
  onClose: () => void;
  isStandalone: boolean;
  // ArborXR runs the tablet in lock task mode and only lets its own allowed
  // apps open, so full Android Settings can't launch there.
  arborXrManaged?: boolean;
  // Resolves with a notice when the native side intentionally stayed in
  // OpenPanel instead of exiting (e.g. no safe launcher would take over
  // Home) — see SystemBridge.exitKioskToSystemHome().
  onExitKiosk: () => Promise<{ message?: string } | void>;
  isAdmin: boolean;
  onEnterAdmin: () => void;
  onExitAdmin: () => void;
  onOpenAdminPanel: () => void;
  deviceProfile?: DeviceProfile | null;
  initialTab?: "wifi" | "bluetooth";
  onNetworkChange?: () => void;
}

export function WifiForgetAction({ ssid, canForget, onForget }: {
  ssid: string; canForget: boolean; onForget: () => void;
}) {
  return canForget ? <RemoveButton itemTitle={ssid} onRemove={onForget}
    icon={<span>Forget</span>} className="settings-destructive" /> : null;
}

type ConnectState =
  | { phase: "idle" }
  | { phase: "password"; ssid: string }
  | { phase: "connecting"; ssid: string }
  | { phase: "pending-approval"; ssid: string }
  | { phase: "failed"; ssid: string; message: string };

type SettingsFooterAction = "adminMode" | "adminPanel" | "exitAdmin" | "exitKiosk" | "systemSettings";

// Tablets list only found devices a child would pair (headphones, speakers, controllers),
// not the neighbours' lights and garage openers. TVs keep the full list.
export function listedBluetoothDevices(devices: BtDevice[], touch: boolean): BtDevice[] {
  return devices.filter(d => !d.unnamed && (!touch || d.paired || d.listenOrPlay));
}

export function wifiSignalLabel(signal: number): "Excellent" | "Good" | "Fair" | "Weak" {
  if (signal >= 75) return "Excellent";
  if (signal >= 50) return "Good";
  if (signal >= 25) return "Fair";
  return "Weak";
}

type SettingsTabDownDestination = "browse" | "body" | "footer";

export function settingsTabDownTarget({
  activeTab,
  usesTvWifiPicker,
  wifiListVisible,
  browseDisabled,
  hasBodyControl,
}: {
  activeTab: "wifi" | "bluetooth";
  usesTvWifiPicker: boolean;
  wifiListVisible: boolean;
  browseDisabled: boolean;
  hasBodyControl: boolean;
}): SettingsTabDownDestination {
  if (activeTab === "wifi" && usesTvWifiPicker && !wifiListVisible) return "footer";
  if (!browseDisabled) return "browse";
  if (hasBodyControl) return "body";
  return "footer";
}

const settingsBodyFocusableSelector = [
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function SettingsModal({
  embedded = false,
  maintenanceOnly = false,
  isOpen,
  onClose,
  isStandalone,
  arborXrManaged = false,
  onExitKiosk,
  isAdmin,
  onEnterAdmin,
  onExitAdmin,
  onOpenAdminPanel,
  deviceProfile,
  initialTab = "wifi",
  onNetworkChange,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"wifi" | "bluetooth">(initialTab);
  const [showAdminAuth, setShowAdminAuth] = useState(false);

  const touch = deviceProfile?.touchUi === true && !deviceProfile.remoteUi;
  const [forgetError, setForgetError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [wifiScanning, setWifiScanning] = useState(false);
  const [wifiError, setWifiError] = useState<string | null>(null);
  const [kioskExitNotice, setKioskExitNotice] = useState<string | null>(null);
  const [fireWifi, setFireWifi] = useState<{ connected: boolean; ssid?: string }>({ connected: false });
  const [wifiListExpanded, setWifiListExpanded] = useState(false);
  const [connect, setConnect] = useState<ConnectState>({ phase: "idle" });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const [btDevices, setBtDevices] = useState<BtDevice[]>([]);
  const [btEnabled, setBtEnabled] = useState<boolean | null>(null);
  const [btToggling, setBtToggling] = useState(false);
  const [btScanning, setBtScanning] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const [pairingAddress, setPairingAddress] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabRefs = useRef<Partial<Record<typeof activeTab, HTMLButtonElement | null>>>({});
  const browseNetworksRef = useRef<HTMLButtonElement | null>(null);
  // Remembers which network row last held D-pad focus so a scan refresh (which
  // replaces the whole `networks` array/DOM) can restore focus to the same SSID
  // instead of dropping it to <body> (H10/H11).
  const lastFocusedSsidRef = useRef<string | null>(null);
  // Same idea as lastFocusedSsidRef but for the Bluetooth tab (D6,
  // stage5-opus-test.md): a device-list refresh (scan finishing, a device
  // pairing/connecting) used to drop D-pad focus to <body> with no ring
  // anywhere on screen.
  const lastFocusedBtDeviceRef = useRef<string | null>(null);
  const settingsBodyRef = useRef<HTMLDivElement | null>(null);
  const footerRefs = useRef<Partial<Record<SettingsFooterAction, HTMLButtonElement | null>>>({});
  // Joining, forgetting and pairing are open to every user. The system Wi-Fi
  // fallback stays admin-only: even Android 10+'s small connectivity panel has
  // "See all", which opens full Settings and leaves the kiosk.
  const canOpenWifiPanel = isStandalone && isAdmin;
  const canOpenFullSystemSettings = isAdmin
    && !arborXrManaged
    && (isStandalone || deviceProfile?.isTablet === true);
  const footerOrder: SettingsFooterAction[] = isAdmin
    ? [
        "adminPanel",
        "exitAdmin",
        ...(isStandalone ? ["exitKiosk"] as const : []),
        ...(canOpenFullSystemSettings ? ["systemSettings"] as const : []),
      ]
    : ["adminMode"];
  const usesTvWifiPicker = deviceProfile?.isTelevision === true;
  const legacyTelevision = usesTvWifiPicker && (deviceProfile?.sdk ?? 999) <= 28;
  const usesFireWifiSettings = deviceProfile?.isFireOs === true;
  const wifiListVisible = !usesTvWifiPicker || wifiListExpanded;

  const settingsBodyFocusableElements = () => Array.from(
    settingsBodyRef.current?.querySelectorAll<HTMLElement>(settingsBodyFocusableSelector) ?? [],
  ).filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  const focusFirstFooterAction = () => {
    const first = footerOrder[0];
    if (first) footerRefs.current[first]?.focus();
  };

  const handleFooterKeyDown = (
    action: SettingsFooterAction,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      browseNetworksRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const index = footerOrder.indexOf(action);
    const offset = event.key === "ArrowLeft" ? -1 : 1;
    const next = footerOrder[Math.min(footerOrder.length - 1, Math.max(0, index + offset))];
    if (!next || next === action) return;
    event.preventDefault();
    event.stopPropagation();
    footerRefs.current[next]?.focus();
    footerRefs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const handleSettingsBodyKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowUp") return;
    const [first] = settingsBodyFocusableElements();
    if (!first || document.activeElement !== first) return;
    event.preventDefault();
    event.stopPropagation();
    browseNetworksRef.current?.focus();
  };

  const handleSettingsTabKeyDown = (
    tab: "wifi" | "bluetooth",
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      const [firstBodyControl] = settingsBodyFocusableElements();
      const destination = settingsTabDownTarget({
        activeTab,
        usesTvWifiPicker,
        wifiListVisible,
        browseDisabled: wifiScanning || btScanning || (activeTab === "wifi" && usesFireWifiSettings),
        hasBodyControl: !!firstBodyControl,
      });
      if (destination === "browse") browseNetworksRef.current?.focus();
      else if (destination === "body") firstBodyControl?.focus();
      else focusFirstFooterAction();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const next = event.key === "ArrowLeft" ? "wifi" : "bluetooth";
    if (next === tab) return;
    event.preventDefault();
    event.stopPropagation();
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  };

  const scanWifi = useCallback(async () => {
    setWifiScanning(true);
    setWifiError(null);
    try {
      const { networks: found } = await SystemBridge.scanWifi();
      found.sort((a, b) => (b.connected ? 1 : 0) - (a.connected ? 1 : 0) || b.signal - a.signal);
      setNetworks(found);
    } catch (e: any) {
      setWifiError(e?.message || "Could not scan Wi-Fi networks");
    } finally {
      setWifiScanning(false);
    }
  }, []);

  // After a scan refresh replaces the network rows, restore D-pad focus to the
  // same SSID's primary action if it's still in the list, or fall back to
  // Browse networks — never leave focus stranded on <body> (H10/H11).
  useEffect(() => {
    if (touch || activeTab !== "wifi" || !wifiListVisible || wifiScanning) return;
    const active = document.activeElement;
    if (active && active !== document.body && settingsBodyRef.current?.contains(active)) return;
    const ssid = lastFocusedSsidRef.current;
    const stillListed = ssid ? networks.some((n) => n.ssid === ssid) : false;
    if (stillListed && ssid) {
      const row = settingsBodyRef.current?.querySelector<HTMLElement>(
        `[data-wifi-row="${CSS.escape(ssid)}"] button`
      );
      if (row) {
        row.focus();
        return;
      }
    }
    browseNetworksRef.current?.focus();
  }, [touch, networks, wifiScanning, activeTab, wifiListVisible]);

  // Bluetooth-tab counterpart of the effect above (D6, stage5-opus-test.md):
  // restore focus to the same device's row after a scan/pair/unpair refresh
  // replaces btDevices, falling back to "Scan for devices" instead of <body>.
  useEffect(() => {
    if (touch || activeTab !== "bluetooth" || btScanning) return;
    const active = document.activeElement;
    if (active && active !== document.body && settingsBodyRef.current?.contains(active)) return;
    const address = lastFocusedBtDeviceRef.current;
    const stillListed = address ? btDevices.some((d) => d.address === address) : false;
    if (stillListed && address) {
      const row = settingsBodyRef.current?.querySelector<HTMLElement>(
        `[data-bt-device="${CSS.escape(address)}"] button`
      );
      if (row) {
        row.focus();
        return;
      }
    }
    browseNetworksRef.current?.focus();
  }, [touch, btDevices, btScanning, activeTab]);

  const openFireWifiSettings = useCallback(async () => {
    setWifiError(null);
    try {
      await SystemBridge.openWifiSettings();
    } catch (e: any) {
      setWifiError(e?.message || "Could not open Fire OS Wi-Fi settings");
    }
  }, []);

  const loadFireWifiStatus = useCallback(async () => {
    try {
      const status = await SystemBridge.getWifiStatus();
      setFireWifi({ connected: status.connected, ssid: status.ssid });
    } catch {
      setFireWifi({ connected: false });
    }
  }, []);

  const loadBluetooth = useCallback(async () => {
    setBtError(null);
    try {
      const status = await SystemBridge.getBluetoothStatus();
      setBtEnabled(status.enabled);
      if (!status.available) {
        setBtError("Bluetooth is not available on this device");
        setBtDevices([]);
        return;
      }
      if (status.permissionGranted === false) {
        setBtError("Bluetooth permission is required. Select Scan for devices to grant access.");
        setBtDevices([]);
        return;
      }
      setBtDevices(status.enabled ? status.devices ?? [] : []);
    } catch (e: any) {
      setBtError(e?.message || "Could not read Bluetooth status");
    }
  }, []);

  const toggleBluetooth = useCallback(async (target: boolean) => {
    setBtToggling(true);
    setBtError(null);
    try {
      // Android shows a system confirmation dialog; poll until the state
      // actually flips (user accepted) or give up after 15s.
      await SystemBridge.setBluetoothEnabled({ enabled: target });
      const started = Date.now();
      while (Date.now() - started < 15000) {
        await new Promise(r => setTimeout(r, 1500));
        const status = await SystemBridge.getBluetoothStatus();
        if (status.enabled === target) break;
      }
      await loadBluetooth();
      onNetworkChange?.();
    } catch (e: any) {
      setBtError(e?.message || "Could not change Bluetooth state");
    } finally {
      setBtToggling(false);
    }
  }, [loadBluetooth, onNetworkChange]);

  const scanBluetooth = useCallback(async () => {
    setBtScanning(true);
    setBtError(null);
    try {
      const { devices } = await SystemBridge.scanBluetooth();
      devices.sort(
        (a, b) =>
          (b.connected ? 2 : 0) + (b.paired ? 1 : 0) - ((a.connected ? 2 : 0) + (a.paired ? 1 : 0))
      );
      setBtDevices(listedBluetoothDevices(devices, touch));
    } catch (e: any) {
      setBtError(e?.message || "Could not scan for devices");
    } finally {
      setBtScanning(false);
    }
  }, [touch]);

  const openFullSystemSettings = useCallback(async () => {
    recordDiagnostic("info", "Full Android settings requested", {
      deviceType: deviceProfile?.deviceType ?? "unknown",
      managementMode: isStandalone ? "standalone" : "companion",
    });
    try {
      await SystemBridge.openSystemSettings();
      recordDiagnostic("info", "Full Android settings launch accepted");
    } catch (error) {
      console.error("Could not open full Android settings", error);
    }
  }, [deviceProfile?.deviceType, isStandalone]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setConnect({ phase: "idle" });
      setPassword("");
      setShowAdminAuth(false);
      setWifiListExpanded(false);
      setKioskExitNotice(null);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || maintenanceOnly) return;
    if (activeTab === "wifi" && usesFireWifiSettings) void loadFireWifiStatus();
    else if (activeTab === "wifi" && wifiListVisible) scanWifi();
    if (activeTab === "bluetooth") loadBluetooth();
  }, [isOpen, maintenanceOnly, activeTab, wifiListVisible, usesFireWifiSettings, scanWifi, loadBluetooth, loadFireWifiStatus]);

  useEffect(() => {
    if (touch || !isOpen || showAdminAuth) return;
    const focusTimer = window.setTimeout(() => tabRefs.current[activeTab]?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [touch, activeTab, isOpen, showAdminAuth]);

  // System dialogs (Wi-Fi/Bluetooth enable, settings panels) background the
  // WebView, which throttles JS timers — so re-sync state when we return to
  // the foreground rather than relying on the in-flight poll loop.
  useEffect(() => {
    if (!isOpen) return;
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      if (activeTab === "wifi") {
        if (usesFireWifiSettings) void loadFireWifiStatus();
        else if (wifiListVisible) scanWifi();
      } else {
        loadBluetooth();
      }
      onNetworkChange?.();
    };
    document.addEventListener("visibilitychange", onResume);
    return () => document.removeEventListener("visibilitychange", onResume);
  }, [isOpen, activeTab, wifiListVisible, usesFireWifiSettings, scanWifi, loadBluetooth, loadFireWifiStatus, onNetworkChange]);

  // The adapter can settle into on/off well after the user taps the system
  // dialog — this native event fires exactly then, so the toggle never goes stale.
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    let cancelled = false;
    SystemBridge.addListener("bluetoothStateChanged", ({ enabled }) => {
      setBtEnabled(enabled);
      setBtToggling(false);
      if (enabled) loadBluetooth();
      else setBtDevices([]);
      onNetworkChange?.();
    }).then(h => {
      handle = h;
      // The effect may have been cleaned up before addListener resolved;
      // remove immediately so the native listener isn't leaked/duplicated.
      if (cancelled) h.remove();
    });
    return () => { cancelled = true; handle?.remove(); };
  }, [loadBluetooth, onNetworkChange]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // The modal renders null while closed but never unmounts, so a Wi-Fi connect
  // poll started before closing would keep hitting getWifiStatus for up to 25s.
  // Stop it as soon as the modal closes, not only on unmount.
  useEffect(() => {
    if (!isOpen && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [isOpen]);

  const startConnect = (network: WifiNetwork) => {
    setPassword("");
    setShowPassword(false);
    if (network.secured) {
      setConnect({ phase: "password", ssid: network.ssid });
    } else {
      submitConnect(network.ssid, "");
    }
  };

  // Focus the password field itself when the password phase opens (H8/H9): a
  // programmatic .focus() outside a direct keypress does not raise Gboard on
  // Google TV, so D-pad users land on a visibly focused field and only see the
  // keyboard once they press OK on it, matching README "Google TV input
  // behaviour".
  useEffect(() => {
    if (connect.phase !== "password") return;
    const timer = window.setTimeout(() => passwordInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [connect]);

  const submitConnect = async (ssid: string, pass: string) => {
    await dismissSoftKeyboard();
    setConnect({ phase: "connecting", ssid });
    try {
      const res = await SystemBridge.connectWifi({ ssid, password: pass });
      if (res.status !== "suggested") {
        setConnect({ phase: "failed", ssid, message: "Android rejected the network request" });
        return;
      }
      // Suggestion added — Android connects on its own schedule. Poll for up to 25s.
      let waited = 0;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        waited += 2500;
        try {
          const status = await SystemBridge.getWifiStatus();
          // H4/H7: Android's WifiInfo can report connected=true with
          // ssid="<unknown ssid>" for a moment right after association (a
          // location-permission-timing quirk, not an actual mismatch) — treat
          // that the same as an exact SSID match instead of polling past it
          // into a false "pending-approval" at 25s despite already being
          // connected to the network we just asked for.
          const ssidMatches = status.ssid === ssid || status.ssid === "<unknown ssid>";
          if (status.connected && ssidMatches) {
            if (pollRef.current) clearInterval(pollRef.current);
            setConnect({ phase: "idle" });
            onNetworkChange?.();
            scanWifi();
            return;
          }
        } catch { /* keep polling */ }
        if (waited >= 25000) {
          if (pollRef.current) clearInterval(pollRef.current);
          setConnect({ phase: "pending-approval", ssid });
        }
      }, 2500);
    } catch (e: any) {
      setConnect({ phase: "failed", ssid, message: e?.message || "Connection failed" });
    }
  };

  const handleForgetWifi = async (ssid: string) => {
    setForgetError(null);
    try {
      await SystemBridge.forgetWifi({ ssid });
      setWifiError(null);
      onNetworkChange?.();
      scanWifi();
    } catch (e: any) {
      if (touch) setForgetError(ssid);
      else if (e?.code === "PERMISSION_DENIED" || e?.message) {
        setWifiError(e?.message || "Could not forget this network.");
      }
    }
  };

  const handlePair = async (device: BtDevice) => {
    setPairingAddress(device.address);
    setBtError(null);
    try {
      await SystemBridge.pairBluetooth({ address: device.address });
      await loadBluetooth();
      onNetworkChange?.();
    } catch (e: any) {
      setBtError(`Pairing with ${device.name} failed${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setPairingAddress(null);
    }
  };

  const handleUnpair = async (device: BtDevice) => {
    try {
      await SystemBridge.unpairBluetooth({ address: device.address });
      await loadBluetooth();
      onNetworkChange?.();
    } catch (e: any) {
      setBtError(e?.message || "Could not unpair device");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={legacyTelevision ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={legacyTelevision ? { duration: 0 } : undefined}
        data-dpad-scope
        data-legacy-tv={legacyTelevision ? "true" : "false"}
        data-input-mode={deviceProfile?.remoteUi ? "remote" : deviceProfile?.touchUi ? "touch" : undefined}
        className={`${embedded ? `settings-embedded ${maintenanceOnly ? "settings-maintenance" : ""}` : ""} settings-modal-backdrop fixed inset-0 bg-[oklch(14.5%_0_0)]/80 z-50 flex items-center justify-center ${legacyTelevision ? "" : "backdrop-blur-xl"}`}
        onClick={showAdminAuth ? undefined : onClose}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          if (showAdminAuth) setShowAdminAuth(false);
          else onClose();
        }}
      >
        <motion.div
          initial={legacyTelevision ? false : { opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={legacyTelevision ? { duration: 0 } : undefined}
          onClick={(e) => e.stopPropagation()}
          // The PIN keypad is its own card; drawing the settings card behind it
          // read as two stacked dialogs. On touch the card keeps one height so
          // the footer does not jump between the Wi-Fi and Bluetooth lists.
          data-auth={showAdminAuth ? "true" : undefined}
          className={`settings-modal-card rounded-2xl w-full max-w-4xl max-h-[85dvh] in-data-[input-mode=touch]:h-[85dvh] overflow-hidden flex flex-col border ${
            showAdminAuth ? "bg-transparent border-transparent" : "bg-[oklch(20.5%_0_0)] border-[oklch(26.9%_0_0)]"
          }`}
        >
          {showAdminAuth ? (
            <div className="flex-1 overflow-y-auto">
              <div className="admin-auth-shell min-h-full p-8 flex items-center justify-center">
                <AdminAuth
                  onAuthenticated={() => { onEnterAdmin(); setShowAdminAuth(false); }}
                  onCancel={() => setShowAdminAuth(false)}
                  remoteMode={!!deviceProfile?.remoteUi}
                  controllerName={deviceProfile?.controllerName}
                  hasHardwareKeyboard={!!deviceProfile?.hasHardwareKeyboard}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="settings-modal-header shrink-0 flex items-center justify-between p-8 border-b border-[oklch(26.9%_0_0)]">
                <h2 className="text-3xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Settings</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-[oklch(26.9%_0_0)] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  aria-label="Close settings"
                  title="Close settings"
                >
                  <X className="w-6 h-6 text-[oklch(70.8%_0_0)]" />
                </button>
              </div>

              <div role="tablist" aria-label="Connectivity"
                className="settings-modal-tabs shrink-0 flex items-center gap-4 p-8 border-b border-[oklch(26.9%_0_0)]">
                <button
                  role="tab"
                  aria-selected={activeTab === "wifi"}
                  ref={(element) => { tabRefs.current.wifi = element; }}
                  onClick={() => setActiveTab("wifi")}
                  onKeyDown={(event) => handleSettingsTabKeyDown("wifi", event)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-lg transition-colors ${
                    activeTab === "wifi"
                      ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                      : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  <Wifi className="w-5 h-5" />
                  Wi-Fi
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "bluetooth"}
                  ref={(element) => { tabRefs.current.bluetooth = element; }}
                  onClick={() => setActiveTab("bluetooth")}
                  onKeyDown={(event) => handleSettingsTabKeyDown("bluetooth", event)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-lg transition-colors ${
                    activeTab === "bluetooth"
                      ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                      : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  <Bluetooth className="w-5 h-5" />
                  Bluetooth
                </button>

                <div className="flex-1" />

                {!(activeTab === "wifi" && usesFireWifiSettings) && <button
                  ref={browseNetworksRef}
                  onClick={() => {
                    if (activeTab === "wifi") {
                      if (usesFireWifiSettings) void openFireWifiSettings();
                      else if (wifiListVisible) scanWifi();
                      else setWifiListExpanded(true);
                    } else {
                      scanBluetooth();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      event.stopPropagation();
                      tabRefs.current[activeTab]?.focus();
                      return;
                    }
                    if (event.key !== "ArrowDown") return;
                    event.preventDefault();
                    event.stopPropagation();
                    const [firstBodyControl] = settingsBodyFocusableElements();
                    if (firstBodyControl) firstBodyControl.focus();
                    else focusFirstFooterAction();
                  }}
                  disabled={wifiScanning || btScanning}
                  aria-expanded={activeTab === "wifi" && !usesFireWifiSettings ? wifiListVisible : undefined}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)] transition-colors disabled:opacity-50"
                  style={{ fontWeight: 500 }}
                >
                  {(activeTab === "wifi" ? wifiScanning : btScanning)
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : usesFireWifiSettings && activeTab === "wifi"
                      ? <ExternalLink className="w-4 h-4" />
                      : <RefreshCw className="w-4 h-4" />}
                  {activeTab === "wifi"
                    ? (usesFireWifiSettings
                        ? "Open Fire Wi-Fi settings"
                        : (wifiListVisible ? "Refresh networks" : "Browse networks"))
                    : (!btScanning ? "Scan for devices" : "Scanning")}
                </button>}
              </div>

              <div
                ref={settingsBodyRef}
                onKeyDownCapture={handleSettingsBodyKeyDownCapture}
                className="settings-modal-body min-h-0 flex-1 overflow-y-auto p-8"
              >
                {activeTab === "wifi" && usesFireWifiSettings && (
                  <div className="fire-wifi-panel mx-auto w-full max-w-3xl">
                    <div className="rounded-xl border border-[oklch(38%_0_0)] bg-[oklch(23%_0_0)] p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <Wifi className="size-7 text-[oklch(65%_0.19_255)]" />
                        <p className="text-2xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 600 }}>Wi-Fi</p>
                      </div>
                      <div className="mb-3 flex min-h-14 items-center gap-4 rounded-xl border border-[oklch(36%_0_0)] bg-[oklch(18%_0_0)] px-4 py-3 text-left">
                        <Wifi className={`size-5 shrink-0 ${fireWifi.connected ? "text-[oklch(65%_0.19_255)]" : "text-[oklch(58%_0_0)]"}`} />
                        <div className="min-w-0">
                          <p className="truncate text-base text-[oklch(94%_0_0)]" style={{ fontWeight: 500 }}>
                            {fireWifi.connected && fireWifi.ssid ? `Connected to ${fireWifi.ssid}` : "Not connected"}
                          </p>
                          <p className="text-sm text-[oklch(62%_0_0)]">{touch ? "Managed by Fire OS" : "Saved networks stay in Fire OS."}</p>
                        </div>
                      </div>
                      {wifiError && (
                        <div className="mb-4 p-3 bg-[oklch(63.7%_0.237_25.331)]/10 border border-[oklch(63.7%_0.237_25.331)]/30 rounded-lg text-[oklch(70.4%_0.191_22.216)] text-sm">
                          {touch ? "Wi-Fi unavailable" : wifiError}
                        </div>
                      )}
                      <button
                        ref={browseNetworksRef}
                        type="button"
                        onClick={() => void openFireWifiSettings()}
                        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[oklch(48.8%_0.243_264.376)] px-5 py-3 text-base text-white transition-colors hover:brightness-110 disabled:bg-[oklch(29%_0_0)] disabled:text-[oklch(58%_0_0)]"
                        style={{ fontWeight: 600 }}
                      >
                        <span className="relative"><Wifi className="size-5" /><Plus className="absolute -bottom-1 -right-1 size-3.5" /></span>
                        Add a network
                      </button>
                      <p className="touch-settings-explainer mt-2 text-center text-sm text-[oklch(62%_0_0)]">
                        Opens Fire OS Wi-Fi.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "wifi" && !usesFireWifiSettings && usesTvWifiPicker && !wifiListVisible && (
                  <div className="h-full min-h-48 flex items-center justify-center text-center">
                    <div className="max-w-lg">
                      <Wifi className="w-9 h-9 mx-auto mb-4 text-[oklch(55.6%_0_0)]" />
                      <p className="text-[oklch(87%_0_0)] mb-2" style={{ fontWeight: 500 }}>
                        Wi-Fi network list is collapsed
                      </p>
                      <p className="text-[oklch(55.6%_0_0)] text-sm">
                        Select Browse networks to scan and navigate available Wi-Fi. Leave it collapsed to move directly to Admin Mode.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "wifi" && !usesFireWifiSettings && wifiListVisible && (
                  <div className="system-list space-y-3">
                    {wifiError && (
                      <div className="p-4 bg-[oklch(63.7%_0.237_25.331)]/10 border border-[oklch(63.7%_0.237_25.331)]/30 rounded-lg text-[oklch(70.4%_0.191_22.216)] text-sm">
                        {touch ? "Wi-Fi unavailable" : wifiError}
                      </div>
                    )}
                    {wifiScanning && networks.length === 0 && (
                      <div aria-live="polite" className="flex items-center justify-center gap-3 p-8 text-[oklch(55.6%_0_0)]">
                        <Loader2 className="w-5 h-5 animate-spin" /> Scanning for networks…
                      </div>
                    )}
                    {networks.map((network) => (
                      <div
                        key={network.ssid}
                        data-wifi-row={network.ssid}
                        className="system-list-row p-5 bg-[oklch(26.9%_0_0)] rounded-lg border border-[oklch(26.9%_0_0)] hover:border-[oklch(43.9%_0_0)] focus-within:border-white/70 focus-within:ring-4 focus-within:ring-white/80 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          {!network.connected && connect.phase !== "connecting" ? (
                            <button
                              type="button"
                              onClick={() => startConnect(network)}
                              onFocus={() => { lastFocusedSsidRef.current = network.ssid; }}
                              aria-label={`Connect to ${network.ssid}, ${network.secured ? "secured" : "open"}, ${wifiSignalLabel(network.signal)} signal`}
                              className="-m-2 flex min-w-0 flex-1 items-center justify-between gap-4 rounded-lg p-2 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                            >
                              <span className="flex min-w-0 items-center gap-4">
                                <Wifi className="w-5 h-5 shrink-0 text-[oklch(70.8%_0_0)]" />
                                <span className="min-w-0">
                                  <span className="flex items-center gap-2 truncate text-lg text-[oklch(98.5%_0_0)]" style={{ fontWeight: 400 }}>
                                    {network.ssid}
                                    {network.secured && <Lock className="w-3.5 h-3.5 shrink-0 text-[oklch(55.6%_0_0)]" />}
                                  </span>
                                  <span className="block text-sm text-[oklch(55.6%_0_0)]" style={{ fontWeight: 400 }}>
                                    {touch && network.connected && network.canForget === false ? "Managed" : <>{network.secured ? "" : "Open • "}{wifiSignalLabel(network.signal)} signal</>}
                                  </span>
                                </span>
                              </span>
                              <span className="wifi-connect-label shrink-0 rounded-lg bg-[oklch(48.8%_0.243_264.376)] px-4 py-2 text-sm text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>
                                Connect
                              </span>
                            </button>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                              <Wifi className="w-5 h-5 shrink-0 text-[oklch(70.8%_0_0)]" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 truncate text-lg text-[oklch(98.5%_0_0)]" style={{ fontWeight: 400 }}>
                                  {network.ssid}
                                  {network.secured && <Lock className="w-3.5 h-3.5 shrink-0 text-[oklch(55.6%_0_0)]" />}
                                </div>
                                <div className="text-[oklch(55.6%_0_0)] text-sm" style={{ fontWeight: 400 }}>
                                  {touch && network.connected && network.canForget === false ? "Managed" : <>{network.secured ? "" : "Open • "}{wifiSignalLabel(network.signal)} signal</>}
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex gap-3">
                            {network.connected ? (
                              <>
                                <span className="system-connected inline-flex items-center text-[oklch(80%_0.12_150)] text-sm px-4 py-2 bg-[oklch(52%_0.14_150)]/15 rounded-lg" style={{ fontWeight: 500 }}>
                                  <Check className="system-connected-check" aria-hidden="true" />Connected
                                </span>
                                {(!touch || network.canForget === true) && (touch ? <WifiForgetAction
                                  ssid={network.ssid} canForget={network.canForget === true}
                                  onForget={() => void handleForgetWifi(network.ssid)} /> : (
                                <button
                                  onClick={() => handleForgetWifi(network.ssid)}
                                  onFocus={() => { lastFocusedSsidRef.current = network.ssid; }}
                                  aria-label={`Forget ${network.ssid}`}
                                  className="border border-[oklch(63.7%_0.237_25.331)]/40 px-4 py-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                                  style={{ fontWeight: 500 }}
                                >
                                  Forget
                                </button>
                                ))}
                              </>
                            ) : connect.phase === "connecting" && connect.ssid === network.ssid ? (
                              <span className="flex items-center gap-2 text-[oklch(70.8%_0_0)] text-sm px-4 py-2" style={{ fontWeight: 500 }}>
                                <Loader2 className="w-4 h-4 animate-spin" /> Connecting…
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {forgetError === network.ssid && <p role="status" className="settings-row-status">Could not forget network</p>}
                        {connect.phase === "password" && connect.ssid === network.ssid && (
                          <form
                            className="mt-4 flex gap-3"
                            onSubmit={(e) => { e.preventDefault(); submitConnect(network.ssid, password); }}
                          >
                            <div className="relative flex-1">
                              <input
                                ref={passwordInputRef}
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Network password"
                                autoComplete="current-password"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                enterKeyHint="go"
                                aria-label="Network password"
                                className="w-full pl-4 pr-16 py-2.5 bg-[oklch(14.5%_0_0)] border border-[oklch(43.9%_0_0)] rounded-lg text-[oklch(98.5%_0_0)] placeholder:text-[oklch(43.9%_0_0)] outline-none focus:border-[oklch(48.8%_0.243_264.376)] focus-visible:ring-2 focus-visible:ring-white/80"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                              >
                                {showPassword ? "Hide" : "Show"}
                              </button>
                            </div>
                            <button
                              type="submit"
                              disabled={password.length < 8}
                              className="wifi-join px-5 py-2.5 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg disabled:opacity-40 text-sm"
                              style={{ fontWeight: 500 }}
                            >
                              Join
                            </button>
                            <button
                              type="button"
                              onClick={() => setConnect({ phase: "idle" })}
                              className="wifi-cancel px-5 py-2.5 bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] rounded-lg text-sm border border-[oklch(43.9%_0_0)]"
                              style={{ fontWeight: 500 }}
                            >
                              Cancel
                            </button>
                          </form>
                        )}

                        {(connect.phase === "pending-approval" || connect.phase === "failed") && connect.ssid === network.ssid && (
                          <div className="mt-4 p-4 bg-[oklch(14.5%_0_0)] rounded-lg text-sm text-[oklch(70.8%_0_0)] space-y-3">
                            <p>
                              {connect.phase === "failed"
                                ? (touch ? "Could not connect" : (connect as any).message)
                                : touch ? "Awaiting approval" : `Android hasn't joined this network yet. It may need approval in a system notification, or the password may be wrong.${canOpenWifiPanel ? " You can also connect from system settings." : ""}`}
                            </p>
                            <div className="flex gap-3">
                              {canOpenWifiPanel && (
                                <button
                                  onClick={() => SystemBridge.openWifiSettings()}
                                  className="flex items-center gap-2 px-4 py-2 bg-[oklch(26.9%_0_0)] rounded-lg text-[oklch(87%_0_0)]"
                                  style={{ fontWeight: 500 }}
                                >
                                  <ExternalLink className="w-4 h-4" /> Open Wi-Fi settings
                                </button>
                              )}
                              <button
                                onClick={() => setConnect({ phase: "idle" })}
                                className="px-4 py-2 bg-[oklch(26.9%_0_0)] rounded-lg"
                                style={{ fontWeight: 500 }}
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {!wifiScanning && networks.length === 0 && !wifiError && (
                      <div className="text-center p-8 text-[oklch(55.6%_0_0)]">No networks found</div>
                    )}
                    {usesTvWifiPicker && (
                      <button
                        type="button"
                        onClick={() => {
                          setWifiListExpanded(false);
                          window.setTimeout(() => browseNetworksRef.current?.focus(), 0);
                        }}
                        className="w-full px-5 py-3 bg-[oklch(26.9%_0_0)] text-[oklch(87%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                        style={{ fontWeight: 500 }}
                      >
                        Done browsing networks
                      </button>
                    )}
                  </div>
                )}

                {activeTab === "bluetooth" && (
                  <div className="system-list space-y-3">
                    {/* Bluetooth on/off toggle */}
                    <div className="system-list-row flex items-center justify-between p-5 bg-[oklch(26.9%_0_0)] rounded-lg border border-[oklch(26.9%_0_0)]">
                      <div className="flex items-center gap-4">
                        <Bluetooth className={`w-5 h-5 ${btEnabled ? "text-[oklch(48.8%_0.243_264.376)]" : "text-[oklch(55.6%_0_0)]"}`} />
                        <div>
                          <div className="text-[oklch(98.5%_0_0)] text-lg" style={{ fontWeight: 400 }}>Bluetooth</div>
                          <div className="text-[oklch(55.6%_0_0)] text-sm" style={{ fontWeight: 400 }}>
                            {btToggling
                              ? "Waiting for confirmation…"
                              : btEnabled ? "On" : "Off"}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => btEnabled !== null && toggleBluetooth(!btEnabled)}
                        disabled={btToggling || btEnabled === null}
                        data-touch-switch
                        data-checked={btEnabled === true}
                        className={`relative w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${
                          btEnabled ? "bg-[oklch(48.8%_0.243_264.376)]" : "bg-[oklch(43.9%_0_0)]"
                        }`}
                        aria-label={btEnabled ? "Turn Bluetooth off" : "Turn Bluetooth on"}
                      >
                        <span
                          className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${
                            btEnabled ? "left-7" : "left-1"
                          }`}
                        />
                      </button>
                    </div>

                    {btError && (
                      <div className="p-4 bg-[oklch(63.7%_0.237_25.331)]/10 border border-[oklch(63.7%_0.237_25.331)]/30 rounded-lg text-[oklch(70.4%_0.191_22.216)] text-sm">
                        {touch ? (btEnabled === false ? "Bluetooth off" : "Bluetooth unavailable") : btError}
                      </div>
                    )}
                    {btScanning && (
                      <div className="flex items-center justify-center gap-3 p-4 text-[oklch(55.6%_0_0)]">
                        <Loader2 className="w-5 h-5 animate-spin" /> {touch ? "Scanning…" : "Scanning for nearby devices (~12s)…"}
                      </div>
                    )}
                    {btDevices.map((device) => (
                      <div
                        key={device.address}
                        data-bt-device={device.address}
                        onFocusCapture={() => { lastFocusedBtDeviceRef.current = device.address; }}
                        className="system-list-row flex items-center justify-between p-5 bg-[oklch(26.9%_0_0)] rounded-lg border border-[oklch(26.9%_0_0)] hover:border-[oklch(43.9%_0_0)] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <Bluetooth className="w-5 h-5 text-[oklch(70.8%_0_0)]" />
                          <div>
                            <div className="text-[oklch(98.5%_0_0)] text-lg" style={{ fontWeight: 400 }}>{device.name}</div>
                            <div className="text-[oklch(55.6%_0_0)] text-sm" style={{ fontWeight: 400 }}>
                              {device.connected ? "Connected" : device.paired ? "Paired" : "Available"}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          {device.connected ? (
                            <>
                              <span className="system-connected inline-flex items-center text-[oklch(80%_0.12_150)] text-sm px-4 py-2 bg-[oklch(52%_0.14_150)]/15 rounded-lg" style={{ fontWeight: 500 }}>
                                <Check className="system-connected-check" aria-hidden="true" />Connected
                              </span>
                              {touch ? <RemoveButton itemTitle={device.name} onRemove={() => void handleUnpair(device)}
                                icon={<span>Forget</span>} className="settings-destructive" /> : (
                              <button
                                onClick={() => handleUnpair(device)}
                                className="px-4 py-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors text-sm"
                                style={{ fontWeight: 500 }}
                              >
                                Forget
                              </button>
                              )}
                            </>
                          ) : pairingAddress === device.address ? (
                            <span className="flex items-center gap-2 text-[oklch(70.8%_0_0)] text-sm px-4 py-2" style={{ fontWeight: 500 }}>
                              <Loader2 className="w-4 h-4 animate-spin" /> Pairing…
                            </span>
                          ) : device.paired ? (
                            <>
                              {isAdmin && isStandalone ? (
                                <button
                                  onClick={() => SystemBridge.openBluetoothSettings()}
                                  className="px-4 py-2 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors text-sm"
                                  style={{ fontWeight: 500 }}
                                  title="Paired devices reconnect automatically when turned on; open settings to connect manually"
                                >
                                  Connect
                                </button>
                              ) : (
                                <span
                                  className="text-[oklch(55.6%_0_0)] text-sm px-4 py-2"
                                  style={{ fontWeight: 500 }}
                                  title="Paired devices reconnect automatically when powered on"
                                >
                                  Paired
                                </span>
                              )}
                              {touch ? <RemoveButton itemTitle={device.name} onRemove={() => void handleUnpair(device)}
                                icon={<span>Forget</span>} className="settings-destructive" /> : (
                              <button
                                onClick={() => handleUnpair(device)}
                                className="px-4 py-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors text-sm"
                                style={{ fontWeight: 500 }}
                              >
                                Forget
                              </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handlePair(device)}
                              className="px-4 py-2 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors text-sm"
                              style={{ fontWeight: 500 }}
                            >
                              Pair
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {!btScanning && btDevices.length === 0 && !btError && (
                      <div className="text-center p-8 text-[oklch(55.6%_0_0)]">
                        {btEnabled
                          ? (touch ? "No devices found" : "No devices found. Put a device in pairing mode, then Scan.")
                          : (touch ? "Bluetooth off" : "Turn on Bluetooth to pair controllers, headsets and other devices")}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="settings-modal-footer shrink-0 border-t border-[oklch(26.9%_0_0)] p-8 flex gap-4 items-center">
                {isAdmin ? (
                  <>
                    <button
                      data-settings-admin-nav
                      ref={(element) => { footerRefs.current.adminPanel = element; }}
                      onClick={onOpenAdminPanel}
                      onKeyDown={(event) => handleFooterKeyDown("adminPanel", event)}
                      className="flex items-center gap-3 px-6 py-4 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <LayoutGrid className="w-5 h-5" />
                      Admin Panel
                    </button>
                    <button
                      data-settings-admin-nav
                      ref={(element) => { footerRefs.current.exitAdmin = element; }}
                      onClick={onExitAdmin}
                      onKeyDown={(event) => handleFooterKeyDown("exitAdmin", event)}
                      className="flex items-center gap-3 px-6 py-4 bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] rounded-lg hover:bg-[oklch(43.9%_0_0)] transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Shield className="w-5 h-5" />
                      Exit Admin
                    </button>
                  </>
                ) : (
                  <button
                    ref={(element) => { footerRefs.current.adminMode = element; }}
                    onClick={() => setShowAdminAuth(true)}
                    onKeyDown={(event) => handleFooterKeyDown("adminMode", event)}
                    className="flex items-center gap-3 px-6 py-4 bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] rounded-lg hover:bg-[oklch(43.9%_0_0)] transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Shield className="w-5 h-5" />
                    Admin Mode
                  </button>
                )}

                {/* Standalone-only: exiting the kiosk requires admin auth first. */}
                {isStandalone && isAdmin && (
                  <button
                    ref={(element) => { footerRefs.current.exitKiosk = element; }}
                    onClick={async () => {
                      setKioskExitNotice(null);
                      const result = await onExitKiosk();
                      if (result && result.message) setKioskExitNotice(result.message);
                    }}
                    onKeyDown={(event) => handleFooterKeyDown("exitKiosk", event)}
                    className="flex items-center gap-3 px-6 py-4 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <LogOut className="w-5 h-5" />
                    Exit Kiosk
                  </button>
                )}
                {kioskExitNotice && (
                  <div
                    role="status"
                    className="basis-full mt-3 p-4 bg-[oklch(63.7%_0.237_25.331)]/10 border border-[oklch(63.7%_0.237_25.331)]/30 rounded-lg text-[oklch(70.4%_0.191_22.216)] text-sm"
                  >
                    {touch ? "Could not exit kiosk" : kioskExitNotice}
                  </div>
                )}

                <div className="flex-1" />

                {/* Authenticated standalone admins need the complete Android
                    Settings surface for maintenance such as authorizing ADB.
                    Companion TVs keep this hidden because their DPC owns the
                    allowed settings surface. */}
                {canOpenFullSystemSettings && (
                  <button
                    ref={(element) => { footerRefs.current.systemSettings = element; }}
                    onClick={openFullSystemSettings}
                    onKeyDown={(event) => handleFooterKeyDown("systemSettings", event)}
                    aria-label="Open full Android system settings"
                    className="flex items-center gap-2 px-5 py-4 text-[oklch(55.6%_0_0)] hover:text-[oklch(87%_0_0)] transition-colors text-sm"
                    style={{ fontWeight: 500 }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Full system settings
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
