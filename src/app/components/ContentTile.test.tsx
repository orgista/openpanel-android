import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ContentItem } from "../App";
import { ContentTile } from "./ContentTile";

const layeredApp: ContentItem = {
  id: "org.kanopy",
  title: "Kanopy",
  packageName: "org.kanopy",
  iconUrl: "data:image/png;base64,ICON",
  artForegroundUrl: "data:image/png;base64,FG",
  artBackgroundUrl: "data:image/webp;base64,BG",
  coverUrl: "#000, #111",
  category: "apps",
  tileType: "landscape",
};

function render(item: ContentItem, launchOnTap: boolean, isSelected = false) {
  return renderToStaticMarkup(
    <ContentTile
      item={item}
      index={0}
      isSelected={isSelected}
      onSelect={vi.fn()}
      onLaunch={vi.fn()}
      launchOnTap={launchOnTap}
    />,
  );
}

describe("ContentTile", () => {
  it("fills a touch card with the adaptive icon layers and puts the title below", () => {
    const html = render(layeredApp, true, true);

    expect(html).toContain("base64,BG");
    expect(html).toContain("base64,FG");
    expect(html).not.toContain("base64,ICON");
    expect(html).toContain("in-data-[input-mode=touch]:ring-white/70");
    expect(html).toMatch(/<p class="hidden in-data-\[input-mode=touch\]:block mt-2 truncate[^"]*"[^>]*>Kanopy<\/p>/);
  });

  it("fills the card with a full-picture foreground sent as the background", () => {
    const html = render({ ...layeredApp, artForegroundUrl: undefined }, true);

    expect(html).toContain("base64,BG");
    expect(html).not.toContain("base64,FG");
    expect(html).not.toContain("base64,ICON");
  });

  it("falls back to the icon when an app has no layers", () => {
    const html = render({ ...layeredApp, artForegroundUrl: undefined, artBackgroundUrl: undefined }, true);

    expect(html).toContain("base64,ICON");
    expect(html).not.toContain("base64,FG");
  });

  it("leaves TV tiles on the icon with the overlay title", () => {
    const html = render(layeredApp, false, true);

    expect(html).toContain("base64,ICON");
    expect(html).not.toContain("base64,FG");
    expect(html).not.toContain("base64,BG");
    expect(html).not.toContain("<p class=\"hidden");
    expect(html).toContain("line-clamp-2");
  });
});
