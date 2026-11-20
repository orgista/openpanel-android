import { describe, expect, it } from "vitest";
import { parseLinkInput, parseManagedSettings, managedTabletPreferences, preserveLocalManagedValues } from "./managedSettings";
import { defaultTabletPreferences } from "./tabletAppearance";
describe("managed settings v1", () => {
  it("ignores unknown keys, accepts empty collections and partial fields", () => {
    expect(parseManagedSettings('{"version":1,"unknown":true,"links":[],"tablet":{"name":" Room "}}'))
      .toEqual({ version: 1, links: [], tablet: { tabletName: "Room" } });
  });
  it("rejects invalid files and insecure or credentialed links as a whole", () => {
    for (const raw of ['{', '{"version":2}', '{"version":1,"tablet":{"icon":"unknown"}}',
      '{"version":1,"links":[{"title":"Site","url":"http://example.com"}]}',
      '{"version":1,"links":[{"title":"Site","url":"https://user:pass@example.com"}]}',
      '{"version":1,"timeLimits":{"downtime":{"from":"24:00","until":"07:00"}}}',
      '{"version":1,"timeLimits":{"weekdayMinutes":-1}}']) expect(parseManagedSettings(raw)).toBeNull();
  });
  it("overrides supplied values without persisting them and restores local values on removal", () => {
    const local = { ...defaultTabletPreferences, tabletName: "Local" };
    const managed = { tabletName: "Managed" };
    expect(managedTabletPreferences(local, managed).tabletName).toBe("Managed");
    expect(preserveLocalManagedValues(local, { ...local, tabletName: "Managed", clockStyle: "analog" }, managed))
      .toEqual({ ...local, clockStyle: "analog" });
    expect(managedTabletPreferences(local, undefined)).toEqual(local);
  });
  it("maps downtime and allows independent day limits", () => {
    expect(parseManagedSettings(JSON.stringify({ version: 1, timeLimits: { weekdayMinutes: 60, downtime: { from: "20:00", until: "07:00" } } }))?.timeLimits)
      .toEqual({ weekdayMinutes: 60, downtimeEnabled: true, start: "20:00", end: "07:00" });
  });
  it("accepts channel IDs and YouTube channel URLs, rejects other sources", () => {
    expect(parseManagedSettings('{"version":1,"youtubeChannels":["UC1234567890123456789012","https://www.youtube.com/@example"]}')).not.toBeNull();
    expect(parseManagedSettings('{"version":1,"youtubeChannels":["https://example.com/@example"]}')).toBeNull();
  });
  it("turns a typed site into an https link and refuses everything else", () => {
    expect(parseLinkInput("", " www.example.org/kids ")).toEqual({ title: "example.org", url: "https://www.example.org/kids" });
    expect(parseLinkInput(" Reading ", "https://example.org")).toEqual({ title: "Reading", url: "https://example.org/" });
    for (const input of ["", "http://example.org", "javascript:alert(1)", "intent://example.org", "https://user:pw@example.org", "two words.com", "localhost"])
      expect(parseLinkInput("Title", input)).toBeNull();
  });
});
