import React, { useEffect } from "react";

/**
 * Mobile-only control overlay.
 * It dispatches real keyboard events so your existing GameCanvas handlers work unchanged.
 */
export default function MobileControls() {
  // Only show on touch devices
  const isTouch = typeof window !== "undefined" &&
                  matchMedia("(hover: none) and (pointer: coarse)").matches;

  useEffect(() => {
    // prevent iOS bounce/gesture while touching the controls
    const stop = (e) => e.preventDefault();
    window.addEventListener("gesturestart", stop, { passive: false });
    return () => window.removeEventListener("gesturestart", stop);
  }, []);

  if (!isTouch) return null;

  const fire = (type, code) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));

  const press = (code) => (e) => { e.preventDefault(); fire("keydown", code); };
  const release = (code) => (e) => { e.preventDefault(); fire("keyup", code); };

  return (
    <div className="mobile-ctrls" aria-label="Mobile controls">
      <button
        className="ctrl btn-left"
        onTouchStart={press("ArrowLeft")}
        onTouchEnd={release("ArrowLeft")}
        onPointerDown={press("ArrowLeft")}
        onPointerUp={release("ArrowLeft")}
      >
        ◀
      </button>

      <button
        className="ctrl btn-jump"
        onTouchStart={press("Space")}
        onTouchEnd={release("Space")}
        onPointerDown={press("Space")}
        onPointerUp={release("Space")}
      >
        JUMP
      </button>

      <button
        className="ctrl btn-right"
        onTouchStart={press("ArrowRight")}
        onTouchEnd={release("ArrowRight")}
        onPointerDown={press("ArrowRight")}
        onPointerUp={release("ArrowRight")}
      >
        ▶
      </button>
    </div>
  );
}
