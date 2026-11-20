import type { SystemBridge } from "./SystemBridge";

type ExitKioskResult = Awaited<ReturnType<typeof SystemBridge.exitKioskToSystemHome>>;

/**
 * Pure derivation of the notice SettingsModal should show after a call to
 * exitKioskToSystemHome(): only when the native side intentionally stayed put
 * (`exited: false`, e.g. NO_SAFE_LAUNCHER — see SystemBridgePlugin) and it gave
 * us something to say. A successful exit or a result with no message needs no
 * notice. Extracted so the exit-kiosk decision is unit-testable without a
 * native bridge (stage3 item 10).
 */
export function deriveExitKioskNotice(
  result: ExitKioskResult
): { message: string } | undefined {
  if (result.exited) return undefined;
  if (!result.message) return undefined;
  return { message: result.message };
}
