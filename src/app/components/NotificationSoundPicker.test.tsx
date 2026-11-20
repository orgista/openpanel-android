import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { NotificationSoundGroup } from "./NotificationSoundPicker";
import { AdminPanel } from "./AdminPanel";

const sounds = ["Chime", "Ripple", "Bell", "Tap", "Drop", "Pop"].map((title) => ({ id: title.toLowerCase(), title }));

describe("NotificationSoundGroup", () => {
  it("lists the six tones and marks the applied one", () => {
    const html = renderToStaticMarkup(<NotificationSoundGroup state={{ sounds, selected: "bell", canWrite: true }} onPick={vi.fn()} />);
    expect(html).toContain("Notification Sound");
    expect(html.match(/system-list-row/g)).toHaveLength(6);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).not.toContain("disabled");
  });

  it("disables the rows when the app may not change system settings", () => {
    const html = renderToStaticMarkup(<NotificationSoundGroup state={{ sounds, selected: null, canWrite: false }} onPick={vi.fn()} />);
    expect(html.match(/disabled=""/g)).toHaveLength(6);
    expect(html.match(/Not allowed/g)).toHaveLength(6);
  });

  it("uses the ArborXR wording when managed", () => {
    const html = renderToStaticMarkup(<NotificationSoundGroup state={{ sounds, selected: null, canWrite: false }} managed onPick={vi.fn()} />);
    expect(html.match(/Managed by ArborXR/g)).toHaveLength(6);
    expect(html).not.toContain("Not allowed");
  });

  it("is absent from the TV admin general section", () => {
    const html = renderToStaticMarkup(
      <AdminPanel isOpen onClose={vi.fn()} apps={[]} availableApps={[]} onAddApp={vi.fn()} onRemoveApp={vi.fn()}
        inactivityTimeout={5} onSetInactivityTimeout={vi.fn()} allowSameChannelRecommendations
        onSetAllowSameChannelRecommendations={vi.fn()} videos={[]} onAddVideo={vi.fn(() => true)} onRemoveVideo={vi.fn()}
        standalone={false} appMode="companion" onSetAppMode={vi.fn()} kioskStatus={null} onRefreshKiosk={vi.fn()}
        onSetDefaultLauncher={vi.fn()} onRequestDeviceAdmin={vi.fn()} onLockKiosk={vi.fn()} onUnlockKiosk={vi.fn()}
        onClearDeviceOwner={vi.fn()} onResetAdmin={vi.fn()} initialTab="general"
        deviceProfile={{ remoteUi: true, touchUi: false } as never} />,
    );
    expect(html).toContain("Volume Limit");
    expect(html).not.toContain("Notification Sound");
  });
});
