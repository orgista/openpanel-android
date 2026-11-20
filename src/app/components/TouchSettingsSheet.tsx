import type { ReactNode } from "react";
import { Wifi, Bluetooth, Shield, LayoutGrid, Library, Clock, Settings, HeartPulse, LogOut, X, Palette, Tablet, CloudSun } from "lucide-react";
import { AdminAuth } from "./AdminAuth";
export type TouchSettingsSection = 'wifi' | 'bluetooth' | 'appearance' | 'weather' | 'tablet' | 'admin' | 'apps' | 'content' | 'time' | 'general' | 'health';
const sections = [
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi }, { id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'tablet', label: 'This Tablet', icon: Tablet },
  { id: 'apps', label: 'Apps', icon: LayoutGrid }, { id: 'content', label: 'Content', icon: Library },
  { id: 'time', label: 'Time Limits', icon: Clock }, { id: 'general', label: 'General', icon: Settings },
  { id: 'health', label: 'Health', icon: HeartPulse },
] as const;
export function TouchSettingsSheet({ enabled, isOpen, isAdmin, section, onSection, onClose, onUnlock, onExitAdmin, children }: {
  enabled: boolean; isOpen: boolean; isAdmin: boolean; section: TouchSettingsSection;
  onSection: (section: TouchSettingsSection) => void; onClose: () => void; onUnlock: () => void;
  onExitAdmin: () => void; children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  if (!isOpen) return null;
  const title = section === 'admin' ? 'Admin' : sections.find(item => item.id === section)?.label;
  return <div className="touch-settings-backdrop" data-input-mode="touch" data-dpad-scope>
    <section className="touch-settings-sheet" role="dialog" aria-modal="true" aria-label="Settings"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
      <aside className="touch-settings-sidebar">
        <h2>Settings</h2>
        <nav aria-label="Settings sections">
          {sections.filter((_, index) => index < 4 || isAdmin).map(({ id, label, icon: Icon }) =>
            <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => onSection(id)}>
              <span className="settings-glyph"><Icon size={19} /></span>{label}
            </button>)}
          {!isAdmin && <button aria-current={section === 'admin' ? 'page' : undefined} onClick={() => onSection('admin')}>
            <span className="settings-glyph"><Shield size={19} /></span>Admin
          </button>}
        </nav>
        {isAdmin && <button className="settings-exit-admin" onClick={() => { onExitAdmin(); onSection('wifi'); }}><LogOut size={20} />Exit Admin</button>}
      </aside>
      <div className="touch-settings-detail">
        <header><h2>{title}</h2><button aria-label="Close settings" onClick={onClose}><X size={24} /></button></header>
        {section === 'admin' ? <div className="touch-settings-auth"><AdminAuth onAuthenticated={() => { onUnlock(); onSection('apps'); }} onCancel={() => onSection('wifi')} /></div> : children}
      </div>
    </section>
  </div>;
}
