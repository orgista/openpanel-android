import { useEffect, useState } from "react";

export function millisecondsUntilNextMinute(now: number): number {
  return 60_000 - now % 60_000;
}
export function useMinuteClock(enabled = true): Date {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      setTime(new Date());
      timer = window.setTimeout(update, millisecondsUntilNextMinute(Date.now()));
    };
    const resume = () => { if (document.visibilityState === "visible") update(); };
    update();
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", resume); };
  }, [enabled]);
  return time;
}
