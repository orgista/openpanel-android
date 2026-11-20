import { describe, expect, it } from "vitest";

import { SystemBridge } from "./SystemBridge";

describe("SystemBridge web fallback", () => {
  it("does not seed deployable app content in the preview inventory", async () => {
    const { apps } = await SystemBridge.getInstalledApps();
    expect(apps).toEqual([]);
  });

  it("supports an atomic kiosk exit to the standard system launcher", async () => {
    await expect(SystemBridge.exitKioskToSystemHome()).resolves.toMatchObject({
      exited: true,
      launcherPackage: null,
    });
  });

  // Item 3: enableKioskLock/disableKioskLock/exitKioskToSystemHome/
  // clearDeviceOwner/setManagementMode/openLauncherSettings/
  // setKeyguardDisabled/setDnsFilterAlwaysOn/the debloat mutators all widened
  // to accept an optional adminToken, and setKioskAdminVerifier mirrors the
  // verifier into native prefs. The web fallback accepts the wider call shape
  // (adminToken is a native-only concern; the mock ignores it) without a type
  // error or a runtime rejection.
  it("accepts the widened adminToken-carrying call shape (web fallback)", async () => {
    await expect(SystemBridge.setKioskAdminVerifier({ verifier: "test-verifier" }))
      .resolves.toBeUndefined();
    await expect(SystemBridge.exitKioskToSystemHome({ adminToken: "test-verifier" }))
      .resolves.toMatchObject({ exited: true });
    await expect(SystemBridge.enableKioskLock({ packages: [], adminToken: "test-verifier" }))
      .resolves.toMatchObject({ status: "pinned" });
    await expect(SystemBridge.disableKioskLock({ adminToken: "test-verifier" }))
      .resolves.toBeUndefined();
    await expect(SystemBridge.clearDeviceOwner({ adminToken: "test-verifier" }))
      .resolves.toMatchObject({ cleared: true });
    await expect(SystemBridge.setManagementMode({ mode: "standalone", adminToken: "test-verifier" }))
      .resolves.toMatchObject({ mode: "standalone" });
    await expect(SystemBridge.openLauncherSettings({ adminToken: "test-verifier" }))
      .resolves.toBeUndefined();
    await expect(SystemBridge.setKeyguardDisabled({ disabled: true, adminToken: "test-verifier" }))
      .resolves.toMatchObject({ disabled: true });
  });

  it("supports the playback screen-awake contract", async () => {
    await expect(SystemBridge.setKeepScreenOn({ enabled: true })).resolves.toBeUndefined();
    await expect(SystemBridge.setKeepScreenOn({ enabled: false })).resolves.toBeUndefined();
  });

  it("reports the TV DNS filter without claiming that encrypted DNS is filtering", async () => {
    await expect(SystemBridge.getDnsFilterStatus()).resolves.toMatchObject({
      filterPackage: "dnsfilter.android",
      installed: true,
      enabled: true,
      vpnActive: true,
      filterActive: true,
      alwaysOn: true,
      lockdown: false,
      privateDnsMode: "off",
      privateDnsHost: null,
      canManageAlwaysOn: true,
    });

    await expect(SystemBridge.setDnsFilterAlwaysOn({ enabled: true }))
      .resolves.toMatchObject({ alwaysOn: true, filterActive: true });
    await expect(SystemBridge.openDnsFilter()).resolves.toBeUndefined();
    await expect(SystemBridge.openVpnSettings()).resolves.toBeUndefined();
    await expect(SystemBridge.openPrivateDnsSettings()).resolves.toBeUndefined();
  });

  it("detects device health and reversibly manages reviewed optional apps", async () => {
    await expect(SystemBridge.getDeviceHealth()).resolves.toMatchObject({
      manufacturer: "Lenovo",
      model: "Tab M10 Plus",
      profile: "lenovo",
      ramUsedPercent: 50,
      canManageApps: true,
      manageNotifications: true,
    });

    const detected = await SystemBridge.getDebloatApps();
    expect(detected.apps.map((app) => app.packageName)).toEqual(expect.arrayContaining([
      "com.google.android.youtube",
      "com.google.android.keep",
      "com.lenovo.hec.lenovoextend",
    ]));

    const optimized = await SystemBridge.applyRecommendedDebloat({ manageNotifications: true });
    expect(optimized.available).toBe(true);
    expect(optimized.apps?.every((app) => app.hidden)).toBe(true);

    const restored = await SystemBridge.restoreDebloatApps();
    expect(restored.restored).toBeGreaterThan(0);
    expect(restored.apps?.every((app) => !app.hidden)).toBe(true);

    await expect(SystemBridge.setNotificationManagement({ enabled: false }))
      .resolves.toMatchObject({ available: true, enabled: false });
  });

  it("exposes Google TV input capabilities without seeding channel content", async () => {
    await expect(SystemBridge.getDeviceProfile()).resolves.toMatchObject({
      deviceType: "television",
      isTelevision: true,
      isTablet: false,
      hasDpad: true,
      hasBattery: false,
      remoteUi: true,
      touchUi: false,
      showBattery: false,
      supportsLeanbackApps: true,
      voiceInputAvailable: true,
    });
    await expect(SystemBridge.requestVoiceInput({ prompt: "Search YouTube" })).resolves.toEqual({
      text: "",
    });
    await expect(SystemBridge.resolveYouTubeChannel({ input: "example channel" }))
      .rejects.toThrow("installed Android app");
    await expect(SystemBridge.getYouTubeChannelVideos({
      channelId: "UCfPyVJEBD7Di1YYjTdS2v8g",
    })).rejects.toThrow("installed Android app");
  });
});
