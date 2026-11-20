import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtImage, isInlineArtSrc, LetterAvatar, retryArtSrc } from "./ArtImage";

const INLINE_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z";
const REMOTE_ART = "https://yt3.googleusercontent.com/ytc/abc123=s176-c-k-c0x00ffffff-no-rj";

describe("retryArtSrc", () => {
  it("leaves the first attempt untouched for every kind of src", () => {
    expect(retryArtSrc(REMOTE_ART, 0)).toBe(REMOTE_ART);
    expect(retryArtSrc(INLINE_JPEG, 0)).toBe(INLINE_JPEG);
  });

  it("cache-busts remote retries so a cached failure is not replayed", () => {
    expect(retryArtSrc(REMOTE_ART, 1)).toBe(`${REMOTE_ART}?op_retry=1`);
    expect(retryArtSrc("https://i.ytimg.com/vi/x/hqdefault.jpg?a=1", 2))
      .toBe("https://i.ytimg.com/vi/x/hqdefault.jpg?a=1&op_retry=2");
  });

  it("never appends a query string to inline data:/blob: art", () => {
    // Regression: `data:...;base64,xxx?op_retry=1` is an invalid image, so
    // one transient error used to cascade every channel tile into the letter
    // fallback even though the stored inline art was perfectly good.
    for (const attempt of [1, 2, 3]) {
      expect(retryArtSrc(INLINE_JPEG, attempt)).toBe(INLINE_JPEG);
    }
    expect(retryArtSrc("blob:https://localhost/1234", 1)).toBe("blob:https://localhost/1234");
  });
});

describe("isInlineArtSrc", () => {
  it("recognises data: and blob: sources only", () => {
    expect(isInlineArtSrc(INLINE_JPEG)).toBe(true);
    expect(isInlineArtSrc("DATA:image/png;base64,AAAA")).toBe(true);
    expect(isInlineArtSrc("blob:https://localhost/1")).toBe(true);
    expect(isInlineArtSrc(REMOTE_ART)).toBe(false);
    expect(isInlineArtSrc("")).toBe(false);
  });
});

describe("ArtImage", () => {
  it("renders the pristine src on first paint and no fallback", () => {
    const html = renderToStaticMarkup(
      <ArtImage src={INLINE_JPEG} className="w-20 h-20" fallback={<LetterAvatar label="PBS KIDS" />} />,
    );
    expect(html).toContain(`src="${INLINE_JPEG}"`);
    expect(html).not.toContain("op_retry");
    expect(html).not.toContain(">P<");
  });
});
