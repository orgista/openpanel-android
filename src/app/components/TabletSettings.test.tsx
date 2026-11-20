import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppearancePanel, ThisTabletPanel } from "./TabletSettings";
import { TabletLockScreen } from "./TabletLockScreen";
import { StatusBar } from "./StatusBar";
import { defaultTabletPreferences, resolveWallpaper } from "../native/tabletAppearance";
import { photoStatus } from "../native/useTabletPhotos";

const props = { preferences: defaultTabletPreferences, onChange: vi.fn(), photos: [] };
describe("tablet appearance", () => {
  it("offers twenty-seven pictures and twelve colour wallpapers, three clock styles and both lock backgrounds without admin actions", () => {
    const html = renderToStaticMarkup(<AppearancePanel {...props} />);
    expect((html.match(/class="wallpaper-choice"/g) ?? [])).toHaveLength(39);
    expect(html).toContain('aria-label="Block Hills"'); expect(html).toContain("voxel.thumb");
    for (const label of ["Show lock screen", "Large digital", "Digital with date", "Analog", "Same as wallpaper", "Dimmed black"]) expect(html).toContain(label);
    expect((html.match(/aria-pressed="true"/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain("Add Photo");
    expect(html).not.toContain("Tablet name");
  });
  it("shows only the switch in the lock screen section while the lock screen is off", () => {
    const html = renderToStaticMarkup(<AppearancePanel {...props} preferences={{ ...defaultTabletPreferences, lockScreenEnabled: false }} />);
    expect(html).toContain("Show lock screen");
    for (const label of ["Clock style", "Lock screen background", "Same as wallpaper"]) expect(html).not.toContain(label);
  });

  it("offers all identity choices and two-step photo removal in the admin panel", () => {
    const html = renderToStaticMarkup(<ThisTabletPanel {...props}
      photos={[{ id: "photo:one", url: "file:///photo.jpg" }]} photoStatus="Storage full" photoBusy={false}
      photosReady onAddPhoto={vi.fn()} onRemovePhoto={vi.fn()} />);
    expect(html).toContain('aria-label="Tablet name"');
    expect(html).toContain('maxLength="24"');
    expect(html).toContain('placeholder="Name"');
    expect((html.match(/class="tablet-avatar"/g) ?? [])).toHaveLength(24);
    expect(html).toContain('aria-label="Remove Photo 1"');
    expect(html).not.toContain('Confirm removing');
    expect(html).toContain('role="status">Storage full');
  });

  it("marks managed identity values read-only while leaving appearance and photos local", () => {
    const html = renderToStaticMarkup(<ThisTabletPanel {...props} managed={{ tabletName: "Room", tabletIcon: "cat", tabletColor: "#597a96" }}
      photoStatus="" photoBusy={false} photosReady onAddPhoto={vi.fn()} onRemovePhoto={vi.fn()} />);
    expect(html).toContain("Managed");
    expect(html).toContain('input disabled="" aria-label="Tablet name"');
    expect(html.match(/button disabled=""/g)).toHaveLength(24);
    expect(html).toContain('class="tablet-add-photo"');
  });

  it("shows local photos and falls back in the wallpaper grid after removal", () => {
    const photo = { id: "photo:one", url: "file:///photo.jpg" };
    const preferences = { ...defaultTabletPreferences, wallpaperId: photo.id };
    const withPhoto = renderToStaticMarkup(<AppearancePanel {...props} preferences={preferences} photos={[photo]} />);
    expect(withPhoto).toContain('aria-label="Photo 1" aria-pressed="true"');
    const removed = renderToStaticMarkup(<AppearancePanel {...props} preferences={preferences} />);
    expect(removed).toContain('aria-label="Mist" aria-pressed="true"');
    expect(removed).not.toContain('photo.jpg');
  });

  it("renders identity below each live lock clock and uses the selected background", () => {
    const time = new Date(2026, 0, 2, 15, 30);
    for (const clockStyle of ["digital", "date", "analog"] as const) {
      const preferences = { ...defaultTabletPreferences, tabletName: "My tablet", clockStyle, lockBackground: "wallpaper" as const };
      const html = renderToStaticMarkup(<TabletLockScreen preferences={preferences} time={time}
        wallpaper={resolveWallpaper("slate", [])} onWake={vi.fn()} />);
      expect(html.indexOf("My tablet")).toBeGreaterThan(html.indexOf('data-clock-style'));
      expect(html).toContain(`data-clock-style="${clockStyle}"`);
      expect(html).toContain('width:64px;height:64px');
      expect(html).toContain('--wallpaper-base:#26313e');
      expect(html.includes("Friday, January 2")).toBe(clockStyle !== "digital");
      if (clockStyle === "analog") expect(html).toContain('rotate(105 50 50)');
    }
    for (const clockStyle of ["digital", "date", "analog"] as const) {
      const unnamed = renderToStaticMarkup(<TabletLockScreen preferences={{ ...defaultTabletPreferences, clockStyle }} time={time}
        wallpaper={resolveWallpaper("slate", [])} onWake={vi.fn()} />);
      expect(unnamed).not.toContain('tablet-identity');
      expect(unnamed).not.toContain('Tap anywhere');
      expect(unnamed).toContain('tablet-wake-bar');
      expect(unnamed.includes('Friday, January 2')).toBe(clockStyle !== "digital");
    }
    const black = renderToStaticMarkup(<TabletLockScreen preferences={{ ...defaultTabletPreferences, lockBackground: "black" }} time={time}
      wallpaper={resolveWallpaper("slate", [])} onWake={vi.fn()} />);
    expect(black).not.toContain('class="tablet-wallpaper"');
  });

  it("keeps identity out of the TV status bar and hides it with the touch mark on scroll", () => {
    const status = { onSettingsClick: vi.fn(), isWifiConnected: false, isBluetoothConnected: false, batteryLevel: -1, showBattery: false };
    const remote = renderToStaticMarkup(<StatusBar {...status} />);
    expect(remote).not.toContain('tablet-identity');
    expect(remote).toContain('OpenPanel');
    const touch = renderToStaticMarkup(<StatusBar {...status} tabletPreferences={{ ...defaultTabletPreferences, tabletName: "My tablet" }} isScrolled />);
    expect(touch).toContain('width:28px;height:28px');
    expect(touch).toContain('My tablet');
    expect(touch.indexOf('in-data-[input-mode=touch]:opacity-0')).toBeLessThan(touch.indexOf('tablet-identity'));
  });

  it("uses short statuses without exposing picker errors", () => {
    expect(photoStatus({ code: "PHOTO_CANCELLED" })).toBe("Cancelled");
    expect(photoStatus({ code: "PHOTO_STORAGE_FULL" })).toBe("Storage full");
    expect(photoStatus({ code: "PHOTO_LIMIT" })).toBe("12 photos maximum");
    expect(photoStatus(new Error("secret file path"))).toBe("Could not read photo");
  });
});
