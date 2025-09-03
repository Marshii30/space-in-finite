import React, { useEffect, useState } from "react";
import GameCanvas from "./components/GameCanvas.jsx";
import HUD from "./components/HUD.jsx";

export default function App() {
  const [playing, setPlaying] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("best") || 0));
  const [lastPeak, setLastPeak] = useState(0);
  const [muted, setMuted] = useState(() => localStorage.getItem("muted") === "1");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- new states ---
  const [stage, setStage] = useState("login"); // login → song → game
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [chosenSong, setChosenSong] = useState(null);

  // Desktop: Space/Enter to start (only inside game stage)
  useEffect(() => {
    const onKey = (e) => {
      if (stage === "game" && !playing && (e.code === "Space" || e.code === "Enter")) {
        setPlaying(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, stage]);

  // Mobile: first tap anywhere starts
  useEffect(() => {
    if (playing) return;
    const startOnTap = (e) => {
      if (stage === "game" && !playing && !settingsOpen) {
        e.preventDefault();
        setPlaying(true);
      }
    };
    window.addEventListener("pointerdown", startOnTap, { passive: false });
    return () => window.removeEventListener("pointerdown", startOnTap);
  }, [playing, settingsOpen, stage]);

  const handleProgress = (peak) => {
    setLastPeak(peak);
    if (peak > best) {
      setBest(peak);
      localStorage.setItem("best", String(peak));
    }
  };

  // handle login
  const handleLogin = () => {
    if (!name || !age) return;
    setStage("song");
  };

  // handle song select
  const handleSongSelect = (song) => {
    setChosenSong(song);     // save selected song (can be null)
    setStage("game");        // 🚀 don’t setPlaying yet (wait for modal Play)
    alert("🎵 REACH 3000M BEFORE THE SONG ENDS!");
  };

  return (
    <>
      <HUD
        open={settingsOpen}
        setOpen={setSettingsOpen}
        muted={muted}
        setMuted={(m) => {
          setMuted(m);
          localStorage.setItem("muted", m ? "1" : "0");
        }}
        onHome={() => {
          setSettingsOpen(false);
          setPlaying(false);
          setStage("login");
        }}
      />

      {/* LOGIN SCREEN */}
      {stage === "login" && (
        <div className="login-screen">
          <div className="login-box">
            <h2>🚀 Enter Space Challenge</h2>
            <input
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="number"
              placeholder="Your Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <button onClick={handleLogin}>Continue</button>
          </div>
        </div>
      )}

      {/* SONG SELECTION */}
      {stage === "song" && (
        <div className="song-select">
          <h2>🎶 Choose a song</h2>
          <div className="song-list">
            {Array.from({ length: 12 }).map((_, i) => (
              <button key={i} onClick={() => handleSongSelect(`Song${i+1}`)}>
                Song {i + 1}
              </button>
            ))}
            {/* ✅ Option to skip songs and just play */}
            <button
              style={{ gridColumn: "span 3", marginTop: "12px" }}
              onClick={() => handleSongSelect(null)}
            >
              🚀 Play Without Music
            </button>
          </div>
        </div>
      )}

      {/* GAME STAGE */}
      {stage === "game" && (
        <>
          {!playing && (
            <div className="modal-wrap">
              <div className="modal" style={{ textAlign: "center" }}>
                <h1 style={{ marginTop: 0 }}>🚀 Space in-Finite</h1>
                <p style={{ opacity: 0.85, margin: "6px 0 2px" }}>
                  Highest: <strong>{best} m</strong>
                </p>
                {lastPeak > 0 && (
                  <p className="tiny" style={{ margin: "0 0 10px" }}>
                    Last run peak: {lastPeak} m
                  </p>
                )}
                <p className="tiny" style={{ marginBottom: 14 }}>
                  Hold & release <kbd>Space</kbd> or drag anywhere then release to jump. ← / → to steer.
                </p>
                <button
                  className="btn"
                  style={{ fontSize: "1.3rem", padding: "12px 24px" }}
                  onClick={() => setPlaying(true)}
                >
                  ▶️ Play
                </button>
              </div>
            </div>
          )}
          <GameCanvas
            running={playing}
            muted={muted}
            onProgress={handleProgress}
            selectedSong={chosenSong}   // ✅ pass song into GameCanvas
            playerName={name}           // ✅ pass player name for leaderboard
          />
        </>
      )}
    </>
  );
}
