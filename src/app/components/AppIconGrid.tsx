import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ContentItem } from "../App";
import { AppIcon } from "./AppIcon";

export function appGridLayout(width: number, height: number) {
  const availableWidth = Math.max(120, width - 112);
  const columns = Math.max(1, Math.floor((availableWidth + 64) / (148 + 64)));
  const iconSize = Math.max(120, Math.min(148, availableWidth / columns - 24));
  const rows = Math.max(1, Math.floor((height - 64 - 72) / (iconSize + 96)));
  return { columns, rows, iconSize };
}

export function AppIconGrid({ items, onLaunch, loading = false }: { loading?: boolean; items: ContentItem[]; onLaunch: (item: ContentItem) => void }) {
  const [layout, setLayout] = useState(() => appGridLayout(
    typeof window === "undefined" ? 1237 : window.innerWidth,
    typeof window === "undefined" ? 861 : window.innerHeight,
  ));
  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageSize = layout.columns * layout.rows;
  const pageCount = loading ? 1 : Math.ceil(items.length / pageSize);
  useEffect(() => {
    const resize = () => setLayout(appGridLayout(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    setActivePage(0);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [pageSize, items.length]);

  return (
    <section className="app-icon-grid" aria-label="Apps & Games" aria-busy={loading} style={{
      "--app-page-controls": pageCount > 1 ? "44px" : "0px",
      "--app-grid-columns": layout.columns, "--app-grid-rows": layout.rows,
      "--app-grid-icon-size": `${layout.iconSize}px`,
    } as CSSProperties}>
      <div className="app-grid-scroll" ref={scrollRef} onScroll={(event) => {
        const { scrollLeft, clientWidth } = event.currentTarget;
        if (clientWidth) setActivePage(Math.round(scrollLeft / clientWidth));
      }}>
        {Array.from({ length: pageCount }, (_, page) => (
          <div className="app-grid-page" key={page}>
            {loading ? Array.from({ length: pageSize }, (_, index) => <span key={index} className="app-icon-placeholder" aria-hidden="true" />) : items.slice(page * pageSize, (page + 1) * pageSize).map((item) => (
              <AppIcon key={item.id} item={item} size={layout.iconSize} onLaunch={() => onLaunch(item)} />
            ))}
          </div>
        ))}
      </div>
      {pageCount > 1 && <nav className="app-grid-dots" aria-label="App pages">
        {Array.from({ length: pageCount }, (_, page) => (
          <button type="button" key={page} aria-label={`Page ${page + 1}`}
            aria-current={activePage === page ? "page" : undefined}
            onClick={() => scrollRef.current?.scrollTo({ left: page * scrollRef.current.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}>
            <span />
          </button>
        ))}
      </nav>}
    </section>
  );
}
