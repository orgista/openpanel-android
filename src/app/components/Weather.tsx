import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { conditionLabels, currentWeather, dayLabel, hourLabel, restOfDayCode, skyPhase, upcomingDays, upcomingHours, weatherCondition,
  type SkyPhase, type WeatherCache, type WeatherCondition } from "../native/weather";

const skies: Record<"clear" | "grey" | "rain", Record<SkyPhase, [string, string]>> = {
  clear: { day: ["#2c78cf", "#7fb7ea"], dawn: ["#3c5797", "#e9a27c"], dusk: ["#38397a", "#df7f69"], night: ["#08122d", "#1c2c55"] },
  grey: { day: ["#5c7187", "#9cabbc"], dawn: ["#575e79", "#b39a93"], dusk: ["#4a4c67", "#9f8389"], night: ["#171e2d", "#2b3445"] },
  rain: { day: ["#36434f", "#627385"], dawn: ["#3b4256", "#776c71"], dusk: ["#33374a", "#6b5f6e"], night: ["#0c1119", "#1d2532"] },
};
const tone = (condition: WeatherCondition) =>
  condition === "clear" || condition === "partly" ? "clear" : condition === "cloudy" || condition === "fog" || condition === "snow" ? "grey" : "rain";
const cloudCount: Record<WeatherCondition, number> = { clear: 0, partly: 2, cloudy: 4, fog: 0, drizzle: 2, rain: 3, heavy: 3, snow: 2, thunder: 3 };
const drops: Partial<Record<WeatherCondition, [count: number, seconds: number]>> = { drizzle: [12, 1.8], rain: [22, 1.1], heavy: [30, .75], thunder: [24, .9] };
const clouds = [
  { top: "6%", left: "52%", width: 220, opacity: .9, seconds: 38 }, { top: "30%", left: "8%", width: 260, opacity: .7, seconds: 52 },
  { top: "-6%", left: "28%", width: 320, opacity: .6, seconds: 44 }, { top: "50%", left: "66%", width: 240, opacity: .75, seconds: 60 },
];
// Home: the sky is as wide as the screen, so clouds keep to the top edge, clear of the temperature, and more falls.
const openClouds = [
  { top: "-3%", left: "34%", width: 300, opacity: .8, seconds: 44 }, { top: "2%", left: "54%", width: 240, opacity: .85, seconds: 38 },
  { top: "-1%", left: "72%", width: 280, opacity: .65, seconds: 52 }, { top: "1%", left: "16%", width: 220, opacity: .6, seconds: 60 },
];
const OPEN_DENSITY = 3;
const scatter = (index: number, step: number) => (index * step + 7) % 100;

export function WeatherSky({ condition, phase, paused = false, open = false }: { condition: WeatherCondition; phase: SkyPhase; paused?: boolean; open?: boolean }) {
  const [top, bottom] = skies[tone(condition)][phase];
  const celestial = condition === "clear" || condition === "partly";
  const night = phase === "night";
  const [baseDrops, seconds] = drops[condition] ?? [0, 0];
  const density = open ? OPEN_DENSITY : 1;
  const dropCount = baseDrops * density;
  const shade = `cloud-shade-${useId().replace(/:/g, "")}`;
  return <span className="weather-sky" aria-hidden="true" data-phase={phase} data-tone={tone(condition)} data-paused={paused || undefined}
    style={{ "--sky-top": top, "--sky-bottom": bottom } as CSSProperties}>
    {celestial && !night && <span className="weather-sun">
      <svg className="weather-rays" viewBox="0 0 200 200">{Array.from({ length: 12 }, (_, index) =>
        <line key={index} x1="100" y1="8" x2="100" y2="38" transform={`rotate(${index * 30} 100 100)`} />)}</svg>
    </span>}
    {celestial && night && <>
      {Array.from({ length: condition === "clear" ? 14 : 6 }, (_, index) => <span key={index} className="weather-star" style={{
        left: `${scatter(index, 37)}%`, top: `${scatter(index, 23) * .7}%`, animationDuration: `${2.5 + index % 3}s`, animationDelay: `-${index * .7}s` }} />)}
      <svg className="weather-moon" viewBox="0 0 48 48"><path d="M26 6a16 16 0 1 0 14 22A13 13 0 1 1 26 6z" /></svg>
    </>}
    {condition === "fog" && [10, 40, 68].map((top, index) => <span key={top} className="weather-haze"
      style={{ top: `${top}%`, animationDuration: `${18 + index * 7}s`, animationDelay: `-${index * 5}s` }} />)}
    {(open ? openClouds : clouds).slice(0, cloudCount[condition]).map((cloud, index) => <svg key={index} className="weather-cloud" viewBox="0 0 120 60"
      style={{ top: cloud.top, left: cloud.left, width: cloud.width, opacity: cloud.opacity, animationDuration: `${cloud.seconds}s`, animationDelay: `-${index * 9}s` }}>
      {index === 0 && <defs><linearGradient id={shade} x1="0" y1="0" x2="0" y2="1">
        <stop offset=".3" className="weather-cloud-top" /><stop offset="1" className="weather-cloud-belly" /></linearGradient></defs>}
      <path fill={`url(#${shade})`} d="M26 52h70a18 18 0 0 0 2-36 26 26 0 0 0-48-6A20 20 0 0 0 22 22a15 15 0 0 0 4 30z" /></svg>)}
    {Array.from({ length: dropCount }, (_, index) => <span key={index} className="weather-drop" data-size={condition} style={{
      left: `${scatter(index, 41)}%`, "--y": `${scatter(index, 29) * .9}%`,
      animationDuration: `${seconds * (1 + index % 4 * .12)}s`, animationDelay: `-${(index * .23) % seconds}s` } as CSSProperties} />)}
    {condition === "snow" && Array.from({ length: 18 * density }, (_, index) => <span key={index} className="weather-flake" style={{
      left: `${scatter(index, 43)}%`, "--y": `${scatter(index, 31) * .9}%`, width: (open ? 5 : 4) + index % 4, height: (open ? 5 : 4) + index % 4,
      animationDuration: `${7 + index % 5}s`, animationDelay: `-${index * .6}s` } as CSSProperties} />)}
    {condition === "thunder" && <>
      <span className="weather-flash" />
      <svg className="weather-bolt" viewBox="0 0 40 100"><path d="M24 0 8 52h12L12 100 34 38H21L30 0z" /></svg>
    </>}
  </span>;
}

export function WeatherGlyph({ condition, night = false, size = 28 }: { condition: WeatherCondition; night?: boolean; size?: number }) {
  const sky = night ? <path className="glyph-moon" d="M13 3.5a8 8 0 1 0 7.5 10.5A6.5 6.5 0 1 1 13 3.5z" />
    : <g className="glyph-sun"><circle cx="12" cy="12" r="4.5" />{Array.from({ length: 8 }, (_, index) =>
      <line key={index} x1="12" y1="2" x2="12" y2="4.5" transform={`rotate(${index * 45} 12 12)`} />)}</g>;
  const falling = condition === "drizzle" ? 2 : condition === "rain" ? 3 : condition === "heavy" ? 4 : 0;
  return <svg className="weather-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {condition === "clear" && sky}
    {condition === "partly" && <g transform="translate(-3 -3) scale(.75)">{sky}</g>}
    {condition === "fog" ? <g className="glyph-fog">{[8, 12, 16].map(y => <line key={y} x1={y === 12 ? 5 : 3} y1={y} x2={y === 12 ? 21 : 19} y2={y} />)}</g>
      : condition !== "clear" && <path className="glyph-cloud" transform={condition === "partly" || condition === "cloudy" ? "translate(1 1)" : "translate(0 -3)"}
        d="M7 19h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.6 4.75 4.75 0 0 0 7 19z" />}
    {falling > 0 && <g className="glyph-rain">{Array.from({ length: falling }, (_, index) => {
      const x = 12 - (falling - 1) * 2 + index * 4;
      return <line key={index} x1={x} y1="18.5" x2={x - 1.2} y2={falling > 3 ? 23 : 21.5} />;
    })}</g>}
    {condition === "snow" && <g className="glyph-snow">{[8, 12, 16].map((x, index) => <circle key={x} cx={x} cy={index === 1 ? 21.5 : 19.5} r="1.2" />)}</g>}
    {condition === "thunder" && <path className="glyph-bolt" d="M13 15.5 10 20h2.5l-1.5 3.5 4-5h-2.5l1.5-3z" />}
  </svg>;
}

const degrees = (value: number) => `${Math.round(value)}°`;

function WeatherSummary({ weather, place, now }: { weather: WeatherCache; place: string; now: number }) {
  const latest = currentWeather(weather, now);
  const today = upcomingDays(weather.forecast, now)[0];
  return <span className="weather-summary">
    <span className="weather-place">{place}</span>
    <span className="weather-temp">{degrees(latest.temp)}</span>
    <span className="weather-detail">{conditionLabels[weatherCondition(latest.code)]}</span>
    {today && <span className="weather-detail">{`H:${degrees(today.max)} L:${degrees(today.min)}`}</span>}
  </span>;
}

function WeatherSheet({ weather, place, paused, onClose }: { weather: WeatherCache; place: string; paused: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const now = Date.now();
  const days = upcomingDays(weather.forecast, now);
  const low = Math.min(...days.map(day => day.min)), high = Math.max(...days.map(day => day.max));
  const span = Math.max(1, high - low);
  return <div className="settings-modal-backdrop weather-sheet-backdrop" data-input-mode="touch" data-dpad-scope
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <section className="settings-modal-card weather-sheet" role="dialog" aria-modal="true" aria-label="Weather">
      <header className="weather-sheet-header">
        <WeatherSky condition={weatherCondition(currentWeather(weather, now).code)} phase={skyPhase(weather.forecast.daily, now)} paused={paused} />
        <WeatherSummary weather={weather} place={place} now={now} />
        <button ref={closeRef} type="button" className="weather-sheet-close" aria-label="Close weather" onClick={onClose}><X size={22} /></button>
      </header>
      <ol className="weather-days">
        {days.map((day, index) => <li key={day.date}>
          <span className="weather-day-name">{index === 0 ? "Today" : dayLabel(day.date)}</span>
          <span className="weather-day-glyph"><WeatherGlyph condition={weatherCondition(day.code)} />
            {day.precip >= 20 && <span className="weather-precip">{`${Math.round(day.precip)}%`}</span>}</span>
          <span className="weather-day-low">{degrees(day.min)}</span>
          <span className="weather-range"><span style={{ left: `${(day.min - low) / span * 100}%`, width: `${(day.max - day.min) / span * 100}%` }} /></span>
          <span className="weather-day-high">{degrees(day.max)}</span>
        </li>)}
      </ol>
    </section>
  </div>;
}

export function WeatherCard({ weather, place, paused }: { weather: WeatherCache | null; place: string; paused: boolean }) {
  const [open, setOpen] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const ref = useRef<HTMLButtonElement>(null);
  const ready = !!weather;
  useEffect(() => {
    if (!ready || !ref.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ready]);
  if (!weather) return <div className="weather-card weather-card-placeholder" aria-hidden="true" />;
  const now = Date.now();
  const latest = currentWeather(weather, now);
  return <>
    <button ref={ref} type="button" className="weather-card" onClick={() => setOpen(true)}>
      <WeatherSky open condition={weatherCondition(latest.code)} phase={skyPhase(weather.forecast.daily, now)} paused={paused || open || !onScreen} />
      <WeatherSummary weather={weather} place={place} now={now} />
      <span className="weather-hours">
        {upcomingHours(weather, now).map((hour, index) => <span key={hour.time} className="weather-hour">
          <span>{index === 0 ? "Now" : hourLabel(hour.time, weather.forecast.offset)}</span>
          <WeatherGlyph condition={weatherCondition(hour.code)} night={!hour.isDay} />
          <span>{degrees(hour.temp)}</span>
        </span>)}
      </span>
    </button>
    {open && <WeatherSheet weather={weather} place={place} paused={paused} onClose={() => setOpen(false)} />}
  </>;
}

export function WeatherNow({ weather }: { weather: WeatherCache }) {
  const latest = currentWeather(weather, Date.now());
  const condition = weatherCondition(latest.code);
  const today = upcomingDays(weather.forecast, Date.now())[0];
  return <span className="tablet-lock-weather">
    <WeatherGlyph condition={condition} night={!latest.isDay} size={26} />{`${degrees(latest.temp)} ${conditionLabels[condition]}`}
    {today && <span className="tablet-lock-range">{`H:${degrees(today.max)} L:${degrees(today.min)}`}</span>}
  </span>;
}

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

/** Lower block of the lock screen: greeting, one sentence about today, and the temperature large. */
export function LockGreeting({ time, weather }: { time: Date; weather?: WeatherCache | null }) {
  const latest = weather ? currentWeather(weather, time.getTime()) : null;
  const days = weather ? upcomingDays(weather.forecast, time.getTime()) : [];
  const hour = time.getHours();
  // From evening on, today's high is behind: describe tonight and the coming low instead.
  const tonightLow = hour >= 17 ? days[1] : hour < 5 ? days[0] : undefined;
  return <span className="tablet-lock-greeting">
    <span className="tablet-lock-greeting-title">{greetingFor(hour)}</span>
    {weather && latest && days[0] && <span className="tablet-lock-greeting-text">
      {tonightLow
        ? `${conditionLabels[weatherCondition(latest.code)]} tonight. The low will be ${degrees(tonightLow.min)}.`
        : `${conditionLabels[weatherCondition(restOfDayCode(weather, time.getTime()))]} today. The high will be ${degrees(days[0].max)}.`}
    </span>}
    {latest && <span className="tablet-lock-greeting-now">
      <WeatherGlyph condition={weatherCondition(latest.code)} night={!latest.isDay} size={72} />{degrees(latest.temp)}
    </span>}
  </span>;
}
