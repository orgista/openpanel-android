import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LibraryManager } from "./LibraryManager";

describe("LibraryManager catalog field", () => {
  it("asks the on-screen keyboard for a URL layout and a done key", () => {
    const html = renderToStaticMarkup(<LibraryManager />);

    expect(html).toContain("https://library.example.org/opds");
    expect(html).toContain('inputMode="url"');
    expect(html).toContain('enterKeyHint="done"');
  });
});
