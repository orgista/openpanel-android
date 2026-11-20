import { describe, expect, it } from "vitest";
import { millisecondsUntilNextMinute } from "./useMinuteClock";
describe("lock clock scheduling", () => {
  it("aligns updates to minute boundaries", () => {
    expect(millisecondsUntilNextMinute(0)).toBe(60_000);
    expect(millisecondsUntilNextMinute(59_999)).toBe(1);
    expect(millisecondsUntilNextMinute(65_000)).toBe(55_000);
  });
});
