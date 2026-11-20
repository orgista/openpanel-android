import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FADE_OUT_START,
  STARTUP_ANIMATION_FALLBACK_MS,
  STARTUP_REVEAL_MS,
  StartupAnimation,
  WORDMARK_TIMES,
} from "./StartupAnimation";

describe("StartupAnimation", () => {
  it("renders the OpenPanel logo splash (mark and name, no video)", () => {
    const html = renderToStaticMarkup(<StartupAnimation onComplete={() => {}} />);

    expect(html).toContain('data-openpanel-startup="true"');
    expect(html).toContain('aria-label="OpenPanel by Orgista"');
    expect(html).toContain("OpenPanel");
    expect(html).not.toContain("openpanel-launch.mp4");
    expect(html).not.toContain("data-openpanel-startup-video");
    expect(html).not.toContain("data-openpanel-brand-mark");
  });

  it("uses a brief splash duration", () => {
    expect(STARTUP_ANIMATION_FALLBACK_MS).toBeGreaterThan(1000);
    expect(STARTUP_ANIMATION_FALLBACK_MS).toBeLessThan(4000);
  });

  it("mounts the app underneath before the splash starts fading", () => {
    // Fade-out begins at 85% of the run; revealing later shows a black frame.
    expect(STARTUP_REVEAL_MS).toBeGreaterThan(0);
    expect(STARTUP_REVEAL_MS).toBeLessThan(STARTUP_ANIMATION_FALLBACK_MS * FADE_OUT_START);
  });

  it("settles the wordmark before the overlay starts fading", () => {
    expect(WORDMARK_TIMES[WORDMARK_TIMES.length - 1]).toBeLessThanOrEqual(FADE_OUT_START);
    expect([...WORDMARK_TIMES]).toEqual([...WORDMARK_TIMES].sort((a, b) => a - b));
  });
});
