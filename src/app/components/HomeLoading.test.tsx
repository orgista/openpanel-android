import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen";
const props = { apps: [], libraryItems: [], youtubeItems: [], featured: null, heroItem: null,
  standalone: true, onSelect: vi.fn(), onLaunch: vi.fn(), onHeroLaunch: vi.fn() };
describe("first app list layout", () => {
  it("reserves a complete app page before results and suppresses the empty state", () => {
    const html = renderToStaticMarkup(<HomeScreen {...props} touch remoteMode={false} appsLoading />);
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/class="app-icon-placeholder"/g)).toHaveLength(10);
    expect(html).not.toContain("No apps assigned");
  });
  it("centres only when apps are the sole section and keeps other shelves top aligned", () => {
    const single = renderToStaticMarkup(<HomeScreen {...props} touch remoteMode={false} />);
    expect(single).toContain('touch-home-only');
    const shelves = renderToStaticMarkup(<HomeScreen {...props} touch remoteMode={false} links={[{ title: "Example", url: "https://example.com" }]} />);
    expect(shelves).not.toContain('touch-home-only');
    expect(shelves).toContain('aria-label="Links"');
    expect(shelves).toContain('managed-link-tile');
  });
  it("leaves remote rendering unchanged during loading", () => {
    const render = (appsLoading: boolean) => renderToStaticMarkup(<HomeScreen {...props} touch={false} remoteMode appsLoading={appsLoading} />);
    expect(render(true)).toBe(render(false));
  });
});
