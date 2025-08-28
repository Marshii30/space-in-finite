import React from "react";

/**
 * Heads-Up Display
 * - Center-top "Height: 0 m" chip (updated by GameCanvas).
 * - Settings button (top-right) -> modal with Mute + Home.
 */
export default function HUD({ open, setOpen, muted, setMuted, onHome }) {
  return (
    <>
      {/* Center-top score */}
      <div
        id="hud-score"
        style={{
          position: "fixed",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          background: "rgba(10,14,22,.55)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 14,
          padding: "8px 12px",
          fontWeight: 700,
        }}
      >
        Height: <strong>0 m</strong>
      </div>

      {/* Settings button */}
      <div style={{ position: "fixed", top: 10, right: 10, zIndex: 30 }}>
        <button className="btn" style={{ padding: "8px 12px" }} onClick={() => setOpen(true)}>
          ⚙️ Settings
        </button>
      </div>

      {open && (
        <div className="modal-wrap" style={{ zIndex: 40 }}>
          <div className="modal" style={{ width: "min(420px,92vw)", textAlign: "center" }}>
            <h2 style={{ marginTop: 0 }}>Settings</h2>
            <div style={{ display: "grid", gap: 10, margin: "14px 0 16px" }}>
              <button className="btn" onClick={() => setMuted(!muted)}>
                {muted ? "🔈 Unmute" : "🔇 Mute"}
              </button>
              <button className="btn" onClick={() => { setOpen(false); onHome?.(); }}>
                🏠 Home / Menu
              </button>
              <button className="btn" onClick={() => setOpen(false)}>Close</button>
            </div>
            <p className="tiny" style={{ opacity: .8 }}>
              Tip: You can return to Home anytime without losing your best score.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
