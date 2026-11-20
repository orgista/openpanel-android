import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface ArtImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
  /** Rendered when every retry fails (e.g. a letter avatar). Never the broken-image glyph. */
  fallback?: ReactNode;
  /** Called once when retries are exhausted, so callers can re-resolve fresh art. */
  onPermanentFailure?: () => void;
}

const RETRY_DELAYS_MS = [1_500, 6_000, 20_000];

/** Inline art (data:/blob:) cannot rot and must never have a query string appended. */
export function isInlineArtSrc(src: string): boolean {
  return /^(?:data|blob):/i.test(src);
}

/**
 * The src to use for a given retry attempt. Remote URLs are cache-busted so
 * Chromium's negative cache does not replay the failure; inline art is returned
 * untouched, because `data:...;base64,xxx?op_retry=1` is simply an invalid image.
 */
export function retryArtSrc(src: string, attempt: number): string {
  if (attempt === 0 || isInlineArtSrc(src)) return src;
  return `${src}${src.includes("?") ? "&" : "?"}op_retry=${attempt}`;
}

/**
 * An <img> that survives kiosk reality: tiles mount while Wi-Fi is still
 * associating after boot, and remote art URLs occasionally rot. A failed load
 * retries with backoff (cache-busted so Chromium's negative cache doesn't
 * replay the failure), retries again the moment the device comes online, and
 * renders a provided fallback instead of the broken-image glyph if it never
 * recovers.
 */
export function ArtImage({ src, alt = "", className, style, draggable = false, fallback, onPermanentFailure }: ArtImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const reportedRef = useRef(false);

  // A new src is a new life. Also cancel any retry armed for the *previous*
  // src: channel art is swapped from a remote URL to inline data: art shortly
  // after boot, and a stale timer firing after that swap would bump `attempt`
  // against the new src and cascade it straight into the permanent fallback.
  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setAttempt(0);
    setFailed(false);
    reportedRef.current = false;
  }, [src]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!failed) return;
    const retryOnline = () => {
      setAttempt((current) => current + 1);
      setFailed(false);
    };
    window.addEventListener("online", retryOnline);
    return () => window.removeEventListener("online", retryOnline);
  }, [failed]);

  // Inline art either decodes or it doesn't; retrying the same bytes cannot help.
  const maxAttempts = isInlineArtSrc(src) ? 0 : RETRY_DELAYS_MS.length;

  const handleError = () => {
    if (attempt < maxAttempts) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setAttempt((current) => current + 1);
      }, RETRY_DELAYS_MS[attempt]);
      setFailed(true); // show the fallback while the retry waits
      return;
    }
    setFailed(true);
    if (!reportedRef.current) {
      reportedRef.current = true;
      onPermanentFailure?.();
    }
  };

  if (failed && attempt >= maxAttempts) {
    return <>{fallback ?? null}</>;
  }

  // Cache-bust remote retries so a cached failure is not replayed. Attempt 0
  // uses the pristine URL so normal loads stay cache-friendly; inline art is
  // never modified.
  const effectiveSrc = retryArtSrc(src, attempt);

  return (
    <>
      {failed && (fallback ?? null)}
      <img
        src={effectiveSrc}
        alt={alt}
        className={className}
        style={failed ? { ...style, display: "none" } : style}
        draggable={draggable}
        // Without this the TV WebView decodes every tile bitmap synchronously
        // during paint, which showed up as 150ms+ frames while moving focus
        // along a row (measured on the TCL TV, 2026-08-18).
        decoding="async"
        onError={handleError}
        onLoad={() => setFailed(false)}
      />
    </>
  );
}

/** Round letter avatar used when channel art is unavailable. */
export function LetterAvatar({ label, className }: { label: string; className?: string }) {
  const letter = (label.trim()[0] ?? "?").toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-[oklch(32%_0.06_264)] text-white ${className ?? ""}`}
      style={{ fontWeight: 700 }}
    >
      {letter}
    </div>
  );
}
