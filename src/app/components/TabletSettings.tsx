import { useEffect, useState } from "react";
import { ToggleSwitch } from "./ToggleSwitch";
import { tabletColors, tabletIcons, wallpapers, pictureWallpapers, resolveWallpaper, type TabletPreferences, type TabletPhoto, type ClockStyle } from "../native/tabletAppearance";
import { TabletAvatar } from "./TabletIdentity";
import { TabletWallpaper } from "./TabletWallpaper";
import { useMinuteClock } from "../native/useMinuteClock";
import { TabletClock } from "./TabletClock";
import { RemoveButton } from "./RemoveButton";

interface PreferencesProps {
  preferences: TabletPreferences;
  onChange: (preferences: TabletPreferences) => void;
  photos: TabletPhoto[];
}

export function AppearancePanel({ preferences, onChange, photos }: PreferencesProps) {
  const time = useMinuteClock();
  const builtIn = [...pictureWallpapers, ...wallpapers];
  const choices = [...builtIn, ...photos.map(photo => resolveWallpaper(photo.id, photos))];
  const selectedWallpaper = resolveWallpaper(preferences.wallpaperId, photos);
  return <div className="touch-settings-scroll tablet-settings">
    <h3>Wallpaper</h3>
    <div className="wallpaper-choices" role="group" aria-label="Wallpaper">
      {choices.map((item, index) => <button key={item.id} className="wallpaper-choice" aria-label={index < builtIn.length ? item.label : `Photo ${index - builtIn.length + 1}`}
        aria-pressed={selectedWallpaper.id === item.id} onClick={() => onChange({ ...preferences, wallpaperId: item.id })}>
        <TabletWallpaper wallpaper={item} thumb />
        {/* Android accessibility drops the aria-label of an empty toggle button; real text keeps the name. */}
        <span className="sr-only">{index < builtIn.length ? item.label : `Photo ${index - builtIn.length + 1}`}</span>
      </button>)}
    </div>
    <h3>Lock screen</h3>
    <div className="system-list">
      <div className="system-list-row settings-value-row">Show lock screen
        <ToggleSwitch checked={preferences.lockScreenEnabled} ariaLabel="Show lock screen"
          onChange={lockScreenEnabled => onChange({ ...preferences, lockScreenEnabled })} />
      </div>
    </div>
    {preferences.lockScreenEnabled && <>
    <div className="clock-choices" role="group" aria-label="Clock style">
      {([['digital', 'Large digital'], ['date', 'Digital with date'], ['analog', 'Analog']] as [ClockStyle, string][]).map(([style, label]) =>
        <button key={style} className="clock-choice" aria-label={label} aria-pressed={preferences.clockStyle === style}
          onClick={() => onChange({ ...preferences, clockStyle: style })}>
          <span className="clock-preview">
            {preferences.lockBackground === "wallpaper" && <TabletWallpaper wallpaper={selectedWallpaper} thumb />}
            <TabletClock time={time} style={style} />
            {preferences.tabletName && <span className="clock-preview-identity"><TabletAvatar {...preferences} size={14} />{preferences.tabletName}</span>}
            <span className="clock-preview-bar" />
          </span><span>{label}</span>
        </button>)}
    </div>
    <h3>Background</h3>
    <div className="lock-background-choices" role="group" aria-label="Lock screen background">
      {([['wallpaper', 'Same as wallpaper'], ['black', 'Dimmed black']] as const).map(([value, label]) =>
        <button key={value} aria-pressed={preferences.lockBackground === value} onClick={() => onChange({ ...preferences, lockBackground: value })}>
          <span className="lock-background-preview">{value === 'wallpaper' && <TabletWallpaper wallpaper={selectedWallpaper} thumb />}</span>{label}
        </button>)}
    </div>
    </>}
  </div>;
}

export function ThisTabletPanel({ managed, preferences, onChange, photos, photoStatus, photoBusy, photosReady, onAddPhoto, onRemovePhoto }: PreferencesProps & {
  managed?: Partial<TabletPreferences>;
  photoStatus: string; photoBusy: boolean; photosReady: boolean;
  onAddPhoto: () => void; onRemovePhoto: (id: string) => void;
}) {
  const [name, setName] = useState(preferences.tabletName);
  useEffect(() => setName(preferences.tabletName), [managed?.tabletName]);
  return <div className="touch-settings-scroll tablet-settings">
    <label className="system-list-row settings-value-row">Name{managed?.tabletName !== undefined && <span>Managed</span>}
      <input disabled={managed?.tabletName !== undefined} aria-label="Tablet name" type="text" maxLength={24} placeholder="Name" value={name}
        onChange={event => { setName(event.target.value); onChange({ ...preferences, tabletName: event.target.value.trim().slice(0, 24) }); }}
        onBlur={() => setName(preferences.tabletName)} />
    </label>
    <h3>Icon{managed?.tabletIcon !== undefined && " · Managed"}</h3>
    <div className="avatar-choices" role="group" aria-label="Tablet icon">
      {tabletIcons.map(icon => <button disabled={managed?.tabletIcon !== undefined} key={icon} aria-label={icon} aria-pressed={preferences.tabletIcon === icon}
        onClick={() => onChange({ ...preferences, tabletIcon: icon })}>
        <TabletAvatar tabletIcon={icon} tabletColor={preferences.tabletColor} size={44} />
      </button>)}
    </div>
    <h3>Colour{managed?.tabletColor !== undefined && " · Managed"}</h3>
    <div className="avatar-choices" role="group" aria-label="Tablet colour">
      {tabletColors.map((color, index) => <button disabled={managed?.tabletColor !== undefined} key={color} aria-label={['Blue', 'Green', 'Purple', 'Rose', 'Clay', 'Olive', 'Slate', 'Grey'][index]}
        aria-pressed={preferences.tabletColor === color} onClick={() => onChange({ ...preferences, tabletColor: color })}>
        <span className="tablet-avatar" style={{ width: 44, height: 44, background: color }} />
      </button>)}
    </div>
    <h3>Photos</h3>
    <div className="system-list">
      <div className="system-list-row settings-value-row"><button className="tablet-add-photo" disabled={photoBusy || !photosReady || photos.length >= 12} onClick={onAddPhoto}>Add Photo</button>
        <span>{photos.length}/12</span></div>
      {photoStatus && <div className="system-list-row settings-row-status" role="status">{photoStatus}</div>}
      {photos.map((photo, index) => <div key={photo.id} className="system-list-row tablet-photo-row">
        <img src={photo.url} alt="" /><span>Photo {index + 1}</span>
        <RemoveButton itemTitle={`Photo ${index + 1}`} onRemove={() => onRemovePhoto(photo.id)} disabled={photoBusy} className="settings-destructive tablet-remove-photo" />
      </div>)}
    </div>
  </div>;
}
