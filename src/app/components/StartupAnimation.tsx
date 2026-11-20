import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { OpenPanelBrand } from "./OpenPanelBrand";

// Long enough to read as an intro rather than a flash on a cold start.
export const STARTUP_ANIMATION_FALLBACK_MS = 3800;
// The app mounts underneath once the mark is complete, so its first render
// happens while the logo holds still and the overlay fades out over it.
export const STARTUP_REVEAL_MS = 2500;
export const FADE_OUT_START = 0.85;
const TOTAL_S = STARTUP_ANIMATION_FALLBACK_MS / 1000;
// Wordmark: in from 1.7s to 2.3s, then holds until the overlay starts fading.
export const WORDMARK_TIMES = [0, 1.7 / TOTAL_S, 2.3 / TOTAL_S, FADE_OUT_START];

// The mark builds itself: three panels arrive one after another, then the
// fourth swings open around the centre of the grid.
const PANELS = [
  { x: 1, y: 1, delay: 0.25 },
  { x: 1, y: 19, delay: 0.45 },
  { x: 19, y: 19, delay: 0.65 },
] as const;
const PANEL_S = 0.55;
const SWING_DELAY_S = 1.0;
const SWING_S = 0.7;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface StartupAnimationProps {
  onReveal?: () => void;
  onComplete: () => void;
}

export function StartupAnimation({ onReveal, onComplete }: StartupAnimationProps) {
  const [finished, setFinished] = useState(false);
  // Refs keep the timers from restarting when the parent re-renders with new
  // callbacks (it does, as soon as the app mounts underneath).
  const onRevealRef = useRef(onReveal);
  const onCompleteRef = useRef(onComplete);
  onRevealRef.current = onReveal;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onRevealRef.current?.();
      setFinished(true);
      onCompleteRef.current();
    };
    const revealTimer = window.setTimeout(
      () => onRevealRef.current?.(),
      reducedMotion ? 0 : STARTUP_REVEAL_MS,
    );
    const finishTimer = window.setTimeout(finish, reducedMotion ? 0 : STARTUP_ANIMATION_FALLBACK_MS);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  if (finished) return null;

  return (
    <motion.div
      data-openpanel-startup="true"
      className="fixed inset-0 z-[1000] grid place-items-center overflow-hidden bg-[#050607]"
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: TOTAL_S, times: [0, FADE_OUT_START, 1], ease: "easeInOut" }}
    >
      <div className="flex flex-col items-center gap-8">
        <svg viewBox="0 0 36 36" className="size-32" style={{ overflow: "visible" }}>
          {PANELS.map((panel) => (
            <motion.rect
              key={`${panel.x}-${panel.y}`}
              x={panel.x}
              y={panel.y}
              width="16"
              height="16"
              fill="#E2E8F0"
              style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: PANEL_S, delay: panel.delay, ease: EASE_OUT }}
            />
          ))}
          <motion.path
            d="M19 17V1a16 16 0 0 1 16 16Z"
            fill="url(#op-startup)"
            // Pivot on the quarter's inner corner, the centre of the grid.
            style={{ transformBox: "fill-box", transformOrigin: "0% 100%" }}
            initial={{ opacity: 0, rotate: 90 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ duration: SWING_S, delay: SWING_DELAY_S, ease: EASE_OUT }}
          />
          <defs>
            <linearGradient id="op-startup" x1="19" y1="1" x2="35" y2="17" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7DD3FC" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        </svg>

        {/* No blur: animated filters drop frames on the low-end tablets. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0, 0, 1, 1], y: [8, 8, 0, 0] }}
          transition={{ duration: TOTAL_S, times: WORDMARK_TIMES, ease: "easeOut" }}
        >
          <OpenPanelBrand wordmarkClassName="text-[2.25rem]" showByline />
        </motion.div>
      </div>
    </motion.div>
  );
}
