const TELEVISION_DESIGN_WIDTH = 1600;

export function televisionCanvasScale(
  isTelevision: boolean,
  viewportWidth: number,
): number {
  if (!isTelevision || !Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return 1;
  }

  return Math.min(1, viewportWidth / TELEVISION_DESIGN_WIDTH);
}

export function televisionCanvasStyle(
  scale: number,
): { zoom: number; "--openpanel-zoom": number } | undefined {
  if (!Number.isFinite(scale) || scale <= 0 || scale >= 1) return undefined;

  // Only `zoom`. This used to also set width/height to `100 / scale` percent,
  // which is what you need with `transform: scale()` — transforms do not affect
  // layout, so the box must be grown by hand. CSS `zoom` is different: it scales
  // the layout itself, and percentage lengths inside a zoomed subtree already
  // resolve against the zoomed coordinate space. Setting both therefore applied
  // the expansion twice, leaving the shell 1600 CSS px wide inside a 960 px
  // viewport.
  //
  // Two real bugs came out of that on the TCL TV (2026-08-18):
  //   1. The document became horizontally scrollable, so any focus()/
  //      scrollIntoView() that reached the document dragged the whole page
  //      sideways — 7 presses of RIGHT along the app row put scrollX at 552 and
  //      pushed the hero copy and row headings off screen entirely.
  //   2. Each row's scroll container inherited the doubled width, so it reported
  //      scrollWidth === clientWidth and never scrolled. Any app past the fifth
  //      was clipped at the right edge and unreachable by remote.
  //
  // The shell's own `size-full` (width/height: 100%) is the correct sizing here.
  // `--openpanel-zoom` is read by index.css: viewport units (dvh/vh) are NOT
  // scaled by `zoom`, so `100dvh` inside the zoomed shell is only 60% of the
  // screen on the TCL TV. Every full-height rule divides by this variable.
  return { zoom: scale, "--openpanel-zoom": scale };
}
