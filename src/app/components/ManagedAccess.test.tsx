import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PermissionsManager } from "./PermissionsManager";
import { NetworkPrivacyControls } from "./NetworkPrivacyPanel";
vi.mock("./usePermissionRows", () => ({ usePermissionRows: () => ({
  status: {}, isDeviceOwner: false, act: vi.fn(), rows: [
    { key: "launcher", label: "Home launcher", granted: false, icon: () => null, action: vi.fn() },
    { key: "wifi", label: "Wi-Fi", granted: true, icon: () => null, action: vi.fn() },
  ],
}) }));
describe("managed touch access", () => {
  it("renders permission values without settings actions", () => {
    const html = renderToStaticMarkup(<PermissionsManager touch arborXrManaged />);
    expect(html).toContain("Managed by ArborXR");
    expect(html).toContain("Granted");
    expect(html).not.toContain("<button");
  });
  it("omits VPN and Private DNS actions only for managed touch", () => {
    const props = { busy: false, onVpn: vi.fn(), onPrivateDns: vi.fn() };
    expect(renderToStaticMarkup(<NetworkPrivacyControls {...props} touch arborXrManaged />)).not.toContain("<button");
    expect(renderToStaticMarkup(<NetworkPrivacyControls {...props} touch />)).toContain("VPN settings");
    expect(renderToStaticMarkup(<NetworkPrivacyControls {...props} arborXrManaged />)).toContain("VPN settings");
  });
});
