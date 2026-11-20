import type { Wallpaper } from "../native/tabletAppearance";

export function TabletWallpaper({ wallpaper, home = false, thumb = false }: { wallpaper: Wallpaper; home?: boolean; thumb?: boolean }) {
  const photoUrl = thumb ? wallpaper.thumbUrl ?? wallpaper.photoUrl : wallpaper.photoUrl;
  return <span className={`tablet-wallpaper${home ? " tablet-wallpaper-home" : ""}`} style={wallpaper.style} aria-hidden="true">
    {photoUrl ? <span className="tablet-wallpaper-photo" style={{ backgroundImage: `url(${JSON.stringify(photoUrl)})` }} />
      : <span className="tablet-wallpaper-fields" />}
    {home && photoUrl && <span className="tablet-wallpaper-shade" />}
  </span>;
}
