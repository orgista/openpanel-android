import { useState, type FormEvent } from "react";
import type { TabletPreferences } from "../native/tabletAppearance";
import { searchPlaces, type WeatherPlace } from "../native/weather";
import { ToggleSwitch } from "./ToggleSwitch";

const placeDetail = (place: WeatherPlace) => [place.region, place.country].filter(Boolean).join(", ");

export function WeatherPanel({ preferences, onChange }: { preferences: TabletPreferences; onChange: (preferences: TabletPreferences) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherPlace[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const place = preferences.weatherPlace;
  const search = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setStatus("");
    try {
      const found = await searchPlaces(query);
      setResults(found);
      if (!found.length) setStatus("No places found");
    } catch {
      setResults([]); setStatus("Could not search");
    } finally { setBusy(false); }
  };
  return <div className="touch-settings-scroll tablet-settings weather-settings">
    <div className="system-list">
      <div className="system-list-row settings-value-row">Show weather
        <ToggleSwitch checked={preferences.weatherEnabled} disabled={!place} ariaLabel="Show weather"
          onChange={weatherEnabled => onChange({ ...preferences, weatherEnabled })} />
      </div>
    </div>
    <h3>Place</h3>
    <div className="system-list">
      {place && <div className="system-list-row weather-place-row" aria-label="Current place"><span>{place.name}</span><span>{placeDetail(place)}</span></div>}
      <form className="system-list-row weather-search" onSubmit={event => void search(event)}>
        <input type="search" aria-label="Place" placeholder="City or town" enterKeyHint="search" maxLength={80}
          value={query} onChange={event => setQuery(event.target.value)} />
        <button type="submit" disabled={busy || !query.trim()}>Search</button>
      </form>
      {status && <div className="system-list-row settings-row-status" role="status">{status}</div>}
      {results.map(result => <button type="button" key={`${result.latitude},${result.longitude}`} className="system-list-row weather-place-row"
        onClick={() => {
          onChange({ ...preferences, weatherPlace: result, weatherEnabled: place ? preferences.weatherEnabled : true });
          setResults([]); setQuery("");
        }}>
        <span>{result.name}</span><span>{placeDetail(result)}</span>
      </button>)}
    </div>
    <h3>Units</h3>
    <div className="weather-units" role="group" aria-label="Temperature unit">
      {([["fahrenheit", "°F"], ["celsius", "°C"]] as const).map(([unit, label]) =>
        <button key={unit} type="button" aria-pressed={preferences.weatherUnit === unit} onClick={() => onChange({ ...preferences, weatherUnit: unit })}>{label}</button>)}
    </div>
  </div>;
}
