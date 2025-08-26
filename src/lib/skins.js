import { load, save } from "./storage";

export const SKINS = [
  { id: "nova",  name: "Nova Blue",  core: "#dff2ff", glow: "rgba(120,200,255,.35)", unlocked: () => true },
  { id: "amber", name: "Solar Amber", core: "#ffe9c0", glow: "rgba(255,190,80,.35)", unlocked: (m) =>
      Object.values(m.progress).some(p => p.done) },
  { id: "void",  name: "Void Pink", core: "#ffd6f1", glow: "rgba(255,120,200,.35)", unlocked: (m) =>
      Object.values(m.progress).every(p => p.done) },
];

const KEY = "selectedSkin";
export const getSelectedSkinId = () => load(KEY, "nova");
export const setSelectedSkinId = (id) => save(KEY, id);
export const getSkinById = (id) => SKINS.find(s => s.id === id) || SKINS[0];
