import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  listedBluetoothDevices,
  SettingsModal,
  settingsTabDownTarget,
  wifiSignalLabel,
} from "./SettingsModal";

describe("SettingsModal", () => {
  it("gives its icon-only close control an accessible name", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        onClose={vi.fn()}
        isStandalone={false}
        onExitKiosk={vi.fn()}
        isAdmin={false}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Close settings"');
    expect(html).toContain("settings-modal-backdrop");
    expect(html).toContain("settings-modal-card");
    // One card height on touch, so the footer stays put between tabs.
    expect(html).toContain("in-data-[input-mode=touch]:h-[85dvh]");
    expect(html).toContain("data-dpad-scope");
    expect(html).toContain("Refresh networks");
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain("Wi-Fi network list is collapsed");
  });

  it("keeps the collapsed Wi-Fi picker only for televisions", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        onClose={vi.fn()}
        isStandalone={false}
        onExitKiosk={vi.fn()}
        isAdmin={false}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "television",
          isTelevision: true,
          isTablet: false,
          isHandheld: false,
          hasLeanback: true,
          hasTouchscreen: false,
          hasDpad: true,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 960,
          hasBattery: false,
          remoteUi: true,
          touchUi: false,
          showBattery: false,
          supportsLeanbackApps: true,
          voiceInputAvailable: true,
          controllerName: "Google TV Remote",
        }}
      />,
    );

    expect(html).toContain("Browse networks");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Leave it collapsed to move directly to Admin Mode");
  });

  it("avoids compositor-heavy backdrop blur on legacy televisions", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        onClose={vi.fn()}
        isStandalone
        onExitKiosk={vi.fn()}
        isAdmin={false}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          sdk: 28,
          deviceType: "television",
          isTelevision: true,
          isTablet: false,
          isHandheld: false,
          hasLeanback: true,
          hasTouchscreen: false,
          hasDpad: true,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 960,
          hasBattery: false,
          remoteUi: true,
          touchUi: false,
          showBattery: false,
          supportsLeanbackApps: true,
          voiceInputAvailable: true,
          controllerName: null,
        }}
      />,
    );

    expect(html).toContain('data-legacy-tv="true"');
    expect(html).not.toContain("backdrop-blur-xl");
  });

  it("routes Fire OS Wi-Fi changes through the system-owned picker", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone
        isAdmin
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "tablet",
          isTelevision: false,
          isTablet: true,
          isHandheld: false,
          isFireOs: true,
          hasLeanback: false,
          hasTouchscreen: true,
          hasDpad: false,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 600,
          hasBattery: true,
          remoteUi: false,
          touchUi: true,
          showBattery: true,
          supportsLeanbackApps: false,
          voiceInputAvailable: true,
          controllerName: null,
        }}
      />,
    );

    expect(html).toContain(">Wi-Fi<");
    expect(html).toContain("Add a network");
    expect(html).toContain("Opens Fire OS Wi-Fi");
    expect(html.match(/Add a network/g)).toHaveLength(1);
    expect(html).not.toContain("Fire OS manages saved Wi-Fi networks");
    expect(html).not.toContain("Open Fire Wi-Fi settings");
    expect(html).not.toContain("OpenPanel will not create an app-owned network suggestion");
    expect(html).not.toContain("Refresh networks");
  });


  it("lets Fire OS guests open the system picker to add a network", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone
        isAdmin={false}
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "tablet",
          isTelevision: false,
          isTablet: true,
          isHandheld: false,
          isFireOs: true,
          hasLeanback: false,
          hasTouchscreen: true,
          hasDpad: false,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 600,
          hasBattery: true,
          remoteUi: false,
          touchUi: true,
          showBattery: true,
          supportsLeanbackApps: false,
          voiceInputAvailable: true,
          controllerName: null,
        }}
      />,
    );

    expect(html).toContain("Add a network");
    expect(html).toContain("Opens Fire OS Wi-Fi.");
    expect(html).not.toContain("Enter Admin Mode");

    const label = html.indexOf("Add a network");
    const addNetworkButton = html.slice(html.lastIndexOf("<button", label), label);
    expect(addNetworkButton).not.toContain('disabled=""');
  });

  it("lets guests turn Bluetooth on without offering to turn it off", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone
        isAdmin={false}
        initialTab="bluetooth"
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
      />,
    );

    expect(html).toContain(">Off<");
    expect(html).not.toContain("Admin only");
    expect(html).not.toContain("Changing Bluetooth requires admin mode");
  });

  it("maps Down to a usable TV target even while scanning", () => {
    expect(settingsTabDownTarget({
      activeTab: "wifi",
      usesTvWifiPicker: true,
      wifiListVisible: false,
      browseDisabled: false,
      hasBodyControl: false,
    })).toBe("footer");
    expect(settingsTabDownTarget({
      activeTab: "wifi",
      usesTvWifiPicker: true,
      wifiListVisible: true,
      browseDisabled: true,
      hasBodyControl: true,
    })).toBe("body");
    expect(settingsTabDownTarget({
      activeTab: "wifi",
      usesTvWifiPicker: false,
      wifiListVisible: true,
      browseDisabled: false,
      hasBodyControl: true,
    })).toBe("browse");
  });

  it("describes signal strength consistently for remote users", () => {
    expect(wifiSignalLabel(90)).toBe("Excellent");
    expect(wifiSignalLabel(60)).toBe("Good");
    expect(wifiSignalLabel(30)).toBe("Fair");
    expect(wifiSignalLabel(10)).toBe("Weak");
  });

  it("lists only paired, audio and controller devices on tablets", () => {
    const found = [
      { name: "Earbuds", address: "a", paired: false, connected: false, listenOrPlay: true },
      { name: "Lights", address: "b", paired: false, connected: false, listenOrPlay: false },
      { name: "Old speaker", address: "c", paired: true, connected: false },
      { name: "Unknown (d)", address: "d", paired: false, connected: false, unnamed: true, listenOrPlay: true },
    ];
    expect(listedBluetoothDevices(found, true).map(d => d.name)).toEqual(["Earbuds", "Old speaker"]);
    expect(listedBluetoothDevices(found, false).map(d => d.name)).toEqual(["Earbuds", "Lights", "Old speaker"]);
  });

  it("offers authenticated standalone users the full Android settings entry", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone
        isAdmin
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Open full Android system settings"');
    expect(html).toContain("Full system settings");
  });

  it("offers authenticated ArborXR tablet users the full Android settings entry", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone={false}
        isAdmin
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "tablet",
          isTelevision: false,
          isTablet: true,
          isHandheld: false,
          hasLeanback: false,
          hasTouchscreen: true,
          hasDpad: false,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 600,
          hasBattery: true,
          remoteUi: false,
          touchUi: true,
          showBattery: true,
          supportsLeanbackApps: false,
          voiceInputAvailable: true,
          controllerName: null,
        }}
      />,
    );

    expect(html).toContain('aria-label="Open full Android system settings"');
    expect(html).toContain("Full system settings");
  });

  it("hides full Android settings on ArborXR-managed tablets", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone={false}
        arborXrManaged
        isAdmin
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "tablet",
          isTelevision: false,
          isTablet: true,
          isHandheld: false,
          hasLeanback: false,
          hasTouchscreen: true,
          hasDpad: false,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 600,
          hasBattery: true,
          remoteUi: false,
          touchUi: true,
          showBattery: true,
          supportsLeanbackApps: false,
          voiceInputAvailable: true,
          controllerName: null,
        }}
      />,
    );

    expect(html).not.toContain("Full system settings");
  });

  it("keeps full Android settings hidden on ArborXR television builds", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone={false}
        isAdmin
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "television",
          isTelevision: true,
          isTablet: false,
          isHandheld: false,
          hasLeanback: true,
          hasTouchscreen: false,
          hasDpad: true,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 960,
          hasBattery: false,
          remoteUi: true,
          touchUi: false,
          showBattery: false,
          supportsLeanbackApps: true,
          voiceInputAvailable: true,
          controllerName: "Google TV Remote",
        }}
      />,
    );

    expect(html).not.toContain('aria-label="Open full Android system settings"');
  });

  it("offers full Android settings to authenticated standalone TV admins", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        isOpen
        isStandalone
        isAdmin
        onClose={vi.fn()}
        onExitKiosk={vi.fn()}
        onEnterAdmin={vi.fn()}
        onExitAdmin={vi.fn()}
        onOpenAdminPanel={vi.fn()}
        deviceProfile={{
          deviceType: "television",
          isTelevision: true,
          isTablet: false,
          isHandheld: false,
          hasLeanback: true,
          hasTouchscreen: false,
          hasDpad: true,
          hasHardwareKeyboard: false,
          smallestScreenWidthDp: 960,
          hasBattery: false,
          remoteUi: true,
          touchUi: false,
          showBattery: false,
          supportsLeanbackApps: true,
          voiceInputAvailable: true,
          controllerName: "Google TV Remote",
        }}
      />,
    );

    expect(html).toContain('aria-label="Open full Android system settings"');
    expect(html).toContain("Full system settings");
  });
});
