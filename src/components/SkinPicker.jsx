import React from "react";
import { SKINS } from "../lib/skins";

export default function SkinPicker({ missions, selectedId, onSelect }) {
  return (
    <div className="card" style={{ marginTop:12 }}>
      <div style={{ fontWeight:700, marginBottom:8 }}>Cosmetics</div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {SKINS.map(s => {
          const ok = s.unlocked(missions);
          const sel = s.id === selectedId;
          return (
            <button
              key={s.id}
              className="btn"
              disabled={!ok}
              onClick={()=> ok && onSelect(s.id)}
              style={{
                opacity: ok ? 1 : 0.5,
                outline: sel ? "2px solid #84f7ff" : "none",
                display:"flex", alignItems:"center", gap:8
              }}
            >
              <div style={{
                width:22, height:22, borderRadius:6,
                background: s.core, boxShadow: `0 0 12px ${s.glow.replace(".35",".8")}`
              }}/>
              {s.name}
            </button>
          );
        })}
      </div>
      <div className="tiny" style={{ marginTop:8, opacity:.8 }}>
        Unlock Amber by completing 1 mission • Void by completing all 3.
      </div>
    </div>
  );
}
