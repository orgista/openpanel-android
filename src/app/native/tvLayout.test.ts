import { describe, expect, it } from "vitest";
import { televisionCanvasScale, televisionCanvasStyle } from "./tvLayout";

describe("TV layout density", () => {
  it("scales Castillo TV's 960px CSS viewport to a 1600px design canvas with zoom alone", () => {
    expect(televisionCanvasScale(true, 960)).toBe(0.6);
    // Deliberately no width/height: `zoom` scales layout, so percentage sizes
    // inside already resolve in the zoomed space. Emitting 100/scale percent as
    // well doubled the canvas width, which made the document scroll sideways and
    // stopped each row from ever scrolling (see tvLayout.ts).
    expect(televisionCanvasStyle(0.6)).toEqual({ zoom: 0.6, "--openpanel-zoom": 0.6 });
  });

  it("never re-expands the canvas box on top of the zoom", () => {
    const style = televisionCanvasStyle(0.5);
    expect(style).toEqual({ zoom: 0.5, "--openpanel-zoom": 0.5 });
    expect(style).not.toHaveProperty("width");
    expect(style).not.toHaveProperty("height");
  });

  it("does not shrink a TV that already exposes a wide viewport", () => {
    expect(televisionCanvasScale(true, 1920)).toBe(1);
    expect(televisionCanvasStyle(1)).toBeUndefined();
  });

  it("never changes a tablet canvas", () => {
    expect(televisionCanvasScale(false, 960)).toBe(1);
  });
});
