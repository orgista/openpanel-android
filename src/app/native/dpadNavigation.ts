import { recordDiagnostic } from "./diagnostics";

export type DpadDirection = "up" | "down" | "left" | "right";

export interface DpadRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const center = (rect: DpadRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

/**
 * Finds the nearest control in the requested visual direction. Advancing to
 * the next row or column matters more than perfect cross-axis alignment; this
 * prevents a wide control several rows away from stealing focus.
 */
export function findNextDpadTarget(
  current: DpadRect,
  candidates: DpadRect[],
  direction: DpadDirection,
): number | null {
  const origin = center(current);
  let bestIndex: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate, index) => {
    const target = center(candidate);
    const deltaX = target.x - origin.x;
    const deltaY = target.y - origin.y;
    const primary = direction === "left" ? -deltaX
      : direction === "right" ? deltaX
        : direction === "up" ? -deltaY : deltaY;
    const horizontal = direction === "left" || direction === "right";
    const currentPrimarySize = horizontal ? current.width : current.height;
    const candidatePrimarySize = horizontal ? candidate.width : candidate.height;
    // Browser layout rounding often puts same-row controls one pixel apart on
    // the other axis. Require meaningful travel before calling a target left,
    // right, above, or below the current control.
    const minimumDirectionalTravel = Math.max(
      8,
      Math.min(currentPrimarySize, candidatePrimarySize) * 0.2,
    );
    if (primary < minimumDirectionalTravel) return;

    const crossAxis = horizontal
      ? Math.abs(deltaY)
      : Math.abs(deltaX);
    // Reject steep diagonals. Without this, a footer that is only slightly to
    // the right can beat a true same-row control that is farther away.
    if (primary < crossAxis * 0.25) return;
    const score = primary * 4 + crossAxis;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const isRendered = (element: HTMLElement): boolean => {
  if (element.closest("[aria-hidden='true'], [inert]")) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const scopeZIndex = (element: HTMLElement): number => {
  const value = Number.parseInt(window.getComputedStyle(element).zIndex, 10);
  return Number.isFinite(value) ? value : 0;
};

const topDpadScope = (): HTMLElement | null => {
  const scopes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-dpad-scope]"),
  ).filter(isRendered);
  return scopes.reduce<HTMLElement | null>((top, scope) => {
    if (!top || scopeZIndex(scope) >= scopeZIndex(top)) return scope;
    return top;
  }, null);
};

const shouldKeepNativeArrowBehavior = (
  element: HTMLElement,
  direction: DpadDirection,
): boolean => {
  if (direction !== "left" && direction !== "right") return false;
  if (element instanceof HTMLTextAreaElement || element.isContentEditable) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "submit"].includes(element.type);
};

/**
 * True when nothing useful holds focus: no active element, the body, or a node
 * that has since been unmounted or hidden.
 */
export function hasLostDpadFocus(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!active || active === document.body) return true;
  if (!(active instanceof HTMLElement)) return true;
  if (!active.isConnected) return true;
  return !isRendered(active);
}

/**
 * Puts focus back on a real control in the topmost scope.
 *
 * The spatial-navigation handler below already recovers lost focus — but only
 * when the user presses an *arrow* key. Returning from a launched app, a failed
 * launch, or a cold start all drop focus to <body>, and in that state OK and
 * BACK do nothing and no focus ring is drawn, so the remote reads as dead. The
 * device's own bug log showed this 11 times, each immediately after
 * "Launcher state after foreground return", "Failed to launch", or startup
 * (TCL TV, 2026-08-18).
 *
 * Call this whenever OpenPanel takes the foreground so recovery does not wait
 * for a keypress the user has no reason to believe will help.
 */
let lastNoTargetLogAt = 0;

export function ensureDpadFocus(reason: string): boolean {
  if (typeof document === "undefined") return false;
  if (!hasLostDpadFocus()) return false;

  const scope = topDpadScope() ?? document.body;
  const candidates = Array.from(
    scope.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(isRendered);
  if (candidates.length === 0) {
    // The watchdog calls this every 1.5s; a screen with nothing focusable
    // (sleep clock, a bare loading state) must not flood the 200-entry log.
    const now = Date.now();
    if (now - lastNoTargetLogAt > 60_000) {
      lastNoTargetLogAt = now;
      recordDiagnostic("warning", "Foreground focus restore found no target", { reason });
    }
    return false;
  }

  const target = candidates.find((candidate) => candidate.hasAttribute("data-dpad-initial"))
    ?? candidates[0];
  target.focus({ preventScroll: true });
  recordDiagnostic("info", "D-pad focus restored on foreground", {
    reason,
    target: target.getAttribute("aria-label") || target.textContent?.trim().slice(0, 80) || target.tagName,
  });
  return true;
}

/**
 * Installs a WebView-safe spatial navigation fallback. Component-specific
 * handlers still win because this listener ignores already-prevented events.
 */
export function installDpadNavigation(
  enabled: boolean,
  forceFullRepaint = false,
): () => void {
  if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = event.key === "ArrowUp" ? "up"
      : event.key === "ArrowDown" ? "down"
        : event.key === "ArrowLeft" ? "left"
          : event.key === "ArrowRight" ? "right" : null;
    if (!direction) return;

    const active = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    if (active && shouldKeepNativeArrowBehavior(active, direction)) return;

    const topScope = topDpadScope();
    const activeScope = active?.closest<HTMLElement>("[data-dpad-scope]") ?? null;
    const scope = topScope ?? activeScope ?? document.body;
    const candidates = Array.from(
      scope.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => element !== active && isRendered(element));
    if (candidates.length === 0) {
      if (!active || !isRendered(active)) {
        recordDiagnostic("warning", "D-pad scope has no usable focus target", {
          direction,
          scope: scope.getAttribute("aria-label") || scope.className || scope.tagName,
        });
      }
      return;
    }

    let target: HTMLElement | null = null;
    if (!active || active === document.body || !scope.contains(active) || !isRendered(active)) {
      target = candidates.find((candidate) => candidate.hasAttribute("data-dpad-initial"))
        ?? candidates[0];
      recordDiagnostic("info", "D-pad focus recovered inside active screen", {
        direction,
        target: target.getAttribute("aria-label") || target.textContent?.trim().slice(0, 80),
      });
    } else {
      const targetIndex = findNextDpadTarget(
        active.getBoundingClientRect(),
        candidates.map((candidate) => candidate.getBoundingClientRect()),
        direction,
      );
      if (targetIndex !== null) target = candidates[targetIndex];
    }
    if (!target) return;

    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (forceFullRepaint) {
      // Android 9 TCL hardware composition can repaint only the new focus ring
      // and drop every unchanged WebView tile. A one-frame root opacity change
      // invalidates the complete surface without the memory cost of keeping
      // the full launcher on a software layer.
      const root = document.documentElement;
      const previousOpacity = root.style.opacity;
      root.style.opacity = "0.99";
      window.requestAnimationFrame(() => {
        root.style.opacity = previousOpacity || "1";
      });
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}
