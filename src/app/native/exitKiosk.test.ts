import { describe, expect, it } from "vitest";
import { deriveExitKioskNotice } from "./exitKiosk";

describe("deriveExitKioskNotice", () => {
  it("returns no notice on a successful exit", () => {
    expect(deriveExitKioskNotice({ exited: true, launcherPackage: "com.google.android.tvlauncher" }))
      .toBeUndefined();
  });

  it("returns no notice when exited is true even if a message is present", () => {
    expect(deriveExitKioskNotice({ exited: true, message: "should be ignored" }))
      .toBeUndefined();
  });

  it("returns the message when the native side refused (NO_SAFE_LAUNCHER)", () => {
    expect(deriveExitKioskNotice({
      exited: false,
      reason: "NO_SAFE_LAUNCHER",
      message: "No other launcher is available to take over Home.",
      recoveryCommand: "adb shell pm enable com.google.android.tvlauncher",
    })).toEqual({ message: "No other launcher is available to take over Home." });
  });

  it("returns no notice when refused with no message", () => {
    expect(deriveExitKioskNotice({ exited: false })).toBeUndefined();
  });
});
