import type { CSSProperties } from "react";
import { defaultWeatherUnit, normalizeWeatherPlace, type WeatherPlace, type WeatherUnit } from "./weather";

export const tabletIcons = ["cat", "dog", "rabbit", "bird", "fish", "rocket", "star", "sun", "moon", "flower", "tree", "car", "bike", "music", "gamepad", "palette"] as const;
export const tabletColors = ["#597a96", "#60877d", "#8a7396", "#ac7884", "#a17c59", "#8c8855", "#62718e", "#76777d"] as const;
export type ClockStyle = "digital" | "date" | "analog";
export interface TabletPreferences {
  tabletName: string;
  tabletIcon: typeof tabletIcons[number];
  tabletColor: typeof tabletColors[number];
  wallpaperId: string;
  clockStyle: ClockStyle;
  lockScreenEnabled: boolean;
  lockBackground: "wallpaper" | "black";
  weatherEnabled: boolean;
  weatherPlace: WeatherPlace | null;
  weatherUnit: WeatherUnit;
}
export const defaultTabletPreferences: TabletPreferences = {
  tabletName: "", tabletIcon: "rocket", tabletColor: tabletColors[0],
  wallpaperId: "mist", clockStyle: "date", lockScreenEnabled: true, lockBackground: "wallpaper",
  weatherEnabled: false, weatherPlace: null, weatherUnit: defaultWeatherUnit(),
};

export function normalizeTabletPreferences(value: Partial<TabletPreferences> | null | undefined): TabletPreferences {
  const icon = value?.tabletIcon ?? defaultTabletPreferences.tabletIcon;
  const color = value?.tabletColor ?? defaultTabletPreferences.tabletColor;
  const weatherPlace = normalizeWeatherPlace(value?.weatherPlace);
  return {
    tabletName: typeof value?.tabletName === "string" ? value.tabletName.trim().slice(0, 24).trimEnd() : "",
    tabletIcon: tabletIcons.includes(icon) ? icon : defaultTabletPreferences.tabletIcon,
    tabletColor: tabletColors.includes(color) ? color : defaultTabletPreferences.tabletColor,
    wallpaperId: typeof value?.wallpaperId === "string" ? value.wallpaperId : defaultTabletPreferences.wallpaperId,
    clockStyle: value?.clockStyle === "digital" || value?.clockStyle === "analog" ? value.clockStyle : "date",
    lockScreenEnabled: value?.lockScreenEnabled !== false,
    lockBackground: value?.lockBackground === "black" ? "black" : "wallpaper",
    weatherEnabled: value?.weatherEnabled === true && !!weatherPlace,
    weatherPlace,
    weatherUnit: value?.weatherUnit === "fahrenheit" || value?.weatherUnit === "celsius" ? value.weatherUnit : defaultTabletPreferences.weatherUnit,
  };
}

export interface TabletPhoto { id: string; url: string }
export interface Wallpaper {
  id: string;
  label: string;
  style: CSSProperties;
  photoUrl?: string;
  thumbUrl?: string;
}

function wallpaper(id: string, label: string, base: string, fields = "none", blur = "0px"): Wallpaper {
  return { id, label, style: { "--wallpaper-base": base, "--wallpaper-fields": fields, "--wallpaper-blur": blur } as CSSProperties };
}

const mist = wallpaper("mist", "Mist", "#0b0d12", "radial-gradient(ellipse at 15% 22%, #304052, transparent 60%), radial-gradient(ellipse at 85% 45%, #23413f, transparent 60%), radial-gradient(ellipse at 45% 95%, #49443e, transparent 60%)", "5.66cqw");

export const wallpapers: Wallpaper[] = [
  wallpaper("slate", "Slate", "#26313e"),
  wallpaper("sage", "Sage", "#30403a"),
  wallpaper("clay", "Clay", "#49403b"),
  wallpaper("dusk", "Dusk", "#393447"),
  wallpaper("rose", "Rose", "#48383e"),
  wallpaper("ocean", "Ocean", "#233a43"),
  mist,
  wallpaper("tide", "Tide", "#14252c", "radial-gradient(ellipse at 15% 80%, #45616c, transparent 65%), radial-gradient(ellipse at 90% 15%, #325953, transparent 60%)", "4.45cqw"),
  wallpaper("bloom", "Bloom", "#292333", "radial-gradient(ellipse at 20% 25%, #68536f, transparent 60%), radial-gradient(ellipse at 80% 80%, #654b53, transparent 65%)", "5.25cqw"),
  wallpaper("sand", "Sand", "#302b27", "radial-gradient(ellipse at 70% 20%, #766a53, transparent 65%), radial-gradient(ellipse at 10% 90%, #4d6057, transparent 60%)", "4.85cqw"),
  wallpaper("arcs", "Arcs", "#1e3038", "radial-gradient(circle at 0 100%, transparent 38%, #3d555e 39%, #3d555e 52%, transparent 53%), radial-gradient(circle at 100% 0, #3a4b4a 30%, transparent 31%)"),
  wallpaper("folds", "Folds", "#2d303e", "linear-gradient(145deg, transparent 40%, #434859 40%, #434859 60%, transparent 60%), linear-gradient(35deg, #3d4750 30%, transparent 30%)"),
];

const pictureUrls = import.meta.glob<string>("../../assets/wallpapers/*.jpg", { eager: true, query: "?url", import: "default" });
function picture(id: string, label: string): Wallpaper {
  return { ...wallpaper(id, label, "#0b0d12"), photoUrl: pictureUrls[`../../assets/wallpapers/${id}.jpg`],
    thumbUrl: pictureUrls[`../../assets/wallpapers/${id}.thumb.jpg`] };
}
export const pictureWallpapers: Wallpaper[] = [
  picture("voxel", "Block Hills"), picture("space", "Space"), picture("dinos", "Dinosaur Valley"), picture("reef", "Reef"),
  picture("racing", "Race Track"), picture("forest", "Glow Forest"), picture("aurora", "Aurora"), picture("candy", "Candy Land"),
  picture("robots", "Night City"), picture("jungle", "Waterfall"), picture("castle", "Sky Castle"),  picture("seatown", "Sea Town"), picture("backyard", "Backyard"), picture("rescuetown", "Harbor Town"), picture("meadow", "Meadow Path"),
  picture("herocity", "Hero City"), picture("icekingdom", "Ice Kingdom"), picture("platformer", "Sky Islands"), picture("brickcity", "Brick City"),
  picture("blockworld", "Block World"), picture("nightcity", "Gothic City"), picture("comicheroes", "Comic Heroes"), picture("neonstage", "Neon Stage"),
  picture("toyroom", "Toy Room"), picture("doodlecity", "Doodle City"), picture("dragonisle", "Dragon Isle"), picture("webcity", "Web City"),
];

export function resolveWallpaper(id: string, photos: TabletPhoto[]): Wallpaper {
  const builtIn = wallpapers.find(item => item.id === id) ?? pictureWallpapers.find(item => item.id === id);
  if (builtIn) return builtIn;
  const photo = photos.find(item => item.id === id);
  return photo ? { ...wallpaper(photo.id, "Photo", "#0b0d12"), photoUrl: photo.url } : mist;
}
