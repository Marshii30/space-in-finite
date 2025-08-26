import React, { useState } from "react";
import MissionsPanel from "./MissionsPanel";
import { generateShareCard } from "../lib/shareCard";

export default function GameOverModal({ score, best, onRetry, missions, skinName, bestCombo }) {
  const [sharing, setSharing] = useState(false);

  const onShare = async () => {
    setSharing(true);
    try {
      const url = await generateShareCard({ score, best, combo: bestCombo, skinName });
      const a = document.createElement("a");
      a.href = url; a.download = `space-in-finite-${score}m.png`;
      a.click();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="modal-wrap">
      <div className="modal">
        <h2 style={{marginTop:0}}>Game Over</h2>
        <p style={{margin:"8px 0"}}>Height: <strong>{score} m</strong></p>
        <p style={{margin:"8px 0"}}>Best: <strong>{best} m</strong></p>
        <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:10 }}>
          <button className="btn" onClick={onRetry}>Retry</button>
          <button className="btn" onClick={onShare} disabled={sharing}>{sharing ? "Preparing…" : "Share Card"}</button>
        </div>
        <MissionsPanel state={missions}/>
      </div>
    </div>
  );
}
