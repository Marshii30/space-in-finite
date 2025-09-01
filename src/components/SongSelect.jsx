import React from "react";

export default function SongSelect({ songs, onSelect }) {
  return (
    <div className="modal-wrap">
      <div className="modal">
        <h1 style={{ marginTop: 0 }}>🎶 Choose Your Song</h1>
        <p className="tiny" style={{ marginBottom: 14 }}>
          Pick one track — reach <strong>3000m</strong> before it ends!
        </p>
        <div className="song-list">
          {songs.map((song, idx) => (
            <button
              key={idx}
              className="btn song-btn"
              onClick={() => onSelect(song)}
            >
              {song.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
