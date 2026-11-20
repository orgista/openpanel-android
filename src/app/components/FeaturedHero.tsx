import { motion, AnimatePresence } from "motion/react";
import { BookOpen, Headphones, Library, ListVideo, Play, Star } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ContentItem } from "../App";

interface FeaturedHeroProps {
  item: ContentItem;
  onLaunch: () => void;
  remoteMode?: boolean;
}

const formatDuration = (dur?: string) => {
  if (!dur) return null;
  const parts = dur.split(":");
  if (parts.length === 3) {
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  return dur;
};

// Fades the art into the page towards the copy on the left and the row below.
const ART_FADE = "linear-gradient(to right, transparent, #000 40%), linear-gradient(to top, transparent, #000 30%)";
const ART_FADE_STYLE = {
  maskImage: ART_FADE,
  maskComposite: "intersect",
  WebkitMaskImage: ART_FADE,
  WebkitMaskComposite: "source-in",
} as const;

export function FeaturedHero({ item, onLaunch, remoteMode = false }: FeaturedHeroProps) {
  const initialButtonRef = useRef<HTMLButtonElement>(null);
  // TV heroes never render the layer art; on touch the CSS variants below
  // decide what shows.
  const showLayers = !remoteMode && !item.imageUrl && !!item.artBackgroundUrl;
  const initialFocusApplied = useRef(false);

  useEffect(() => {
    if (!remoteMode || initialFocusApplied.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (!initialButtonRef.current) return;
      initialButtonRef.current.focus({ preventScroll: true });
      initialFocusApplied.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [remoteMode]);

  return (
    // contain:paint stops the hero's repaints from being hoisted into a
    // full-page raster — without it a hero cross-fade dirtied the whole
    // 1920x1080 surface on the TV (measured 2026-08-18).
    // On touch the hero gives up height so it, the row heading, one row of
    // cards and their titles fit the screen without scrolling (124px is the
    // row's fixed chrome; the card height follows the tile width in ContentTile).
    <div
      className="relative h-[520px] in-data-[input-mode=touch]:h-[clamp(320px,calc(100dvh_-_(100vw_-_7.5rem)_*_0.1731_-_124px),520px)] overflow-hidden"
      style={{ contain: "layout paint" }}
    >
      {/*
        The hero used to be an AnimatePresence subtree keyed on item.id, so
        every D-pad step tore down ~10 motion nodes and rebuilt them. That
        destroyed the focused Open button (focus fell to <body>) and cost
        ~50ms of script per move — the main source of the measured 150ms p95
        frame (2026-08-18). The shell is now stable and only the art
        cross-fades, which is a compositor-only opacity animation. Text and
        buttons update in place, exactly like the stock Google TV hero.
      */}
      <div className="relative h-full">
        {/* Background — only this layer keys off the item, so only it fades */}
        <div className="absolute inset-0">
          <AnimatePresence initial={false}>
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute inset-0"
              // Promote the cross-fading layer so the GPU blends a cached
              // texture instead of re-rasterising a 1920x624 gradient every
              // frame: p95 frame 138ms -> 83ms on its own.
              style={{ willChange: "opacity" }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  decoding="async"
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ background: `linear-gradient(135deg, ${item.coverUrl})` }}
                />
              )}
              {!item.imageUrl && item.iconUrl && !showLayers && !remoteMode && (
                <img
                  src={item.iconUrl}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  className="hidden in-data-[input-mode=touch]:block absolute inset-y-0 right-0 w-[60%] h-full object-cover scale-110 blur-3xl opacity-50"
                  style={ART_FADE_STYLE}
                  draggable={false}
                />
              )}
              {!item.imageUrl && item.iconUrl && (
                <div className={`absolute inset-0 flex items-center justify-end pr-32 ${showLayers ? "in-data-[input-mode=touch]:hidden" : ""}`}>
                  <img
                    src={item.iconUrl}
                    alt=""
                    decoding="async"
                    className="w-48 h-48 rounded-[2rem] shadow-2xl opacity-90 in-data-[input-mode=touch]:w-64 in-data-[input-mode=touch]:h-64 in-data-[input-mode=touch]:shadow-none in-data-[input-mode=touch]:opacity-100"
                    draggable={false}
                  />
                </div>
              )}
              {showLayers && (
                <div className="hidden in-data-[input-mode=touch]:block absolute inset-0 bg-[oklch(11%_0_0)]" aria-hidden="true">
                  <div className="absolute inset-y-0 right-0 w-[60%]">
                    <img
                      src={item.artBackgroundUrl}
                      alt=""
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                      style={ART_FADE_STYLE}
                      draggable={false}
                    />
                    {/* A dark background layer (Kanopy's is black) leaves the
                        logo on a void; a blurred copy of it tints the area. */}
                    {item.artForegroundUrl && <img
                      src={item.artForegroundUrl}
                      alt=""
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-40"
                      style={ART_FADE_STYLE}
                      draggable={false}
                    />}
                    {item.artForegroundUrl && <img
                      src={item.artForegroundUrl}
                      alt=""
                      decoding="async"
                      className="absolute left-1/2 top-1/2 h-[100%] aspect-square max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
                      draggable={false}
                    />}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Overlays */}
        {/* Layer art already fades out before the copy, and this scrim would
            dim the logo itself. */}
        <div className={`absolute inset-0 bg-gradient-to-r from-[oklch(11%_0_0)] via-[oklch(11%_0_0)]/75 to-[oklch(11%_0_0)]/10 ${
          showLayers ? "in-data-[input-mode=touch]:hidden" : ""
        }`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(11%_0_0)] via-transparent to-[oklch(11%_0_0)]/40" />

        {/* Content */}
        <div className="relative h-full flex items-end pb-14 px-14">
          <div className="max-w-xl">
            {/* Match % */}
            {item.matchPct && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-2 mb-3"
              >
                <Star className="w-3.5 h-3.5 text-[oklch(72%_0.19_142)]" fill="currentColor" />
                <span className="text-[oklch(72%_0.19_142)] text-sm tracking-wide" style={{ fontWeight: 600 }}>
                  {item.matchPct}% Match
                </span>
              </motion.div>
            )}

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-[oklch(98%_0_0)] mb-3 drop-shadow-2xl leading-none"
              style={{ fontWeight: 700, fontSize: "clamp(2.5rem, 5vw, 3.75rem)" }}
            >
              {item.title}
            </motion.h1>

            {/* Meta row */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="flex items-center gap-3 mb-4 flex-wrap"
            >
              {item.year && (
                <span className="text-[oklch(65%_0_0)] text-sm" style={{ fontWeight: 400 }}>{item.year}</span>
              )}
              {item.rating && (
                <span className="border border-[oklch(50%_0_0)] text-[oklch(65%_0_0)] text-xs px-1.5 py-0.5 rounded" style={{ fontWeight: 400 }}>
                  {item.rating}
                </span>
              )}
              {item.duration && (
                <span className="text-[oklch(65%_0_0)] text-sm" style={{ fontWeight: 400 }}>{formatDuration(item.duration)}</span>
              )}
              {item.genre && (
                <span className="text-[oklch(65%_0_0)] text-sm" style={{ fontWeight: 400 }}>{item.genre}</span>
              )}
            </motion.div>

            {/* Description */}
            {item.description && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34 }}
                className="text-[oklch(82%_0_0)] mb-7 line-clamp-2"
                style={{ fontWeight: 400, fontSize: "0.9375rem", lineHeight: "1.6" }}
              >
                {item.description}
              </motion.p>
            )}

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-3"
            >
              <motion.button
                ref={initialButtonRef}
                data-dpad-initial={remoteMode ? "true" : undefined}
                onClick={onLaunch}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2.5 px-7 py-3.5 bg-[oklch(98%_0_0)] text-[oklch(11%_0_0)] rounded-md transition-colors hover:bg-[oklch(90%_0_0)]"
                style={{ fontWeight: 600, fontSize: "0.9375rem" }}
              >
                {item.libraryAction === "browse" ? (
                  <Library className="w-5 h-5" />
                ) : item.libraryPublication ? (
                  item.libraryPublication.format === "audiobook" || item.libraryPublication.format === "audio"
                    ? <Headphones className="w-5 h-5" />
                    : <BookOpen className="w-5 h-5" />
                ) : item.youtubeItem?.kind === "channel" ? (
                  <ListVideo className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" fill="currentColor" />
                )}
                {item.libraryAction === "browse"
                  ? "Browse"
                  : item.libraryPublication
                    ? item.libraryPublication.format === "audiobook" || item.libraryPublication.format === "audio" ? "Listen" : "Read"
                    : item.youtubeItem?.kind === "channel" ? "Explore" : item.youtubeItem ? "Play" : "Open"}
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
