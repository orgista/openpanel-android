import { useEffect, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { SystemBridge } from "./SystemBridge";
import { parseManagedSettings, type ManagedSettings } from "./managedSettings";
import { recordDiagnostic } from "./diagnostics";
import { compactChannelArtUrl, parseYouTubeSource, type KioskYouTubeItem } from "./youtube";

export function useManagedSettings(enabled: boolean) {
  const [settings, setSettings] = useState<ManagedSettings | null>(null);
  const [channels, setChannels] = useState<KioskYouTubeItem[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let reading = false;
    let previous: string | null | undefined;
    const refresh = async () => {
      if (reading) return;
      reading = true;
      try {
        const { contents, error } = await SystemBridge.readManagedSettings();
        const fingerprint = error ?? contents;
        if (cancelled || fingerprint === previous) return;
        previous = fingerprint;
        const parsed = contents === null ? null : parseManagedSettings(contents);
        if (error || (contents !== null && !parsed)) recordDiagnostic("warning", "Managed settings ignored: invalid or unreadable file");
        setSettings(parsed);
      } catch {
        if (!cancelled && previous !== "unavailable") {
          previous = "unavailable";
          recordDiagnostic("warning", "Managed settings unavailable");
          setSettings(null);
        }
      } finally { reading = false; }
    };
    let listener: PluginListenerHandle | undefined;
    void SystemBridge.addListener("foreground", () => void refresh()).then(handle => {
      if (cancelled) void handle.remove();
      else listener = handle;
    }).catch(() => recordDiagnostic("warning", "Managed settings foreground refresh unavailable"));
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => { cancelled = true; void listener?.remove(); clearInterval(timer); document.removeEventListener("visibilitychange", resume); window.removeEventListener("focus", resume); };
  }, [enabled]);
  useEffect(() => {
    let cancelled = false;
    setChannels([]);
    void Promise.all((settings?.youtubeChannels ?? []).map(async (input): Promise<KioskYouTubeItem | null> => {
      const source = parseYouTubeSource(/^UC[\w-]{22}$/.test(input) ? `https://www.youtube.com/channel/${input}` : input)!;
      try {
        const { channel } = await SystemBridge.resolveYouTubeChannel({ input });
        // The WebView cannot be relied on to load channel art itself; inline it as hand-added channels do.
        const art = channel.thumbnailUrl
          ? await SystemBridge.fetchImageAsDataUrl({ url: compactChannelArtUrl(channel.thumbnailUrl) }).then(result => result.dataUrl || channel.thumbnailUrl, () => channel.thumbnailUrl)
          : undefined;
        return { ...parseYouTubeSource(channel.sourceUrl)!, id: `managed:${channel.sourceId}`, title: channel.title, thumbnailUrl: art ?? undefined, addedAt: 0 };
      } catch {
        // Canonical IDs work offline; handles require the existing channel resolver.
        if (/^UC[\w-]{22}$/.test(source.sourceLabel)) return { ...source, id: `managed:${source.sourceLabel}`, title: source.sourceLabel, addedAt: 0 };
        recordDiagnostic("warning", "Managed channel could not be resolved");
        return null;
      }
    })).then(items => { if (!cancelled) setChannels(items.filter((item): item is KioskYouTubeItem => item !== null)); });
    return () => { cancelled = true; };
  }, [settings?.youtubeChannels]);
  return { settings, channels };
}
