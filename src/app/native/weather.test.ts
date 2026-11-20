import { describe, expect, it } from "vitest";
import { conditionLabels, currentWeather, defaultWeatherUnit, freshWeather, loadWeatherCache, parseForecast, restOfDayCode, saveWeatherCache, skyPhase,
  upcomingDays, upcomingHours, weatherCondition, weatherKey, WEATHER_MAX_AGE_MS, type WeatherCondition } from "./weather";
import { afternoon, forecastBody } from "./weather.fixture";

describe("weather conditions", () => {
  it("maps WMO codes to the small condition set", () => {
    const expected: [number[], WeatherCondition][] = [[[0, 1], "clear"], [[2], "partly"], [[3, 10], "cloudy"], [[45, 48], "fog"],
      [[51, 53, 55, 56, 57], "drizzle"], [[61, 63, 66, 80, 81], "rain"], [[65, 67, 82], "heavy"], [[71, 73, 75, 77, 85, 86], "snow"], [[95, 96, 99], "thunder"]];
    for (const [codes, condition] of expected) for (const code of codes) expect(weatherCondition(code)).toBe(condition);
    expect(new Set(Object.values(conditionLabels)).size).toBe(9);
  });

  it("uses day, night and 45 minute dawn and dusk windows around the local sunrise and sunset", () => {
    const days = parseForecast(forecastBody())!.daily;
    const sunrise = Date.UTC(2026, 10, 11, 11, 45), sunset = Date.UTC(2026, 10, 11, 21, 40);
    expect(skyPhase(days, sunrise - 44 * 60_000)).toBe("dawn");
    expect(skyPhase(days, sunrise + 45 * 60_000)).toBe("dawn");
    expect(skyPhase(days, sunrise - 46 * 60_000)).toBe("night");
    expect(skyPhase(days, sunrise + 46 * 60_000)).toBe("day");
    expect(skyPhase(days, sunset - 30 * 60_000)).toBe("dusk");
    expect(skyPhase(days, sunset + 46 * 60_000)).toBe("night");
  });

  it("defaults to Fahrenheit only for en-US", () => {
    expect(defaultWeatherUnit("en-US")).toBe("fahrenheit");
    expect(defaultWeatherUnit("en-GB")).toBe("celsius");
    expect(defaultWeatherUnit("")).toBe("celsius");
  });
});

describe("forecast response", () => {
  it("accepts a valid response and reads local times with the place's offset", () => {
    const forecast = parseForecast(forecastBody())!;
    expect(forecast.current).toEqual({ temp: 54.4, code: 3, isDay: true });
    expect(forecast.hourly).toHaveLength(48);
    expect(forecast.hourly[14].time).toBe(afternoon);
    expect(forecast.daily[1]).toMatchObject({ code: 71, max: 45, min: 30, precip: 60 });
  });

  it("rejects missing, mismatched or non-numeric data", () => {
    const body = forecastBody();
    for (const bad of [null, "x", { ...body, current: undefined }, { ...body, utc_offset_seconds: "0" },
      { ...body, hourly: { ...body.hourly, temperature_2m: [1] } }, { ...body, daily: { ...body.daily, sunrise: ["soon", "later"] } },
      { ...body, daily: { ...body.daily, temperature_2m_max: [null, 45] } }, { ...body, hourly: { ...body.hourly, time: [] } }]) {
      expect(parseForecast(bad)).toBeNull();
    }
  });

  it("keeps the cache only for the same place and unit and hides it after six hours", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const key = weatherKey({ name: "A", region: "", country: "", latitude: 40.1234, longitude: -74.5 }, "fahrenheit");
    saveWeatherCache(key, afternoon, forecastBody(), storage);
    const cache = loadWeatherCache(storage);
    expect(cache?.forecast.daily).toHaveLength(2);
    expect(freshWeather(cache, key, afternoon + WEATHER_MAX_AGE_MS)).toBe(cache);
    expect(freshWeather(cache, key, afternoon + WEATHER_MAX_AGE_MS + 1)).toBeNull();
    expect(freshWeather(cache, key.replace("fahrenheit", "celsius"), afternoon)).toBeNull();
    values.set("openpanel.weather.v1", JSON.stringify({ key, fetchedAt: afternoon, body: { current: {} } }));
    expect(loadWeatherCache(storage)).toBeNull();
    values.set("openpanel.weather.v1", "{");
    expect(loadWeatherCache(storage)).toBeNull();
  });

  it("lists the next hours from now and moves to the hourly forecast once the current reading is old", () => {
    const cache = { key: "k", fetchedAt: afternoon, forecast: parseForecast(forecastBody())! };
    const hours = upcomingHours(cache, afternoon + 20 * 60_000);
    expect(hours).toHaveLength(6);
    expect(hours[0]).toMatchObject({ time: afternoon, temp: 54.4, code: 3 });
    expect(hours[1]).toMatchObject({ temp: 55, code: 61 });
    expect(currentWeather(cache, afternoon + 2 * 3_600_000)).toMatchObject({ temp: 56, code: 61 });
    expect(upcomingDays(cache.forecast, afternoon + 24 * 3_600_000)).toHaveLength(1);
  });

  it("describes the rest of today, not hours already past or tomorrow", () => {
    const body = forecastBody();
    body.hourly.weather_code = body.hourly.time.map((_, index) => index < 12 ? 45 : index < 24 ? 3 : 71);
    body.daily.weather_code = [45, 71];
    const cache = { key: "k", fetchedAt: afternoon, forecast: parseForecast(body)! };
    expect(restOfDayCode(cache, afternoon)).toBe(3);
    body.hourly.weather_code[20] = 61;
    expect(restOfDayCode({ ...cache, forecast: parseForecast(body)! }, afternoon)).toBe(61);
  });
});
