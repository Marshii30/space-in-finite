import React, { useEffect, useState, useRef } from "react";
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

  // audio ref
  const audioRef = useRef(null);

  // List of songs from /public/songs/
  const songs = [
    "/songs/Song1.mp3",
    "/songs/Song2.mp3",
    "/songs/Song3.mp3",
    "/songs/Song4.mp3",
    "/songs/Song5.mp3",
    "/songs/Song6.mp3",
    "/songs/Song7.mp3",
    "/songs/Song8.mp3",
    "/songs/Song9.mp3",
    "/songs/Song10.mp3",
    "/songs/Song11.mp3",
    "/songs/Song12.mp3"
  ];

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
  const handleSongSelect = (index) => {
    if (index === null) {
      // no music
      setChosenSong(null);
    } else {
      setChosenSong(songs[index]); // ✅ use absolute /songs/... path
      if (audioRef.current) {
        audioRef.current.src = songs[index];
        audioRef.current.play();
      }
    }
    setStage("game");
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
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }}
      />

      {/* Hidden audio element */}
      <audio ref={audioRef} hidden loop />

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
            {songs.map((song, i) => (
              <button key={i} onClick={() => handleSongSelect(i)}>
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
            selectedSong={chosenSong}   // ✅ now correct absolute path
            playerName={name}           // ✅ pass player name for leaderboard
          />
        </>
      )}
    </>
  );
}
