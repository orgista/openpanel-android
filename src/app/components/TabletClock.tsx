import type { ClockStyle } from "../native/tabletAppearance";

export function TabletClock({ time, style }: { time: Date; style: ClockStyle }) {
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const parts = formatter.formatToParts(time);
  const clock = formatter.format(time);
  const period = parts.find(part => part.type === "dayPeriod")?.value;
  const digits = parts.filter(part => part.type !== "dayPeriod").map(part => part.value).join("").trim();
  return <div className="tablet-clock" data-clock-style={style}>
    {style !== "digital" && <div className="tablet-clock-date">{time.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>}
    {style === "analog" ? <svg className="tablet-clock-analog" viewBox="0 0 100 100" role="img" aria-label={clock}>
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth=".6" />
      {Array.from({ length: 12 }, (_, index) => <line key={index} x1="50" y1="7" x2="50" y2="11"
        stroke="currentColor" strokeWidth="1.5" transform={`rotate(${index * 30} 50 50)`} />)}
      <line x1="50" y1="50" x2="50" y2="26" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        transform={`rotate(${(time.getHours() % 12) * 30 + time.getMinutes() / 2} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        transform={`rotate(${time.getMinutes() * 6} 50 50)`} />
      <circle cx="50" cy="50" r="2.5" fill="currentColor" />
    </svg> : <div className="tablet-clock-digital" aria-label={clock}>
      <span>{digits}</span>{period && <small>{period}</small>}
    </div>}
  </div>;
}
