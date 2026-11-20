export function forecastBody() {
  const hours = Array.from({ length: 48 }, (_, index) => `2026-11-${String(11 + Math.floor(index / 24))}T${String(index % 24).padStart(2, "0")}:00`);
  return {
    utc_offset_seconds: -18000,
    current: { time: "2026-11-11T14:00", temperature_2m: 54.4, apparent_temperature: 50, weather_code: 3, is_day: 1, wind_speed_10m: 4 },
    hourly: { time: hours, temperature_2m: hours.map((_, index) => 40 + index % 24), weather_code: hours.map(() => 61),
      is_day: hours.map((_, index) => index % 24 >= 7 && index % 24 < 17 ? 1 : 0), precipitation_probability: hours.map(() => null) },
    daily: { time: ["2026-11-11", "2026-11-12"], weather_code: [3, 71], temperature_2m_max: [61, 45], temperature_2m_min: [48, 30],
      sunrise: ["2026-11-11T06:45", "2026-11-12T06:46"], sunset: ["2026-11-11T16:40", "2026-11-12T16:39"], precipitation_probability_max: [10, 60] },
  };
}
// 14:00 local at UTC-5.
export const afternoon = Date.UTC(2026, 10, 11, 19, 0);
