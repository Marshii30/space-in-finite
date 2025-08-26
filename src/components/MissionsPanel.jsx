import React from "react";
import { MISSION_LIST } from "../lib/missions";

export default function MissionsPanel({ state }) {
  const pr = state.progress;
  return (
    <div className="card" style={{ textAlign:"left", marginTop:12 }}>
      <div style={{ fontWeight: 700, marginBottom:8 }}>Daily Missions</div>
      <div style={{ display:"grid", gap:8 }}>
        {MISSION_LIST.map(m => {
          const e = pr[m.id] || { value:0, done:false };
          const t = m.target; const val = Math.min(e.value, t);
          const pct = Math.round((val / t) * 100);
          return (
            <div key={m.id}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:14 }}>
                <span>{m.label}</span><span>{val} / {t}</span>
              </div>
              <div style={{ height:8, background:"rgba(255,255,255,.08)", borderRadius:6, overflow:"hidden" }}>
                <div style={{ width:`${pct}%`, height:"100%", background: e.done ? "linear-gradient(90deg,#54ffa9,#1de9b6)" : "var(--accent)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
