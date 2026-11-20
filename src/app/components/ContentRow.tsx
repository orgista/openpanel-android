import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ContentTile } from "./ContentTile";
import type { ContentItem } from "../App";

interface ContentRowProps {
  title: string;
  items: ContentItem[];
  selectedId: string | null;
  onSelect: (item: ContentItem) => void;
  onLaunch: (item: ContentItem) => void;
  onArtFailure?: (item: ContentItem) => void;
  launchOnTap?: boolean;
}

export function ContentRow({ title, items, selectedId, onSelect, onLaunch, onArtFailure, launchOnTap = false }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 640;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + (dir === "right" ? amount : -amount),
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 8);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 8);
  };

  // The row has been seen opening scrolled with its first card cut off; the
  // source of that scroll isn't known yet, so start from the beginning.
  const hasItems = items.length > 0;
  useLayoutEffect(() => {
    if (hasItems && scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [hasItems]);

  useEffect(() => {
    handleScroll();
    window.addEventListener("resize", handleScroll);
    return () => window.removeEventListener("resize", handleScroll);
  }, [items.length]);

  // Stable identities: ContentTile is memo()'d, and a fresh closure per render
  // would defeat it entirely.
  const moveTileFocus = useCallback((index: number, direction: "left" | "right") => {
    const nextIndex = index + (direction === "right" ? 1 : -1);
    const next = tileRefs.current[nextIndex];
    if (!next) return;
    // preventScroll + an explicit scroll of *this* row only. The previous
    // focus() + scrollIntoView({inline:"center"}) scrolled every scrollable
    // ancestor including the document, which on the TV dragged the whole page
    // sideways (hero copy and row headers off screen) after a few presses.
    next.focus({ preventScroll: true });
    const container = scrollRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const tileRect = next.getBoundingClientRect();
    const visualDelta =
      (tileRect.left + tileRect.width / 2) -
      (containerRect.left + containerRect.width / 2);
    // getBoundingClientRect() is in visual (zoomed) px but scrollLeft is in the
    // container's own layout px. Under the TV's 0.6 zoom a visual delta scrolls
    // only 60% of the way and the tile lands off-centre (measured: right edge
    // 6px past the viewport). The ratio below is exactly the effective zoom.
    const zoom = container.clientWidth > 0 ? containerRect.width / container.clientWidth : 1;
    container.scrollBy({ left: visualDelta / (zoom || 1), behavior: "smooth" });
  }, []);

  const registerTileRef = useCallback((index: number, element: HTMLButtonElement | null) => {
    tileRefs.current[index] = element;
  }, []);

  return (
    <div className="content-shelf mb-10 in-data-[input-mode=touch]:mb-6 group/row">
      {/* Row header */}
      <div className="flex items-center gap-3 px-14 mb-3">
        <h2 className="text-[oklch(92%_0_0)] text-lg" style={{ fontWeight: 700 }}>{title}</h2>
      </div>

      <div className="relative">
        {/* Left arrow */}
        {showLeft && (
          <button
            onClick={() => scroll("left")}
            tabIndex={-1}
            aria-label={`Scroll ${title} left`}
            className="absolute left-0 top-0 bottom-0 z-10 w-14 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity bg-gradient-to-r from-[oklch(11%_0_0)] to-transparent"
          >
            <ChevronLeft className="w-7 h-7 text-white" strokeWidth={2.5} />
          </button>
        )}

        {/* Right arrow */}
        {showRight && (
          <button
            onClick={() => scroll("right")}
            tabIndex={-1}
            aria-label={`Scroll ${title} right`}
            className="absolute right-0 top-0 bottom-0 z-10 w-14 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity bg-gradient-to-l from-[oklch(11%_0_0)] to-transparent"
          >
            <ChevronRight className="w-7 h-7 text-white" strokeWidth={2.5} />
          </button>
        )}

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          /*
            `overflow-y-visible` is a lie the browser does not honour: when one
            axis scrolls, CSS computes `visible` on the other axis to `auto`, so
            this container clips vertically. The selected tile scales to 1.07 and
            draws a 4px focus ring, both of which overflowed the top edge and got
            sliced off (measured: 4px of the ring missing on the TCL TV).
            Pad the scroll box to give the grown tile room, then pull the box back
            up by the same amount so surrounding layout is unchanged.
          */
          className="overflow-x-auto overflow-y-visible hide-scrollbar px-14 pt-5 -mt-5 pb-4"
          style={{ scrollbarWidth: "none" }}
        >
          {/*
            pr-14 lives on the track, not the scroller: a scroll container's
            trailing padding is not part of its scrollable overflow, so the last
            tile used to stop flush with the viewport edge and its 1.07x scale +
            focus ring were clipped on the right (Stremio, TCL TV 2026-08-18).
            Track padding is real content width, so it scrolls into view — but
            only if the track is sized to its content (w-max): as a plain block
            flex box it stayed at the scroller's width and the shrink-0 tiles
            simply overflowed it, leaving the padding far to the left.
          */}
          <div className="flex w-max gap-4 pr-14">
            {items.map((item, index) => (
              <ContentTile
                key={item.id}
                item={item}
                index={index}
                isSelected={item.id === selectedId}
                onSelect={onSelect}
                onLaunch={onLaunch}
                onArtFailure={onArtFailure}
                launchOnTap={launchOnTap}
                onNavigate={moveTileFocus}
                registerRef={registerTileRef}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
