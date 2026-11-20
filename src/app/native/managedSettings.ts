import { tabletColors, tabletIcons, type TabletPreferences } from "./tabletAppearance";
import type { TimeLimits } from "./timeLimits";
import { parseYouTubeSource } from "./youtube";

export interface ManagedLink { title: string; url: string }
export interface ManagedSettings {
  version: 1;
  tablet?: Partial<TabletPreferences>;
  links?: ManagedLink[];
  youtubeChannels?: string[];
  timeLimits?: Partial<TimeLimits>;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function httpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}
/** A link typed by an admin: a bare site name gets https, anything else that is not https is refused. */
export function parseLinkInput(title: string, input: string): ManagedLink | null {
  const typed = input.trim();
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(typed) ? typed : `https://${typed}`;
  if (!typed || /\s/.test(typed) || !httpsUrl(candidate)) return null;
  const url = new URL(candidate);
  if (!url.hostname.includes(".")) return null;
  return { title: (title.trim() || url.hostname.replace(/^www\./, "")).slice(0, 120), url: url.href };
}
export function parseManagedSettings(raw: string): ManagedSettings | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.version !== 1) return null;
    const result: ManagedSettings = { version: 1 };
    if (value.tablet !== undefined) {
      if (!object(value.tablet)) return null;
      const tablet = value.tablet;
      result.tablet = {};
      if (tablet.name !== undefined) {
        if (typeof tablet.name !== "string" || tablet.name.trim().length > 24) return null;
        result.tablet.tabletName = tablet.name.trim();
      }
      if (tablet.icon !== undefined) {
        if (!tabletIcons.includes(tablet.icon as typeof tabletIcons[number])) return null;
        result.tablet.tabletIcon = tablet.icon as typeof tabletIcons[number];
      }
      if (tablet.color !== undefined) {
        if (!tabletColors.includes(tablet.color as typeof tabletColors[number])) return null;
        result.tablet.tabletColor = tablet.color as typeof tabletColors[number];
      }
    }
    if (value.links !== undefined) {
      if (!Array.isArray(value.links) || value.links.length > 100) return null;
      const links: ManagedLink[] = [];
      for (const link of value.links) {
        if (!object(link) || typeof link.title !== "string" || !link.title.trim() || !httpsUrl(link.url)) return null;
        links.push({ title: link.title.trim().slice(0, 120), url: new URL(link.url).href });
      }
      result.links = links.filter((link, index) => links.findIndex(other => other.url === link.url) === index);
    }
    if (value.youtubeChannels !== undefined) {
      if (!Array.isArray(value.youtubeChannels) || value.youtubeChannels.length > 100) return null;
      for (const channel of value.youtubeChannels) {
        if (typeof channel !== "string") return null;
        if (!/^UC[\w-]{22}$/.test(channel) && parseYouTubeSource(channel)?.kind !== "channel") return null;
      }
      result.youtubeChannels = [...new Set(value.youtubeChannels)];
    }
    if (value.timeLimits !== undefined) {
      if (!object(value.timeLimits)) return null;
      const limits = value.timeLimits;
      result.timeLimits = {};
      for (const key of ["weekdayMinutes", "weekendMinutes"] as const) {
        if (limits[key] === undefined) continue;
        if (typeof limits[key] !== "number" || !Number.isInteger(limits[key]) || limits[key] < 0 || limits[key] > 1440) return null;
        result.timeLimits[key] = limits[key];
      }
      if (limits.downtime !== undefined) {
        const downtime = limits.downtime;
        if (!object(downtime) || typeof downtime.from !== "string" || typeof downtime.until !== "string"
          || !/^([01]\d|2[0-3]):[0-5]\d$/.test(downtime.from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(downtime.until)) return null;
        Object.assign(result.timeLimits, { downtimeEnabled: true, start: downtime.from, end: downtime.until });
      }
    }
    return result;
  } catch { return null; }
}
export function managedTabletPreferences(local: TabletPreferences, managed?: Partial<TabletPreferences>): TabletPreferences {
  return { ...local, ...managed };
}
export function preserveLocalManagedValues<T extends object>(local: T, next: T, managed?: Partial<T>): T {
  const result = { ...next };
  for (const key of Object.keys(managed ?? {}) as (keyof T)[]) result[key] = local[key];
  return result;
}
