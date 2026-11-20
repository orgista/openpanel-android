export type WeatherCondition = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "heavy" | "snow" | "thunder";
export type WeatherUnit = "fahrenheit" | "celsius";
export type SkyPhase = "day" | "night" | "dawn" | "dusk";
export interface WeatherPlace { name: string; region: string; country: string; latitude: number; longitude: number }
export interface WeatherHour { time: number; temp: number; code: number; isDay: boolean }
export interface WeatherDay { date: number; code: number; max: number; min: number; precip: number; sunrise: number; sunset: number }
export interface Forecast { offset: number; current: { temp: number; code: number; isDay: boolean }; hourly: WeatherHour[]; daily: WeatherDay[] }
export interface WeatherCache { key: string; fetchedAt: number; forecast: Forecast }

export const WEATHER_REFRESH_MS = 30 * 60_000;
export const WEATHER_RETRY_MS = 60_000;
export const WEATHER_MAX_AGE_MS = 6 * 3_600_000;
const TWILIGHT_MS = 45 * 60_000;
const cacheKey = "openpanel.weather.v1";

export const conditionLabels: Record<WeatherCondition, string> = {
  clear: "Clear", partly: "Partly Cloudy", cloudy: "Cloudy", fog: "Fog", drizzle: "Drizzle",
  rain: "Rain", heavy: "Heavy Rain", snow: "Snow", thunder: "Thunderstorm",
};

export function weatherCondition(code: number): WeatherCondition {
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 65 || code === 67 || code === 82) return "heavy";
  if ((code >= 61 && code <= 67) || code === 80 || code === 81) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95 && code <= 99) return "thunder";
  return "cloudy";
}

export function skyPhase(days: WeatherDay[], now: number): SkyPhase {
  if (days.some(day => Math.abs(now - day.sunrise) <= TWILIGHT_MS)) return "dawn";
  if (days.some(day => Math.abs(now - day.sunset) <= TWILIGHT_MS)) return "dusk";
  return days.some(day => now > day.sunrise && now < day.sunset) ? "day" : "night";
}

export function defaultWeatherUnit(locale = typeof navigator === "undefined" ? "" : navigator.language): WeatherUnit {
  return /-US$/i.test(locale) ? "fahrenheit" : "celsius";
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 80) : "";

export function normalizeWeatherPlace(value: unknown): WeatherPlace | null {
  if (!value || typeof value !== "object") return null;
  const place = value as Record<string, unknown>;
  const name = text(place.name);
  if (!name || !finite(place.latitude) || !finite(place.longitude) || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return null;
  return { name, region: text(place.region), country: text(place.country), latitude: place.latitude, longitude: place.longitude };
}

export const weatherKey = (place: WeatherPlace, unit: WeatherUnit) => `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)},${unit}`;

function localTime(value: unknown, offset: number): number | null {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value) : null;
  if (!match) return null;
  const [, y, m, d, h = "0", min = "0"] = match;
  return Date.UTC(+y, +m - 1, +d, +h, +min) - offset * 1000;
}

function columns(source: unknown, keys: string[]): unknown[][] | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const values = keys.map(key => record[key]);
  if (!values.every(Array.isArray)) return null;
  const length = (values[0] as unknown[]).length;
  return length && values.every(value => (value as unknown[]).length === length) ? values as unknown[][] : null;
}

export function parseForecast(value: unknown): Forecast | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const offset = finite(body.utc_offset_seconds) ? body.utc_offset_seconds : null;
  const current = body.current as Record<string, unknown> | undefined;
  const hourly = columns(body.hourly, ["time", "temperature_2m", "weather_code", "is_day"]);
  const daily = columns(body.daily, ["time", "weather_code", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset", "precipitation_probability_max"]);
  if (offset === null || !current || !finite(current.temperature_2m) || !finite(current.weather_code) || !hourly || !daily) return null;
  const hours: WeatherHour[] = [];
  for (const [index, time] of hourly[0].entries()) {
    const at = localTime(time, offset), temp = hourly[1][index], code = hourly[2][index];
    if (at === null || !finite(temp) || !finite(code)) return null;
    hours.push({ time: at, temp, code, isDay: hourly[3][index] === 1 });
  }
  const days: WeatherDay[] = [];
  for (const [index, time] of daily[0].entries()) {
    const date = localTime(time, 0), sunrise = localTime(daily[4][index], offset), sunset = localTime(daily[5][index], offset);
    const [code, max, min, precip] = [daily[1][index], daily[2][index], daily[3][index], daily[6][index]];
    if (date === null || sunrise === null || sunset === null || !finite(code) || !finite(max) || !finite(min)) return null;
    days.push({ date, code, max, min, precip: finite(precip) ? precip : 0, sunrise, sunset });
  }
  return { offset, current: { temp: current.temperature_2m, code: current.weather_code, isDay: current.is_day === 1 }, hourly: hours, daily: days };
}

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
const defaultStorage = (): StorageLike | null => { try { return localStorage; } catch { return null; } };

export function loadWeatherCache(storage = defaultStorage()): WeatherCache | null {
  try {
    const value = JSON.parse(storage?.getItem(cacheKey) ?? "null") as { key?: unknown; fetchedAt?: unknown; body?: unknown } | null;
    const forecast = parseForecast(value?.body);
    return forecast && typeof value?.key === "string" && finite(value.fetchedAt) ? { key: value.key, fetchedAt: value.fetchedAt, forecast } : null;
  } catch { return null; }
}

export function saveWeatherCache(key: string, fetchedAt: number, body: unknown, storage = defaultStorage()) {
  try { storage?.setItem(cacheKey, JSON.stringify({ key, fetchedAt, body })); } catch { /* the in-memory copy still shows */ }
}

export const freshWeather = (cache: WeatherCache | null, key: string, now: number) =>
  cache && cache.key === key && now - cache.fetchedAt >= -60_000 && now - cache.fetchedAt <= WEATHER_MAX_AGE_MS ? cache : null;

export function currentWeather({ forecast, fetchedAt }: WeatherCache, now: number) {
  const slot = forecast.hourly.find(hour => now >= hour.time && now < hour.time + 3_600_000);
  return now - fetchedAt < 3_600_000 || !slot ? forecast.current : slot;
}

const localDay = (forecast: Forecast, now: number) => {
  const local = new Date(now + forecast.offset * 1000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
};

export const upcomingDays = (forecast: Forecast, now: number) => {
  const today = localDay(forecast, now);
  return forecast.daily.filter(day => day.date >= today);
};

export function upcomingHours(cache: WeatherCache, now: number, count = 6): WeatherHour[] {
  const start = cache.forecast.hourly.findIndex(hour => hour.time + 3_600_000 > now);
  if (start < 0) return [];
  const latest = currentWeather(cache, now);
  return [{ ...cache.forecast.hourly[start], temp: latest.temp, code: latest.code, isDay: latest.isDay },
    ...cache.forecast.hourly.slice(start + 1, start + count)];
}

/** Worst weather code from now to local midnight; the daily code also covers hours already past (morning fog at 4 PM). */
export function restOfDayCode(cache: WeatherCache, now: number): number {
  const latest = currentWeather(cache, now);
  const today = upcomingDays(cache.forecast, now)[0];
  if (!today) return latest.code;
  const end = today.date + 86_400_000 - cache.forecast.offset * 1000;
  return cache.forecast.hourly
    .filter(hour => hour.time > now && hour.time < end)
    .reduce((worst, hour) => Math.max(worst, hour.code), latest.code);
}

export const hourLabel = (time: number, offset: number) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: "UTC" }).format(time + offset * 1000);
export const dayLabel = (date: number) => new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(date);

const forecastUrl = (place: WeatherPlace, unit: WeatherUnit) => `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}`
  + "&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m&hourly=temperature_2m,weather_code,is_day,precipitation_probability"
  + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&forecast_days=7&timezone=auto"
  + `&temperature_unit=${unit}&wind_speed_unit=${unit === "fahrenheit" ? "mph" : "kmh"}`;

export async function fetchForecast(place: WeatherPlace, unit: WeatherUnit): Promise<unknown> {
  const response = await fetch(forecastUrl(place, unit));
  if (!response.ok) throw new Error("Forecast unavailable");
  return response.json();
}

export async function searchPlaces(query: string): Promise<WeatherPlace[]> {
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=en&format=json`);
  if (!response.ok) throw new Error("Place search failed");
  const body = await response.json() as { results?: unknown };
  return (Array.isArray(body.results) ? body.results : []).map(result => normalizeWeatherPlace({ ...result as object,
    region: (result as { admin1?: unknown }).admin1 })).filter((place): place is WeatherPlace => !!place).slice(0, 6);
}
