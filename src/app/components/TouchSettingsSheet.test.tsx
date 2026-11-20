import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TouchSettingsSheet } from "./TouchSettingsSheet";
import { WifiForgetAction } from "./SettingsModal";
import { TimeLimitsPanel } from "./TimeLimitsPanel";
import { defaultTimeLimits } from "../native/timeLimits";
const props = { enabled: true, isOpen: true, isAdmin: false, section: 'wifi' as const,
  onSection: vi.fn(), onClose: vi.fn(), onUnlock: vi.fn(), onExitAdmin: vi.fn() };
describe('touch settings', () => {
  it('keeps connectivity open and admin sections gated', () => {
    const guest = renderToStaticMarkup(<TouchSettingsSheet {...props}>Detail</TouchSettingsSheet>);
    for (const label of ['Wi-Fi', 'Bluetooth', 'Appearance', 'Weather']) expect(guest).toContain(label);
    expect(guest.indexOf('Appearance')).toBeLessThan(guest.indexOf('Weather'));
    expect(guest.indexOf('Weather')).toBeLessThan(guest.indexOf('>Admin</button>'));
    expect(guest).toContain('>Admin</button>');
    for (const label of ['This Tablet', 'Time Limits', 'Content', 'General', 'Health', 'Exit Admin']) expect(guest).not.toContain(label);
    const admin = renderToStaticMarkup(<TouchSettingsSheet {...props} isAdmin>Detail</TouchSettingsSheet>);
    for (const label of ['This Tablet', 'Appearance', 'Apps', 'Content', 'Time Limits', 'General', 'Health', 'Exit Admin']) expect(admin).toContain(label);
    expect(admin.indexOf('This Tablet')).toBeLessThan(admin.indexOf('>Apps</button>'));
    expect(admin.indexOf('Weather')).toBeLessThan(admin.indexOf('This Tablet'));
  });
  it('leaves remote children unchanged and closes the touch sheet', () => {
    expect(renderToStaticMarkup(<TouchSettingsSheet {...props} enabled={false}><div>Remote</div></TouchSettingsSheet>)).toBe('<div>Remote</div>');
    expect(renderToStaticMarkup(<TouchSettingsSheet {...props} isOpen={false}>Detail</TouchSettingsSheet>)).toBe('');
  });
  it('offers forgetting only for networks native code can remove', () => {
    expect(renderToStaticMarkup(<WifiForgetAction ssid="Managed" canForget={false} onForget={vi.fn()} />)).toBe('');
    const removable = renderToStaticMarkup(<WifiForgetAction ssid="Owned" canForget onForget={vi.fn()} />);
    expect(removable).toContain('Remove Owned'); expect(removable).toContain('Forget');
  });
  it('offers off and all 24 quarter-hour budgets independently', () => {
    const html = renderToStaticMarkup(<TimeLimitsPanel settings={defaultTimeLimits} onChange={vi.fn()} usedMs={120000} />);
    expect(html).toContain('aria-label="Weekdays"'); expect(html).toContain('aria-label="Weekends"');
    expect((html.match(/<option /g) ?? []).length).toBe(50);
    expect(html).toContain('value="360"'); expect(html).toContain('2 min');
    expect(html).not.toContain('type="time"');
    const downtime = renderToStaticMarkup(<TimeLimitsPanel settings={{ ...defaultTimeLimits, downtimeEnabled: true }} onChange={vi.fn()} usedMs={0} />);
    expect(downtime).toContain('Downtime start'); expect(downtime).toContain('Downtime end');
    expect(downtime).not.toContain('type="time"');
    expect((downtime.match(/<option /g) ?? []).length).toBe(50 + 2 * 96);
    const offStep = renderToStaticMarkup(<TimeLimitsPanel settings={{ ...defaultTimeLimits, downtimeEnabled: true, start: "20:10" }} onChange={vi.fn()} usedMs={0} />);
    expect(offStep).toContain('value="20:10"');
  });
});
