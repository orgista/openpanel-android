import { motion } from "motion/react";
import { BookOpen, Headphones, LibraryBig } from "lucide-react";

import { memo, useCallback } from "react";
import type { ContentItem } from "../App";
import { ArtImage, LetterAvatar } from "./ArtImage";

/**
 * Every callback here is item/index-taking rather than a pre-bound closure, so
 * the row can hand each tile the *same* function identity on every render. That
 * is what makes the memo() below actually hold: moving focus one step used to
 * re-render all N tiles (~78ms of script per D-pad press on the TCL TV);
 * now only the two tiles whose isSelected flipped do any work.
 */
interface ContentTileProps {
  item: ContentItem;
  index: number;
  isSelected: boolean;
  onSelect: (item: ContentItem) => void;
  onLaunch: (item: ContentItem) => void;
  onNavigate?: (index: number, direction: "left" | "right") => void;
  onArtFailure?: (item: ContentItem) => void;
  registerRef?: (index: number, element: HTMLButtonElement | null) => void;
  launchOnTap?: boolean;
}

const BADGE_STYLES = {
  new: { label: "NEW", bg: "bg-[oklch(48.8%_0.243_264.376)]" },
  top10: { label: "TOP 10", bg: "bg-[oklch(63.7%_0.237_25.331)]" },
  trending: { label: "TRENDING", bg: "bg-[oklch(72%_0.19_142)]" },
};

// With a remote, the first press selects the tile (it scales and the hero
// switches to it) and pressing the selected tile launches, like a TV launcher.
// On touch a tap opens the item directly, as tablet streaming apps do.
function ContentTileImpl({ item, index, isSelected, onSelect, onLaunch, onNavigate, onArtFailure, registerRef, launchOnTap = false }: ContentTileProps) {
  const setButtonRef = useCallback(
    (element: HTMLButtonElement | null) => registerRef?.(index, element),
    [registerRef, index]
  );
  const handleArtFailure = useCallback(() => onArtFailure?.(item), [onArtFailure, item]);
  const isLandscape = item.tileType === "landscape";
  // A Leanback banner already contains the app's own wordmark, so the stock
  // Google TV launcher prints no label over it. Ours did, which double-printed
  // the brand and covered the art (e.g. Pluto TV's tagline).
  const tileArt = item.bannerUrl ?? item.imageUrl;
  const showTitleOverlay = !item.bannerUrl;
  // On touch the hero's item isn't a cursor position, so no tile stays raised.
  const isRaised = isSelected && !launchOnTap;
  // Touch cards carry their title below the art. launchOnTap is the touch-UI
  // flag, so TV rows never render the extra layer images.
  const touchCard = launchOnTap;
  const showLayers = touchCard && !tileArt && !!item.artBackgroundUrl;

  return (
    <motion.button
      ref={setButtonRef}
      type="button"
      data-content-tile
      data-content-id={item.id}
      aria-label={`${isSelected || launchOnTap ? "Open" : "Select"} ${item.title}`}
      aria-pressed={isSelected}
      className={`relative flex-shrink-0 cursor-pointer group text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 rounded-lg ${
        isLandscape
          ? "w-72 h-44 in-data-[input-mode=touch]:h-auto in-data-[input-mode=touch]:w-[calc((100vw-7.5rem)/3.25)]"
          : "w-56 h-80"
      } ${isRaised ? "z-20" : ""}`}
      // The tile carries a 512x288 banner bitmap; without promotion the scale
      // animation re-rasters it every frame.
      style={{ willChange: "transform" }}
      animate={{ scale: isRaised ? 1.07 : 1 }}
      whileHover={launchOnTap ? undefined : { scale: 1.07, zIndex: 20 }}
      whileTap={launchOnTap ? { scale: 0.94, opacity: 0.85 } : { scale: 0.97 }}
      transition={launchOnTap ? { duration: 0.12, ease: "easeOut" } : { type: "spring", stiffness: 350, damping: 28 }}
      onFocus={() => onSelect(item)}
      onClick={() => (isSelected || launchOnTap ? onLaunch(item) : onSelect(item))}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          onNavigate?.(index, event.key === "ArrowLeft" ? "left" : "right");
        }
      }}
    >
      {/* Opaque card surface: leanback banners may carry transparency (e.g. a
          bare brand mark), and without a backing they float on the page. */}
      <div className={`relative w-full h-full rounded-lg overflow-hidden bg-[oklch(20.5%_0_0)] ${
        isLandscape ? "in-data-[input-mode=touch]:h-auto in-data-[input-mode=touch]:aspect-video" : ""
      }`}>
        {/* Poster background — falls back to the gradient if art can't load */}
        {tileArt ? (
          <ArtImage
            src={tileArt}
            alt={item.title}
            className="absolute inset-0 w-full h-full object-cover object-center"
            fallback={
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${item.coverUrl})` }}
              >
                {/* Banner art failed: fall back to the icon so a tile with a
                    suppressed title label is never a blank gradient. */}
                {item.bannerUrl && item.iconUrl && (
                  <img src={item.iconUrl} alt="" decoding="async" className="w-20 h-20 rounded-2xl shadow-2xl" />
                )}
              </div>
            }
            onPermanentFailure={onArtFailure ? handleArtFailure : undefined}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${item.coverUrl})` }}
          />
        )}

        {!tileArt && !item.iconUrl && item.category === "library" && (() => {
          const format = item.libraryPublication?.format;
          const Icon = item.libraryAction === "browse"
            ? LibraryBig
            : format === "audio" || format === "audiobook" ? Headphones : BookOpen;
          return (
            <div className="absolute inset-x-0 top-0 bottom-14 flex items-center justify-center" aria-hidden="true">
              <Icon className="size-16 text-white/70" strokeWidth={1.5} />
            </div>
          );
        })()}

        {/* The adaptive icon's own layers fill the card. The visible logo is the
            central 66/108 of its layer; at the card's height it fills the card
            without cropping marks that reach past the safe zone. */}
        {showLayers && (
          <div className="hidden in-data-[input-mode=touch]:block absolute inset-0" aria-hidden="true">
            <img src={item.artBackgroundUrl} alt="" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            {item.artForegroundUrl && <img
              src={item.artForegroundUrl}
              alt=""
              decoding="async"
              className="absolute left-1/2 top-1/2 h-full aspect-square max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            />}
          </div>
        )}

        {/* App icon centered over gradient — letter avatar if art can't load */}
        {/* On tablets an icon-only tile is mostly empty gradient, so the
            icon's own colours fill it from behind and the icon grows. */}
        {!tileArt && !showLayers && item.iconUrl && (
          <img
            src={item.iconUrl}
            alt=""
            aria-hidden="true"
            decoding="async"
            className="hidden in-data-[input-mode=touch]:block absolute inset-0 w-full h-full object-cover scale-150 blur-2xl opacity-60"
          />
        )}
        {!tileArt && !showLayers && item.iconUrl && (
          <div className={`absolute inset-x-0 top-0 bottom-10 flex items-center justify-center ${
            isLandscape ? "in-data-[input-mode=touch]:bottom-0" : "in-data-[input-mode=touch]:bottom-9"
          }`}>
            <ArtImage
              src={item.iconUrl}
              alt=""
              className="w-20 h-20 in-data-[input-mode=touch]:w-auto in-data-[input-mode=touch]:h-[72%] in-data-[input-mode=touch]:aspect-square rounded-2xl in-data-[input-mode=touch]:rounded-[22%] shadow-2xl"
              fallback={<LetterAvatar label={item.title} className="w-20 h-20 rounded-2xl shadow-2xl text-3xl" />}
              onPermanentFailure={onArtFailure ? handleArtFailure : undefined}
            />
          </div>
        )}

        {/*
          No play chip. The stock Google TV app row launches straight from the
          highlighted tile with no overlaid affordance — the focus ring and the
          scale are the affordance. An always-on play badge also covered the
          banner art we now render.
        */}
        {/* Bottom title gradient */}
        {showTitleOverlay && (
          <div className={`absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/90 to-transparent ${touchCard ? "in-data-[input-mode=touch]:hidden" : ""}`} />
        )}

        {/* Title — omitted when the banner already carries the wordmark */}
        {showTitleOverlay && (
        <div className={`absolute bottom-0 left-0 right-0 p-3 ${touchCard ? "in-data-[input-mode=touch]:hidden" : ""}`}>
          <p
            className="text-white text-sm leading-tight line-clamp-2"
            style={{ fontWeight: 500, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
          >
            {item.title}
          </p>
        </div>
        )}

        {/* Badge */}
        {item.badge && (
          <div className={`absolute top-2 left-2 ${BADGE_STYLES[item.badge].bg} px-1.5 py-0.5 rounded`}>
            <span className="text-white" style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.05em" }}>
              {BADGE_STYLES[item.badge].label}
            </span>
          </div>
        )}

        {/* Focus ring */}
        {/*
          transition-all here animated every animatable property on a node that
          only ever changes ring colour — on the TV that meant a style recalc
          per frame for nothing. Scoped to the property that actually moves.
        */}
        <div
          className={`absolute inset-0 rounded-lg ring-2 transition-colors duration-300 pointer-events-none ${
            isRaised ? "ring-white/80" : "ring-transparent group-hover:ring-white/40"
          } ${touchCard ? "in-data-[input-mode=touch]:ring-inset" : ""} ${
            touchCard && isSelected ? "in-data-[input-mode=touch]:ring-white/70" : ""
          }`}
        />
      </div>

      {touchCard && (
        <p className="hidden in-data-[input-mode=touch]:block mt-2 truncate text-[15px] leading-5 text-white/90" style={{ fontWeight: 600 }}>
          {item.title}
        </p>
      )}
    </motion.button>
  );
}

export const ContentTile = memo(ContentTileImpl);
