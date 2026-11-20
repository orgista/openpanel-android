import { useEffect, useRef, useState } from "react";
import type { TabletPreferences, Wallpaper } from "../native/tabletAppearance";
import { TabletIdentity } from "./TabletIdentity";
import { TabletClock } from "./TabletClock";
import { TabletWallpaper } from "./TabletWallpaper";
import { LockGreeting, WeatherNow } from "./Weather";
import type { WeatherCache } from "../native/weather";

export function TabletLockScreen({ preferences, wallpaper, time, weather, onWake }: {
  preferences: TabletPreferences; wallpaper: Wallpaper; time: Date; weather?: WeatherCache | null; onWake: () => void;
}) {
  const [waking, setWaking] = useState(false);
  const start = useRef(0);
  useEffect(() => {
    if (!waking) return;
    const timer = window.setTimeout(onWake, 250);
    return () => window.clearTimeout(timer);
  }, [waking, onWake]);
  const wake = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) onWake();
    else setWaking(true);
  };
  return <button className={`tablet-lock-screen${waking ? " tablet-lock-waking" : ""}`} aria-label="Wake tablet"
    onPointerDown={event => { event.stopPropagation(); start.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerUp={event => { if (event.clientY - start.current < -40) wake(); }}
    onKeyDown={event => event.stopPropagation()}
    // A tap wakes on its click, not on pointerup, so the click cannot land on the home after the lock screen is gone.
    onClick={wake}>
    {preferences.lockBackground === "wallpaper" && <TabletWallpaper wallpaper={wallpaper} />}
    <span className="tablet-lock-content">
      <TabletClock time={time} style={preferences.clockStyle} />
      {weather && preferences.clockStyle === "analog" && <WeatherNow weather={weather} />}
      <TabletIdentity preferences={preferences} lock />
    </span>
    {preferences.clockStyle !== "analog" && <LockGreeting time={time} weather={weather} />}
    <span className="tablet-wake-bar" aria-hidden="true" />
  </button>;
}
