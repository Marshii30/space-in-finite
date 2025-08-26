import React, { useEffect, useState } from "react";
import GameCanvas from "../components/GameCanvas.jsx";
import HUD from "../components/HUD.jsx";

export default function App() {
  const [playing, setPlaying] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("best") || 0));
  const [lastPeak, setLastPeak] = useState(0);
  const [muted, setMuted] = useState(() => localStorage.getItem("muted") === "1");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (!playing && (e.code === "Space" || e.code === "Enter")) setPlaying(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  const handleProgress = (peak) => {
    setLastPeak(peak);
    if (peak > best) {
      setBest(peak);
      localStorage.setItem("best", String(peak));
    }
  };

  return (
    <>
      <HUD
        open={settingsOpen}
        setOpen={setSettingsOpen}
        muted={muted}
        setMuted={(m) => { setMuted(m); localStorage.setItem("muted", m ? "1" : "0"); }}
        onHome={() => { setSettingsOpen(false); setPlaying(false); }}
      />

      {!playing && (
        <div className="modal-wrap">
          <div className="modal">
            <h1 style={{marginTop:0}}>🚀 Space in-Finite</h1>
            <p style={{opacity:.85, margin:"6px 0 2px"}}>Highest: <strong>{best} m</strong></p>
            {lastPeak > 0 && <p className="tiny" style={{margin:"0 0 10px"}}>Last run peak: {lastPeak} m</p>}
            <p className="tiny" style={{marginBottom:14}}>
              Hold & release <kbd>Space</kbd> or drag anywhere then release to jump. ← / → to steer.
            </p>
            <button className="btn" onClick={() => setPlaying(true)}>Play</button>
          </div>
        </div>
      )}

      <GameCanvas running={playing} muted={muted} onProgress={handleProgress} />
    </>
  );
}
