import type { TimeLimits } from "../native/timeLimits";
import { ToggleSwitch } from "./ToggleSwitch";

// Android's own time dialog (input type="time") clips its Set button on landscape tablets.
const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) =>
  `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const clockLabel = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
};
export function TimeLimitsPanel({ settings, onChange, usedMs, managed }: {
  managed?: Partial<TimeLimits>;
  settings: TimeLimits; onChange: (settings: TimeLimits) => void; usedMs: number;
}) {
  return <div className="time-limits-panel">
    <h3>Daily limit</h3>
    <div className="system-list">
      {([['weekdayMinutes', 'Weekdays'], ['weekendMinutes', 'Weekends']] as const).map(([key, label]) =>
        <label className="system-list-row settings-value-row" key={key}>{label}{managed?.[key] !== undefined && <span>Managed</span>}
          <select disabled={managed?.[key] !== undefined} aria-label={label} value={settings[key]} onChange={e => onChange({ ...settings, [key]: Number(e.target.value) })}>
            {(settings[key] % 15 !== 0 || settings[key] > 360) && <option value={settings[key]}>{settings[key]} min</option>}
            <option value={0}>Off</option>
            {Array.from({ length: 24 }, (_, i) => (i + 1) * 15).map(minutes =>
              <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`}</option>)}
          </select>
        </label>)}
      <div className="system-list-row settings-value-row">Today<span>{Math.floor(usedMs / 60_000)} min</span></div>
    </div>
    <h3>Downtime</h3>
    <div className="system-list">
      <div className="system-list-row settings-value-row">Downtime
        <>{managed?.downtimeEnabled !== undefined && <span>Managed</span>}<ToggleSwitch disabled={managed?.downtimeEnabled !== undefined} ariaLabel="Downtime" checked={settings.downtimeEnabled} onChange={downtimeEnabled => onChange({ ...settings, downtimeEnabled })} /></>
      </div>
      {settings.downtimeEnabled && (['start', 'end'] as const).map(key =>
        <label className="system-list-row settings-value-row" key={key}>{key === 'start' ? 'From' : 'Until'}
          <select disabled={managed?.[key] !== undefined} aria-label={key === 'start' ? 'Downtime start' : 'Downtime end'} value={settings[key]}
            onChange={e => onChange({ ...settings, [key]: e.target.value })}>
            {!QUARTER_HOURS.includes(settings[key]) && <option value={settings[key]}>{clockLabel(settings[key])}</option>}
            {QUARTER_HOURS.map(time => <option key={time} value={time}>{clockLabel(time)}</option>)}
          </select>
        </label>)}
    </div>
  </div>;
}
