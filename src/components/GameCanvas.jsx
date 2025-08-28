import React, { useEffect, useRef } from "react";

/* ---- fixed logical canvas ---- */
const W = 480, H = 800;

/* ---- physics / inputs (square only) ---- */
const GRAV = 1850;
const JUMP_MIN = 560, JUMP_MAX = 1300;
const CHARGE_MIN = 0.18, CHARGE_MAX = 1.20;   // 0..~1.2 seconds window
const PLAYER = { size: 28, airDrift: 300 };
const BASE_TOP = 740;                          // y of top edge of base
const COYOTE = 0.16;                           // 160ms coyote time
const NEAR_TOL = 1.25;                         // treat as grounded if within ~1px
const AIR_DAMP = 0.995;

export default function GameCanvas({ running, onProgress }) {
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const rafRef = useRef(0);
  const st = useRef(null);

  /* ---------- boot ---------- */
  useEffect(() => {
    const setup = (c) => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      c.width = W * dpr; c.height = H * dpr;
      c.style.width = W + "px"; c.style.height = H + "px";
      const ctx = c.getContext("2d", { alpha: true });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    };
    const bctx = setup(bgRef.current);
    const fctx = setup(fgRef.current);

    st.current = createWorld();
    drawBG(bctx, 0);
    drawWorld(fctx, st.current);

    const onResize = () => { setup(bgRef.current); setup(fgRef.current); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ---------- loop ---------- */
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!running) return;

    const bctx = bgRef.current.getContext("2d");
    const fctx = fgRef.current.getContext("2d");

    st.current = createWorld();         // fresh run
    drawWorld(fctx, st.current);

    const frame = (nowMs) => {
      rafRef.current = requestAnimationFrame(frame);
      const s = st.current; if (!s) return;

      const now = nowMs / 1000;
      const dt  = Math.min(0.033, now - s.last);
      s.last = now; s.time = now;

      updateWorld(s, dt);
      drawBG(bctx, now);
      drawWorld(fctx, s);

      const meters = Math.max(0, Math.round((s.startY - s.peakY) / 10));
      onProgress?.(meters);
      const hud = document.getElementById("hud-score");
      if (hud) hud.innerHTML = `Height: <strong>${meters} m</strong>`;
    };

    st.current.last = performance.now() / 1000;
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, onProgress]);

  /* ---------- inputs (only affect the square) ---------- */
  useEffect(() => {
    const canvas = fgRef.current;
    if (!canvas) return;

    let startX = 0, startY = 0;

    const pointerDown = (e) => {
      const s = st.current; if (!s) return;
      e.preventDefault();
      startX = e.clientX; startY = e.clientY;
      s.input.dragging = true;
      s.input.chargeStart = s.time;
      s.input.dx = 0; s.input.dy = 0;
    };
    const pointerMove = (e) => {
      const s = st.current; if (!s || !s.input.dragging) return;
      e.preventDefault();
      s.input.dx = e.clientX - startX;
      s.input.dy = e.clientY - startY;
    };
    const pointerUp = () => {
      const s = st.current; if (!s || !s.input.dragging) return;
      s.input.dragging = false;

      const rect = canvas.getBoundingClientRect();
      const normLen = Math.hypot(s.input.dx, s.input.dy) / Math.max(rect.width, rect.height);
      const hold    = Math.max(0, s.time - s.input.chargeStart);
      const upBias  = Math.max(0, -s.input.dy) / Math.max(1, rect.height);

      const power = clamp(CHARGE_MIN + normLen*1.0 + upBias*0.7 + hold*0.3, CHARGE_MIN, CHARGE_MAX);
      const dirX  = clamp(s.input.dx / (rect.width * 0.4), -1, 1);

      s.input.wantJump = { power, dirX, at: s.time };     // queue once
    };

    const keyDown = (e) => {
      const s = st.current; if (!s) return;
      if (e.code === "ArrowLeft"  || e.code === "KeyA") { s.input.left = 1; e.preventDefault(); }
      if (e.code === "ArrowRight" || e.code === "KeyD") { s.input.right = 1; e.preventDefault(); }
      if (e.code === "Space") {
        if (!s.input.spaceHeld) { s.input.spaceHeld = true; s.input.spaceStart = s.time; }
        e.preventDefault();
      }
    };
    const keyUp = (e) => {
      const s = st.current; if (!s) return;
      if (e.code === "ArrowLeft"  || e.code === "KeyA") { s.input.left = 0; e.preventDefault(); }
      if (e.code === "ArrowRight" || e.code === "KeyD") { s.input.right = 0; e.preventDefault(); }
      if (e.code === "Space" && s.input.spaceHeld) {
        const held  = Math.max(0.02, s.time - s.input.spaceStart);
        const power = clamp(CHARGE_MIN + held, CHARGE_MIN, CHARGE_MAX);
        s.input.spaceHeld = false;
        s.input.wantJump = { power, dirX: 0, at: s.time }; // queue once
        e.preventDefault();
      }
    };

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown",  pointerDown,  { passive: false });
    canvas.addEventListener("pointermove",  pointerMove,  { passive: false });
    canvas.addEventListener("pointerup",    pointerUp,    { passive: false });
    canvas.addEventListener("pointercancel",pointerUp,    { passive: false });
    window.addEventListener("keydown",      keyDown,      { passive: false });
    window.addEventListener("keyup",        keyUp,        { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown",  pointerDown);
      canvas.removeEventListener("pointermove",  pointerMove);
      canvas.removeEventListener("pointerup",    pointerUp);
      canvas.removeEventListener("pointercancel",pointerUp);
      window.removeEventListener("keydown",      keyDown);
      window.removeEventListener("keyup",        keyUp);
    };
  }, []);

  return (
    <div className="game-wrap" style={{ touchAction: "none" }}>
      <div className="stage">
        <canvas ref={bgRef} width={W} height={H} style={{ pointerEvents: "none" }} />
        <canvas ref={fgRef} width={W} height={H} />
      </div>
    </div>
  );
}

/* ================== world / physics ================== */

function createWorld() {
  const s = {
    time: 0, last: 0,
    player: { x: W * 0.5 - PLAYER.size/2, y: 0, vx: 0, vy: 0, size: PLAYER.size, onGround: true },
    lastGroundedAt: 0,
    peakY: Infinity,
    input: {
      left: 0, right: 0,
      spaceHeld: false, spaceStart: 0,
      dragging: false, chargeStart: 0, dx: 0, dy: 0,
      wantJump: undefined, // { power, dirX, at }
    },
    platforms: [],
    startY: 0,
  };

  // Base (full width)
  s.platforms.push({ x: 0, y: BASE_TOP, w: W, h: 24, type: "base" });

  // Player sits on base
  s.player.y = BASE_TOP - s.player.size;
  s.player.vx = 0; s.player.vy = 0; s.player.onGround = true;

  // **Static** platforms (no movement; no reseeding)
  // y values from bottom to top; tweak as you like
  const staticYs = [BASE_TOP - 120, BASE_TOP - 260, BASE_TOP - 410, BASE_TOP - 560, BASE_TOP - 710];
  staticYs.forEach((y, i) => {
    const w = i < 2 ? 130 : 100;
    const x = i % 2 === 0 ? 70 : W - w - 70;
    s.platforms.push({ x, y, w, h: 14, type: "plat" }); // no "move" key at all
  });

  s.startY = s.player.y;
  s.peakY  = s.player.y;
  return s;
}

function attemptJump(s, powerNorm, dirX = 0) {
  const nearBase = (s.player.y + s.player.size) >= (BASE_TOP - NEAR_TOL);
  const canJump = s.player.onGround || nearBase || (s.time - s.lastGroundedAt <= COYOTE);
  if (!canJump) return false;

  if (nearBase) s.player.y = BASE_TOP - s.player.size - 0.5; // tiny nudge up

  const p = clamp((powerNorm - CHARGE_MIN) / (CHARGE_MAX - CHARGE_MIN), 0, 1);
  s.player.vy = -lerp(JUMP_MIN, JUMP_MAX, p);
  s.player.vx = clamp(dirX, -1, 1) * 380;
  s.player.onGround = false;

  s.input.wantJump = undefined; // consume
  return true;
}

function updateWorld(s, dt) {
  // 1) consume a queued jump ASAP; if not possible, keep it for up to 0.7s
  if (s.input.wantJump) {
    const ok = attemptJump(s, s.input.wantJump.power, s.input.wantJump.dirX);
    if (!ok && (s.time - s.input.wantJump.at) > 0.7) s.input.wantJump = undefined;
  }

  // 2) steering (square only)
  const drift = (s.input.right - s.input.left);
  const targetVx = drift * PLAYER.airDrift;
  if (!s.player.onGround) {
    s.player.vx += (targetVx - s.player.vx) * 0.12;
    s.player.vx *= AIR_DAMP;
  } else {
    s.player.vx += (targetVx - s.player.vx) * 0.18;
  }

  // 3) integrate
  const prevY = s.player.y;
  s.player.vy += GRAV * dt;
  s.player.x  += s.player.vx * dt;
  s.player.y  += s.player.vy * dt;
  s.player.x   = Math.max(0, Math.min(W - s.player.size, s.player.x));

  // 4) collisions (falling only)
  if (s.player.vy >= 0) {
    const px = s.player.x, ps = s.player.size;
    const prevBottom = prevY + ps;
    const currBottom = s.player.y + ps;

    for (const pl of s.platforms) {
      const top = pl.y;
      const horz = (px + ps > pl.x) && (px < pl.x + pl.w);
      const crossed = prevBottom <= top && currBottom >= top;
      if (horz && crossed) {
        s.player.y = top - ps;
        s.player.vy = 0;
        s.player.onGround = true;
        s.lastGroundedAt = s.time;
        break;
      }
    }
  } else {
    if (s.player.onGround) s.lastGroundedAt = s.time;
    s.player.onGround = false;
  }

  // 5) clamp to base (miss fall-back)
  const ps = s.player.size;
  if (s.player.y + ps > BASE_TOP) {
    s.player.y = BASE_TOP - ps;
    s.player.vy = 0;
    s.player.onGround = true;
    s.lastGroundedAt = s.time;
  }

  // 6) track peak for “Height:”
  s.peakY = Math.min(s.peakY, s.player.y);
}

/* ================== draw ================== */

function drawBG(ctx, t) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const Wv = ctx.canvas.width / dpr, Hv = ctx.canvas.height / dpr;
  ctx.clearRect(0, 0, Wv, Hv);

  // Deep space gradient
  const g1 = ctx.createLinearGradient(0, 0, 0, Hv);
  g1.addColorStop(0, "#0b1222");
  g1.addColorStop(1, "#071422");
  ctx.fillStyle = g1; ctx.fillRect(0, 0, Wv, Hv);

  // Nebula glow
  const neb = ctx.createRadialGradient(Wv * 0.5, Hv * 0.85, 60, Wv * 0.5, Hv * 1.1, 600);
  neb.addColorStop(0, "rgba(35,120,255,0.10)");
  neb.addColorStop(1, "transparent");
  ctx.fillStyle = neb; ctx.fillRect(0, 0, Wv, Hv);

  // Stars
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 140; i++) {
    const x = (i * 73 + Math.sin(t * 0.6 + i) * 999) % Wv;
    const y = (i * 89 + Math.cos(t * 0.5 + i) * 777) % Hv;
    const r = i % 17 === 0 ? 2 : 1;
    ctx.fillRect(x, y, r, r);
  }
}

function drawWorld(ctx, s) {
  ctx.clearRect(0, 0, W, H);

  // Platforms (base + statics)
  for (const p of s.platforms) {
    const color = p.type === "base" ? "rgba(180,210,255,1.0)" : "rgba(160,190,255,0.9)";
    ctx.fillStyle = color;
    rr(ctx, p.x, p.y, p.w, p.h, 8); ctx.fill();
    if (p.type !== "base") {
      ctx.fillStyle = "rgba(80,140,255,0.25)";
      rr(ctx, p.x, p.y + 12, p.w, 8, 6); ctx.fill();
    }
  }

  // Player square + soft glow
  const { x:px, y:py, size:ps } = s.player;
  ctx.fillStyle = "rgba(120,200,255,.35)";
  rr(ctx, px - 6, py - 6, ps + 12, ps + 12, 8); ctx.fill();
  ctx.fillStyle = "#ffffff";
  rr(ctx, px, py, ps, ps, 6); ctx.fill();

  // Charging ring UI
  if (s.input.spaceHeld || s.input.dragging) {
    const held = s.input.spaceHeld ? (s.time - s.input.spaceStart) : (s.time - s.input.chargeStart);
    const t = clamp(held / CHARGE_MAX, 0, 1);
    drawRing(ctx, W / 2, H - 70, 34, t);
  }

  // Height (top-center)
  const meters = Math.max(0, Math.round((s.startY - s.peakY) / 10));
  ctx.fillStyle = "#cde6ff";
  ctx.font = "bold 18px Inter, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`${meters}m`, W / 2, 28);
}

function drawRing(ctx, cx, cy, r, t) {
  ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
  ctx.strokeStyle = "#b7f4ff"; ctx.lineWidth = 6; ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ================== utils ================== */
function rr(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
