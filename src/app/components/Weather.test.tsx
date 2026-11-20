import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen";
import { LockGreeting, WeatherSky, greetingFor } from "./Weather";
import { WeatherPanel } from "./WeatherSettings";
import { TabletLockScreen } from "./TabletLockScreen";
import { defaultTabletPreferences, wallpapers } from "../native/tabletAppearance";
import { parseForecast } from "../native/weather";
import { afternoon, forecastBody } from "../native/weather.fixture";

const cache = { key: "k", fetchedAt: afternoon, forecast: parseForecast(forecastBody())! };
const home = { apps: [], libraryItems: [], youtubeItems: [], featured: null, heroItem: null,
  standalone: true, onSelect: vi.fn(), onLaunch: vi.fn(), onHeroLaunch: vi.fn() };
const place = { name: "Springfield", region: "Illinois", country: "United States", latitude: 39.8, longitude: -89.64 };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(afternoon); });
afterEach(() => vi.useRealTimers());

describe("weather widget", () => {
  it("renders nothing when weather is off or there is no data", () => {
    for (const weather of [null, { cache: null, pending: false, place: "Springfield", paused: false }]) {
      const html = renderToStaticMarkup(<HomeScreen {...home} touch remoteMode={false} weather={weather} />);
      expect(html).not.toContain("weather-card");
      expect(html).toContain("touch-home-only");
    }
  });

  it("reserves the card while the first fetch runs and counts as a home section", () => {
    const html = renderToStaticMarkup(<HomeScreen {...home} touch remoteMode={false} weather={{ cache: null, pending: true, place: "Springfield", paused: false }} />);
    expect(html).toContain("weather-card-placeholder");
    expect(html).not.toContain("touch-home-only");
  });

  it("shows the place, current reading, today's range and six hours", () => {
    const html = renderToStaticMarkup(<HomeScreen {...home} touch remoteMode={false} appsLoading weather={{ cache, pending: false, place: "Springfield", paused: false }} />);
    expect(html).toContain("Springfield");
    expect(html).toContain('class="weather-temp">54°');
    expect(html).toContain("Cloudy");
    expect(html).toContain("H:61° L:48°");
    expect(html.match(/class="weather-hour"/g)).toHaveLength(6);
    expect(html).toContain(">Now<");
    expect(html.indexOf("weather-card")).toBeLessThan(html.indexOf("app-icon-grid"));
  });

  it("leaves remote markup unchanged", () => {
    const render = (weather?: { cache: typeof cache; pending: boolean; place: string; paused: boolean }) =>
      renderToStaticMarkup(<HomeScreen {...home} touch={false} remoteMode weather={weather} />);
    expect(render({ cache, pending: true, place: "Springfield", paused: false })).toBe(render());
  });

  it("draws the sky layers for each condition and pauses them on request", () => {
    const count = (html: string, name: string) => (html.match(new RegExp(`class="${name}"`, "g")) ?? []).length;
    const clearNight = renderToStaticMarkup(<WeatherSky condition="clear" phase="night" />);
    expect(count(clearNight, "weather-star")).toBe(14); expect(clearNight).toContain("weather-moon"); expect(clearNight).not.toContain("weather-sun");
    expect(renderToStaticMarkup(<WeatherSky condition="clear" phase="day" />)).toContain("weather-sun");
    expect(count(renderToStaticMarkup(<WeatherSky condition="heavy" phase="day" />), "weather-drop")).toBe(30);
    expect(count(renderToStaticMarkup(<WeatherSky condition="snow" phase="day" />), "weather-flake")).toBe(18);
    expect(count(renderToStaticMarkup(<WeatherSky condition="fog" phase="dusk" />), "weather-haze")).toBe(3);
    const storm = renderToStaticMarkup(<WeatherSky condition="thunder" phase="day" paused />);
    expect(storm).toContain("weather-flash"); expect(storm).toContain('data-paused="true"');
  });

  it("shows the weather once on the lock screen: in the greeting, or beside the analog clock that has none", () => {
    const lock = (weather: typeof cache | null, clockStyle: "date" | "analog" = "date") => renderToStaticMarkup(<TabletLockScreen
      preferences={{ ...defaultTabletPreferences, clockStyle }} wallpaper={wallpapers[0]} time={new Date(afternoon)} weather={weather} onWake={vi.fn()} />);
    expect(lock(cache)).not.toContain("tablet-lock-weather");
    expect(lock(cache)).toContain("Good Afternoon");
    expect(lock(cache)).toContain("The high will be");
    expect(lock(cache)).not.toContain("currently");
    expect((lock(cache).match(/54°/g) ?? [])).toHaveLength(1);
    expect(lock(cache, "analog")).toContain("54° Cloudy");
    expect(lock(cache, "analog")).toContain("tablet-lock-range");
    expect(lock(null, "analog")).not.toContain("tablet-lock-weather");
    expect(lock(null)).toContain("Good Afternoon");
    expect(lock(null)).not.toContain("tablet-lock-greeting-now");
  });
  it("describes tonight and the coming low from evening on", () => {
    const at = (time: Date) => renderToStaticMarkup(<LockGreeting time={time} weather={cache} />);
    const evening = at(new Date(2026, 10, 11, 20, 0));
    expect(evening).toContain("tonight");
    expect(evening).toContain("The low will be 30°");
    expect(evening).not.toContain("The high will be");
    expect(at(new Date(2026, 10, 12, 1, 0))).toContain("tonight");
  });
  it("greets by the hour", () => {
    expect([4, 5, 11, 12, 16, 17, 20, 21].map(greetingFor)).toEqual(["Good Night", "Good Morning", "Good Morning", "Good Afternoon", "Good Afternoon", "Good Evening", "Good Evening", "Good Night"]);
  });
});

describe("weather settings", () => {
  it("keeps the switch off until a place is chosen and shows the chosen place and unit", () => {
    const empty = renderToStaticMarkup(<WeatherPanel preferences={defaultTabletPreferences} onChange={vi.fn()} />);
    expect(empty).toMatch(/aria-checked="false"[^>]*aria-label="Show weather"[^>]*disabled/);
    expect(empty).toContain(">Search</button>");
    expect(empty).not.toContain("Current place");
    const chosen = renderToStaticMarkup(<WeatherPanel preferences={{ ...defaultTabletPreferences, weatherEnabled: true, weatherPlace: place, weatherUnit: "celsius" }} onChange={vi.fn()} />);
    expect(chosen).toContain('aria-checked="true"');
    expect(chosen).toContain("Springfield"); expect(chosen).toContain("Illinois, United States");
    expect(chosen).toContain('aria-pressed="true">°C');
  });
});
