import { load, save, todayKey } from "./storage";

export const MISSION_LIST = [
  { id: "perfect5",    label: "Hit 5 perfect landings", target: 5 },
  { id: "reach300",    label: "Reach 300 m height",     target: 300, type: "height" },
  { id: "moveStreak4", label: "Land on 4 moving in a row", target: 4, type: "streak" }
];

const KEY = "dailyMissions";
export function initMissions(){
  const day = todayKey(); const saved = load(KEY, null);
  if (!saved || saved.day !== day) {
    const p = {}; for (const m of MISSION_LIST) p[m.id] = { value: 0, done: false };
    const st = { day, progress: p }; save(KEY, st); return st;
  }
  return saved;
}
export const getMissions = () => load(KEY, initMissions());
export const setMissions = (st) => save(KEY, st);

export function applyRunToMissions(run){
  const st = getMissions();
  for (const m of MISSION_LIST) {
    const e = st.progress[m.id];
    if (!e) continue;
    if (m.type === "height") {
      if (run.height >= m.target) { e.value = m.target; e.done = true; }
    } else if (m.type === "streak") {
      if (run.maxMovingStreak >= m.target) { e.value = m.target; e.done = true; }
    } else {
      e.value = Math.min(m.target, e.value + (run.perfects || 0));
      if (e.value >= m.target) e.done = true;
    }
  }
  setMissions(st);
  return st;
}
