import { useEffect, useMemo, useRef, useState } from "react";
import { preserveLocalManagedValues } from "./managedSettings";
import { SystemBridge } from "./SystemBridge";
import { advanceUsage, defaultTimeLimits, grantExtraTime, initialUsage, nextDowntimeAt, timeLimitStatus, type TimeLimits, type Usage } from "./timeLimits";
const settingsKey = "openpanel.time-limits.v1";
const usageKey = "openpanel.time-usage.v1";
function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}
export function useTimeLimits(enabled: boolean, managed?: Partial<TimeLimits>) {
  const [localSettings, setSettings] = useState(() => load(settingsKey, defaultTimeLimits));
  const settings = useMemo(() => ({ ...localSettings, ...managed }), [localSettings, managed]);
  const [usage, setUsage] = useState<Usage>(() => ({ ...load(usageKey, initialUsage(Date.now())), observing: false }));
  const usageRef = useRef(usage);
  const [banner, setBanner] = useState(false);
  const saveUsage = (next: Usage) => {
    localStorage.setItem(usageKey, JSON.stringify(next));
    usageRef.current = next;
    setUsage(next);
  };
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let sampling = false;
    const sample = async () => {
      if (sampling) return;
      sampling = true;
      try {
        const clock = await SystemBridge.getUsageClock();
        if (cancelled) return;
        saveUsage(advanceUsage(usageRef.current, { ...clock,
          observing: document.visibilityState === "visible" && clock.interactive && !clock.locked
            && timeLimitStatus(settings, usageRef.current).reason === null }));
      } catch (error) {
        console.warn("Could not sample usage clock", error);
      } finally { sampling = false; }
    };
    void sample();
    const timer = window.setInterval(() => void sample(), 1000);
    const armGuard = () => {
      const { remainingMs } = timeLimitStatus(settings, usageRef.current);
      void SystemBridge.setTimeGuard({
        budgetMs: Number.isFinite(remainingMs) && !usageRef.current.endedForDay ? remainingMs : -1,
        downtimeAt: nextDowntimeAt(settings, usageRef.current),
      }).catch(error => console.warn("Could not set the time guard", error));
    };
    // Native decides on pause whether to keep a guard service running, before the hidden-page call below lands.
    armGuard();
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        saveUsage({ ...usageRef.current, observing: false });
        armGuard();
      }
      void sample();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [enabled, settings]);
  const status = timeLimitStatus(settings, usage);
  useEffect(() => {
    if (!enabled || usage.warned || status.remainingMs <= 0 || status.remainingMs > 300_000) return;
    saveUsage({ ...usageRef.current, warned: true });
    setBanner(true);
    const timer = window.setTimeout(() => setBanner(false), 8000);
    return () => window.clearTimeout(timer);
  }, [enabled, status.remainingMs <= 300_000 && status.remainingMs > 0]);
  return { settings, usage, status, banner,
    updateSettings: (next: TimeLimits) => { const local = preserveLocalManagedValues(localSettings, next, managed); localStorage.setItem(settingsKey, JSON.stringify(local)); setSettings(local); },
    addTime: () => saveUsage(grantExtraTime(usageRef.current, settings)),
    endToday: () => saveUsage({ ...usageRef.current, endedForDay: true }),
  };
}
