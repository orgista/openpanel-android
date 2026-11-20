import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppIcon } from "./AppIcon";
import { AppIconGrid, appGridLayout } from "./AppIconGrid";
import { HomeScreen } from "./HomeScreen";
import type { ContentItem } from "../App";

const app: ContentItem = {
  id: "example", title: "Example", category: "apps", coverUrl: "#000, #111",
  iconUrl: "legacy.png", artBackgroundUrl: "background.png", artForegroundUrl: "foreground.png",
  bannerUrl: "banner.png",
};

describe("touch home screen", () => {
  it("crops both adaptive layers from 150% canvases and ignores banners", () => {
    const html = renderToStaticMarkup(<AppIcon item={app} onLaunch={vi.fn()} />);
    expect(html).toContain('aria-label="Open Example"');
    expect(html).toContain('src="background.png"');
    expect(html).toContain('src="foreground.png"');
    expect(html.match(/width:150%;height:150%/g)).toHaveLength(2);
    expect(html).not.toContain('src="legacy.png"');
    expect(html).not.toContain('src="banner.png"');
  });

  it("fills the plate with a legacy icon when layers are absent", () => {
    const html = renderToStaticMarkup(<AppIcon item={{ ...app, artBackgroundUrl: undefined }} onLaunch={vi.fn()} />);
    expect(html).toContain('src="legacy.png"');
    expect(html).not.toContain('src="foreground.png"');
  });

  it("derives five columns and two rows on the tablet and paginates twelve apps", () => {
    expect(appGridLayout(1237, 861)).toEqual({ columns: 5, rows: 2, iconSize: 148 });
    const items = Array.from({ length: 12 }, (_, i) => ({ ...app, id: String(i) }));
    const html = renderToStaticMarkup(<AppIconGrid items={items} onLaunch={vi.fn()} />);
    expect(html.match(/class="app-grid-page"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Page \d"/g)).toHaveLength(2);
    expect(html).toContain('aria-current="page"');
    expect(appGridLayout(600, 500).columns).toBeLessThan(5);
  });

  it("omits dots for a single page", () => {
    expect(renderToStaticMarkup(<AppIconGrid items={[app]} onLaunch={vi.fn()} />)).not.toContain('aria-label="App pages"');
  });

  it("keeps the hero and content row on TV and uses the grid only on touch", () => {
    const props = { apps: [app], libraryItems: [], youtubeItems: [], featured: app,
      heroItem: app, standalone: false, onSelect: vi.fn(), onLaunch: vi.fn(), onHeroLaunch: vi.fn() };
    const tv = renderToStaticMarkup(<HomeScreen {...props} touch={false} remoteMode />);
    expect(tv).toContain("Apps &amp; Games");
    expect(tv).toContain("data-content-tile");
    expect(tv).toContain("<h1");
    expect(tv).not.toContain("app-icon-grid");
    const touch = renderToStaticMarkup(<HomeScreen {...props} touch remoteMode={false} />);
    expect(touch).toContain("app-icon-grid");
    expect(touch).not.toContain("data-content-tile");
    expect(touch).not.toContain("<h1");
  });
});
