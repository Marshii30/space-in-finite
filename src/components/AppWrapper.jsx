import React, { useState } from "react";
import GameCanvas from "./GameCanvas";
import LoginScreen from "./LoginScreen";
import SongSelect from "./SongSelect";

export default function AppWrapper() {
  const [stage, setStage] = useState("login"); // "login" → "songs" → "game"
  const [user, setUser] = useState({ name: "", age: "" });
  const [song, setSong] = useState(null);

  const handleLogin = (name, age) => {
    setUser({ name, age });
    setStage("songs");
  };

  const handleSongSelect = (songFile) => {
    setSong(songFile);
    setStage("game");
    setTimeout(() => {
      alert("🎵 Reach 3000m before the song ends!");
    }, 800);
  };

  return (
    <div className="app-wrapper">
      {stage === "login" && <LoginScreen onLogin={handleLogin} />}
      {stage === "songs" && <SongSelect onSelect={handleSongSelect} />}
      {stage === "game" && (
        <GameCanvas
          running={true}
          onProgress={(m) => {}}
          selectedSong={song}
        />
      )}
    </div>
  );
}
