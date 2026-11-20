import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  AdminPanel,
  adminTabsForDevice,
  kioskActionErrorMessage,
  resetAdminPanelScroll,
} from "./AdminPanel";

describe("AdminPanel", () => {
  it("returns the same four tabs regardless of standalone or TV status", () => {
    expect(adminTabsForDevice(true, true)).toEqual(["apps", "content", "general", "health"]);
    expect(adminTabsForDevice(false, false)).toEqual(["apps", "content", "general", "health"]);
  });

  it("returns the scrollable content to the top when changing sections", () => {
    const panel = { scrollTop: 280 } as HTMLDivElement;

    resetAdminPanelScroll(panel);

    expect(panel.scrollTop).toBe(0);
  });

  it("surfaces native kiosk failures without losing the useful explanation", () => {
    expect(kioskActionErrorMessage(new Error("Fire OS did not enter screen pinning.")))
      .toBe("Fire OS did not enter screen pinning.");
    expect(kioskActionErrorMessage("not-an-error")).toBe("The kiosk action failed.");
  });

  it("provides an accessible, authenticated Admin reset control", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone={false}
        appMode="companion"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="general"
      />,
    );

    expect(html).toContain("Admin Access");
    expect(html).toContain("data-dpad-scope");
    expect(html).toContain('aria-label="Close Admin Panel"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('value="5"');
  });

  it("keeps an empty Applications section reachable by a TV remote", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone={true}
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
      />,
    );

    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="No allowed applications"');
    expect(html).toContain('aria-label="No additional applications"');
    expect(html).toContain("data-dpad-content");
  });

  it("keeps Device Health and its notification policy reachable from admin", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        manageNotifications
        onSetManageNotifications={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="health"
      />,
    );

    expect(html).toContain("Device Health");
    expect(html).toContain("Detecting this device");
  });

  it("shows DNS and telemetry controls only for the detected TV profile", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
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
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="health"
      />,
    );

    expect(html).toContain("DNS &amp; Telemetry");
    expect(html).toContain("personalDNSfilter");
    expect(html).toContain("Detecting network protection");
  });

  it("does not let the active management mode restart setup", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="general"
      />,
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-pressed="true"[^>]*>[^<]*<svg[^>]*>[\s\S]*?Standalone<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>[\s\S]*?Companion \(ArborXR\)<\/button>/);
  });

  it("shows a waiting Android update only when OpenPanel is the Device Owner", () => {
    const status = { deviceOwner: true, deviceAdmin: true, arborXrManaged: false, defaultLauncher: true,
      homeControlMode: "native" as const, lockTaskActive: true, lockTaskMode: "locked" as const,
      managementMode: "standalone" as const, kioskEnabled: true, systemUpdateWaitingSince: 1_794_632_660_587 };
    const render = (kioskStatus: typeof status) => renderToStaticMarkup(
      <AdminPanel isOpen onClose={vi.fn()} apps={[]} availableApps={[]} onAddApp={vi.fn()} onRemoveApp={vi.fn()}
        inactivityTimeout={5} onSetInactivityTimeout={vi.fn()} allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()} videos={[]} onAddVideo={vi.fn(() => true)} onRemoveVideo={vi.fn()}
        standalone appMode="standalone" onSetAppMode={vi.fn()} kioskStatus={kioskStatus} onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()} onRequestDeviceAdmin={vi.fn()} onLockKiosk={vi.fn()} onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()} onResetAdmin={vi.fn()} initialTab="general" />,
    );
    expect(render(status)).toContain("System update waiting");
    expect(render({ ...status, systemUpdateWaitingSince: null })).not.toContain("System update waiting");
    expect(render({ ...status, deviceOwner: false, arborXrManaged: true })).not.toContain("System update waiting");
  });

  it("shows only the redirect kiosk path on Fire OS", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
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
          voiceInputAvailable: false,
          controllerName: null,
        }}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={{
          deviceOwner: false,
          deviceAdmin: true,
          arborXrManaged: false,
          defaultLauncher: false,
          homeControlMode: "fire-redirect",
          lockTaskActive: false,
          lockTaskMode: "none",
          managementMode: "standalone",
          kioskEnabled: true,
        }}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="general"
      />,
    );

    expect(html).toContain("Disable Fire kiosk");
    expect(html).not.toContain("ArborXR");
    expect(html).not.toContain("Device Owner");
    expect(html).not.toContain("provisioning QR");
  });

  it("exposes standards-based Books & Audio management", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        libraryEnabled={false}
        onSetLibraryEnabled={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="content"
      />,
    );

    expect(html).toContain("Books &amp; Audio");
    expect(html).toContain("Show Books &amp; Audio on Home");
    expect(html).toContain('aria-label="Show Books and Audio on Home"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Import file");
    expect(html).toContain("Institutional catalogs");
  });

  it("does not show Books & Audio controls on televisions", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        libraryEnabled
        onSetLibraryEnabled={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
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
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="content"
      />,
    );

    expect(html).not.toContain("Books &amp; Audio");
    expect(html).toContain("YouTube Videos, Channels &amp; Playlists");
  });

  it("explains that videos, channels, and playlists are supported", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
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
        standalone={false}
        appMode="companion"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="content"
      />,
    );

    expect(html).toContain("YouTube Videos, Channels &amp; Playlists");
    expect(html).toContain("Same channel recommendations");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Allowed YouTube Sources (0)");
    expect(html).toContain("Add a YouTube channel");
    expect(html).not.toContain("No API key");
    expect(html).toContain('aria-label="Enter channel by voice"');
    expect(html).toContain("press your remote&#x27;s microphone button");
    expect(html).toContain("Verify channel");
    expect(html).toContain("channel name or @handle");
    expect(html).toContain("Add a YouTube Video");
    expect(html).toContain("youtube.com video, playlist, or channel URL");
    expect(html).not.toContain("YouTube Data API key");
  });

  it("lets a touch admin add web links by hand unless the links are managed", () => {
    const props = {
      isOpen: true, apps: [], availableApps: [], videos: [], inactivityTimeout: 5, standalone: false, appMode: "companion",
      kioskStatus: null, initialTab: "content", deviceProfile: { touchUi: true, remoteUi: false },
      links: [{ title: "Reading club", url: "https://example.org/kids" }], onSetLinks: vi.fn(),
    } as unknown as Parameters<typeof AdminPanel>[0];
    const local = renderToStaticMarkup(<AdminPanel {...props} />);
    expect(local).toContain('aria-label="Web address"');
    expect(local).toContain("Reading club");
    expect(local).toContain("example.org");
    expect(local).toContain('aria-label="Remove Reading club"');
    const managed = renderToStaticMarkup(<AdminPanel {...props} managedSettings={{ version: 1, links: [] }} />);
    expect(managed).not.toContain('aria-label="Web address"');
    expect(managed).toContain("Links · Managed");
    expect(renderToStaticMarkup(<AdminPanel {...props} deviceProfile={{ ...props.deviceProfile!, touchUi: false, remoteUi: true }} />))
      .not.toContain('aria-label="Web address"');
  });

  it("renders approved channel artwork as large circular icons", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[{
          id: "channel:pbs",
          kind: "channel",
          sourceId: "UUrNnk0wFBnCS1awGjq_ijGQ",
          sourceLabel: "UCrNnk0wFBnCS1awGjq_ijGQ",
          listType: "playlist",
          title: "PBS KIDS",
          thumbnailUrl: "https://yt3.googleusercontent.com/example=s900-c-k-c0x00ffffff-no-rj",
          addedAt: 1,
        }]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="content"
      />,
    );

    expect(html).toContain("PBS KIDS");
    expect(html).toContain("youtube-channel-art");
    expect(html).toContain("rounded-full");
    expect(html).toContain('loading="lazy"');
  });

  it("shows an authenticated persistent bug log with remote-reachable controls", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone
        appMode="standalone"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="general"
      />,
    );

    expect(html).toContain("Persistent Bug Log");
    expect(html).toContain("Refresh");
    expect(html).toContain("Clear");
  });

  it("labels the volume limit plainly and hides the unfinished custom screen saver", () => {
    const html = renderToStaticMarkup(
      <AdminPanel
        isOpen
        onClose={vi.fn()}
        apps={[]}
        availableApps={[]}
        onAddApp={vi.fn()}
        onRemoveApp={vi.fn()}
        inactivityTimeout={5}
        onSetInactivityTimeout={vi.fn()}
        allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()}
        videos={[]}
        onAddVideo={vi.fn(() => true)}
        onRemoveVideo={vi.fn()}
        standalone={false}
        appMode="companion"
        onSetAppMode={vi.fn()}
        kioskStatus={null}
        onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()}
        onRequestDeviceAdmin={vi.fn()}
        onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()}
        onResetAdmin={vi.fn()}
        initialTab="general"
      />,
    );

    expect(html).toContain(">Maximum volume<");
    expect(html).not.toContain("Cap maximum volume");
    expect(html).not.toContain("Hardware volume buttons cannot exceed this level.");
    expect(html).toContain("Start after");
    expect(html).not.toContain(">Style<");
    expect(html).not.toContain('value="custom"');
    expect(html).not.toContain("Choose file");
    expect(html).not.toContain("Show a dark clock after inactivity.");
  });
  describe("recommendation controls", () => {
    const profile = (touch: boolean) => ({
      deviceType: touch ? "tablet" as const : "television" as const, isTelevision: !touch, isTablet: touch, isHandheld: false,
      hasLeanback: !touch, hasTouchscreen: touch, hasDpad: !touch, hasHardwareKeyboard: false, smallestScreenWidthDp: 960,
      hasBattery: touch, remoteUi: !touch, touchUi: touch, showBattery: false, supportsLeanbackApps: !touch,
      voiceInputAvailable: true, controllerName: "",
    });
    const render = (touch: boolean, extra = {}) => renderToStaticMarkup(
      <AdminPanel isOpen onClose={vi.fn()} apps={[]} availableApps={[]} onAddApp={vi.fn()} onRemoveApp={vi.fn()}
        inactivityTimeout={5} onSetInactivityTimeout={vi.fn()} allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()} videos={[]} onAddVideo={vi.fn(() => true)} onRemoveVideo={vi.fn()}
        deviceProfile={profile(touch)} standalone appMode="standalone" onSetAppMode={vi.fn()} kioskStatus={null}
        onRefreshKiosk={vi.fn()} onSetDefaultLauncher={vi.fn()} onRequestDeviceAdmin={vi.fn()} onLockKiosk={vi.fn()}
        onUnlockKiosk={vi.fn()} onClearDeviceOwner={vi.fn()} onResetAdmin={vi.fn()} initialTab="content" {...extra} />);

    it("offers Off and three thresholds with After 5 videos selected by default, Autoplay next and a two-step history clear", () => {
      const html = render(true);
      for (const label of ["Off", "After 3 videos", "After 5 videos", "After 10 videos", "Autoplay next"]) expect(html).toContain(label);
      expect(html).toMatch(/aria-pressed="true"[^>]*>After 5 videos/);
      expect(html).toContain('aria-checked="false" aria-label="Autoplay next video"');
      expect(html).toContain('aria-label="Remove watch history"');
      expect(html).not.toContain("Confirm removing watch history");
    });

    it("reflects the stored choice", () => {
      const html = render(true, { recommendAfter: 0, autoplayNext: true });
      expect(html).toMatch(/aria-pressed="true"[^>]*>Off/);
      expect(html).toContain('aria-checked="true" aria-label="Autoplay next video"');
    });

    it("leaves the television admin panel unchanged", () => {
      const html = render(false);
      for (const label of ["After 5 videos", "Autoplay next", "watch history"]) expect(html).not.toContain(label);
    });
  });
});
