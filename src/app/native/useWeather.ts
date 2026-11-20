import { useEffect, useState } from "react";
import { recordDiagnostic } from "./diagnostics";
import { fetchForecast, freshWeather, loadWeatherCache, parseForecast, saveWeatherCache, weatherKey, WEATHER_REFRESH_MS, WEATHER_RETRY_MS,
  type WeatherCache, type WeatherPlace, type WeatherUnit } from "./weather";

export function useWeather(enabled: boolean, place: WeatherPlace | null, unit: WeatherUnit) {
  const key = enabled && place ? weatherKey(place, unit) : null;
  const [cache, setCache] = useState<WeatherCache | null>(loadWeatherCache);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!key || !place) return;
    let cancelled = false, busy = false, retry = 0;
    const refresh = () => {
      setTick(tick => tick + 1);
      window.clearTimeout(retry);
      if (busy) return;
      const stored = loadWeatherCache();
      if (document.visibilityState !== "visible"
        || (stored?.key === key && Math.abs(Date.now() - stored.fetchedAt) < WEATHER_REFRESH_MS)) {
        setSettledKey(key);
        return;
      }
      busy = true;
      fetchForecast(place, unit).then(body => {
        const forecast = parseForecast(body);
        if (!forecast) throw new Error("Unreadable forecast");
        if (cancelled) return;
        const fetchedAt = Date.now();
        saveWeatherCache(key, fetchedAt, body);
        setCache({ key, fetchedAt, forecast });
      }).catch(error => {
        if (cancelled) return;
        recordDiagnostic("warning", "Weather update failed", { message: error instanceof Error ? error.message : String(error) });
        retry = window.setTimeout(refresh, WEATHER_RETRY_MS);
      }).finally(() => { busy = false; if (!cancelled) setSettledKey(key); });
    };
    refresh();
    const timer = window.setInterval(refresh, WEATHER_REFRESH_MS);
    const resume = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", resume);
    return () => { cancelled = true; window.clearInterval(timer); window.clearTimeout(retry); document.removeEventListener("visibilitychange", resume); };
  }, [key]);
  const fresh = key ? freshWeather(cache, key, Date.now()) : null;
  return { cache: fresh, pending: !!key && !fresh && settledKey !== key };
}
