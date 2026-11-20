import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAdminConfiguration, getAdminToken, isAdminConfigured, resetPin, setupAdmin } from "./adminAuth";
import { SystemBridge } from "./SystemBridge";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("admin authentication", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("clears credentials and failed-attempt state together", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "openpanel.admin.v1",
      JSON.stringify({ pinHash: "pin", question: "question", answerHash: "answer" }),
    );
    storage.setItem(
      "openpanel.admin.throttle.v1",
      JSON.stringify({ failed: 9, lockedUntil: Date.now() + 60_000 }),
    );
    vi.stubGlobal("localStorage", storage);

    expect(isAdminConfigured()).toBe(true);

    clearAdminConfiguration();

    expect(isAdminConfigured()).toBe(false);
    expect(storage.getItem("openpanel.admin.throttle.v1")).toBeNull();
  });

  // Item 3 (admin gate): the token native's requireKioskAdmin checks against
  // is the stored PIN verifier itself, and every credential-writing path
  // (setup, PIN reset, clear) must mirror it into native prefs via
  // setKioskAdminVerifier — a CDP caller with no adminToken should not be able
  // to dismantle kiosk once a PIN exists.
  it("returns null with no PIN configured, and a token once one exists", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("crypto", globalThis.crypto);

    expect(getAdminToken()).toBeNull();

    await setupAdmin("1234", "What city were you born in?", "Springfield");
    const token = getAdminToken();
    expect(token).toBeTruthy();
    expect(token).not.toBe("1234"); // never the raw PIN
  });

  it("mirrors the verifier into native prefs on setup, reset, and clear", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("crypto", globalThis.crypto);
    const setVerifier = vi.spyOn(SystemBridge, "setKioskAdminVerifier");

    await setupAdmin("1234", "What city were you born in?", "Springfield");
    expect(setVerifier).toHaveBeenCalledWith({ verifier: getAdminToken() });

    await resetPin("5678");
    expect(setVerifier).toHaveBeenLastCalledWith({ verifier: getAdminToken() });

    clearAdminConfiguration();
    expect(setVerifier).toHaveBeenLastCalledWith({ verifier: "" });

    setVerifier.mockRestore();
  });
});
