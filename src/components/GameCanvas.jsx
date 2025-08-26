import React, { useEffect, useRef } from "react";

/** Logical canvas size */
const W = 480, H = 800;

/** Physics & controls */
const GRAV = 1850;
const JUMP_MIN = 560, JUMP_MAX = 1300;       // a bit stronger for clarity
const CHARGE_MIN = 0.18, CHARGE_MAX = 1.20;  // normalized 0..1.2
const PLAYER = { size: 28, airDrift: 300 };
const GROUND_Y = 740;                         // base top

export default function GameCanvas({ running, onProgress }) {
  const wrapRef = useRef(null);
  const bgRef = useRef(null);
  const ref = useRef(null);
  const rafRef = useRef(0);
  const st = useRef(null);

  /* ---------- setup ---------- */
  useEffect(() => {
    const setup = (canvas) => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    };
    const bctx = setup(bgRef.current);
    const gctx = setup(ref.current);
    st.current = createWorld();
    drawBG(bctx, 0);
    drawIntro(gctx);

    const onResize = () => { setup(bgRef.current); setup(ref.current); drawBG(bctx, st.current.time || 0); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ---------- run loop ---------- */
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!running) return;

    const gctx = ref.current.getContext("2d");
    const bctx = bgRef.current.getContext("2d");

    const s = (st.current = createWorld()); // fresh world

    const frame = (nowMs) => {
      rafRef.current = requestAnimationFrame(frame);
      if (s.paused) return;
      const now = nowMs / 1000;
      const dt = Math.min(0.033, now - s.last);
      s.last = now; s.time = now;

      updateWorld(s, dt);
      drawBG(bctx, now);
      drawWorld(gctx, s);

      const peakMeters = Math.max(0, Math.round((s.startY - s.peakY) / 10));
      onProgress?.(peakMeters);
      const hud = document.getElementById("hud-score");
      if (hud) hud.innerHTML = `Height: <strong>${peakMeters} m</strong>`;
    };

    st.current.last = performance.now() / 1000;
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, onProgress]);

  /* ---------- inputs (desktop + mobile drag) ---------- */
  useEffect(() => {
    const wrap = wrapRef.current;
    const s = st.current;
    if (!wrap || !s) return;

    // mobile/desktop drag
    let startX = 0, startY = 0;

    const pointerDown = (e) => {
      if (!s.playing) return;
      try { wrap.setPointerCapture(e.pointerId); } catch {}
      s.input.dragging = true;
      s.input.chargeStart = s.time;
      startX = e.clientX; startY = e.clientY;
      s.input.dx = 0; s.input.dy = 0;
    };

    const pointerMove = (e) => {
      if (!s.playing || !s.input.dragging) return;
      s.input.dx = (e.clientX - startX);
      s.input.dy = (e.clientY - startY);
    };

    const pointerUp = (e) => {
      if (!s.playing || !s.input.dragging) return;
      try { wrap.releasePointerCapture(e.pointerId); } catch {}
      s.input.dragging = false;

      const r = wrap.getBoundingClientRect();
      const normLen = Math.hypot(s.input.dx, s.input.dy) / Math.max(r.width, r.height); // 0..~1
      const hold = s.time - s.input.chargeStart;
      const upBias = Math.max(0, -s.input.dy) / Math.max(1, r.height);

      const power = clamp(CHARGE_MIN + normLen*1.0 + upBias*0.7 + hold*0.3, CHARGE_MIN, CHARGE_MAX);
      const dirX = clamp(s.input.dx / (r.width * 0.4), -1, 1);

      performJump(s, power, dirX);
    };

    // keyboard
    const keyDown = (e) => {
      if (!s.playing) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") { s.input.left = 1; e.preventDefault(); }
      if (e.code === "ArrowRight" || e.code === "KeyD") { s.input.right = 1; e.preventDefault(); }
      if (e.code === "Space") {
        if (!s.input.spaceHeld) {
          s.input.spaceHeld = true;
          s.input.spaceStart = s.time;
        }
        e.preventDefault(); // stop page from scrolling/eating space
      }
      if (e.code === "Escape") { s.paused = !s.paused; e.preventDefault(); }
    };
    const keyUp = (e) => {
      if (!s.playing) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") { s.input.left = 0; e.preventDefault(); }
      if (e.code === "ArrowRight" || e.code === "KeyD") { s.input.right = 0; e.preventDefault(); }
      if (e.code === "Space" && s.input.spaceHeld) {
        const held = s.time - s.input.spaceStart;
        const power = clamp(CHARGE_MIN + held, CHARGE_MIN, CHARGE_MAX);
        performJump(s, power, 0);
        s.input.spaceHeld = false;
        e.preventDefault();
      }
    };

    // ensure the wrapper itself never allows default touch behavior
    wrap.style.touchAction = "none";

    wrap.addEventListener("pointerdown", pointerDown);
    wrap.addEventListener("pointermove", pointerMove);
    wrap.addEventListener("pointerup", pointerUp);
    wrap.addEventListener("pointercancel", pointerUp);
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp, { passive: false });
    return () => {
      wrap.removeEventListener("pointerdown", pointerDown);
      wrap.removeEventListener("pointermove", pointerMove);
      wrap.removeEventListener("pointerup", pointerUp);
      wrap.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  return (
    <div ref={wrapRef} className="game-wrap" style={{ touchAction: "none" }}>
      <div className="stage">
        <canvas ref={bgRef} width={W} height={H} />
        <canvas ref={ref}   width={W} height={H} />
      </div>
    </div>
  );
}

/* ================== world / physics ================== */

function createWorld() {
  const s = {
    playing: true, paused: false,
    time: 0, last: 0, camY: 0,
    player: { x: W * 0.5, y: 0, vx: 0, vy: 0, size: PLAYER.size, onGround: true },
    peakY: Infinity,
    lastGroundedAt: 0,
    input: {
      left: 0, right: 0,
      spaceHeld: false, spaceStart: 0,
      dragging: false, chargeStart: 0, dx: 0, dy: 0,
    },
    platforms: [],
    lastPlatY: 100,
    startY: 0,
    combo: 0, perfectCount: 0,
    particles: [], pool: [],
    shakeT: 0, shakeMag: 0,
  };

  // Base — solid, full width
  s.platforms.push({ x: 0, y: GROUND_Y, w: W, h: 18, move: 0, ground: true });

  // Player on base
  s.player.y = GROUND_Y - s.player.size;
  s.player.vy = 0;
  s.player.onGround = true;

  // Camera start
  s.camY = s.player.y + 200;

  // Initial platforms
  s.lastPlatY = s.player.y - 20;
  for (let i = 0; i < 12; i++) {
    const spacing = -60 - i * 58;
    const width = i < 5 ? 120 : Math.max(64, 120 - i * 4);
    spawnPlatform(s, width, spacing);
  }

  s.startY = s.player.y;
  s.peakY = s.player.y;
  return s;
}

function spawnPlatform(s, width = 100, yOffset = -100) {
  const y = s.lastPlatY + yOffset;
  const x = 60 + Math.random() * (W - 120 - width);
  s.platforms.push({
    x, y, w: width, h: 14,
    move: Math.random() < 0.28 ? (40 + Math.random() * 70) : 0,
    phase: Math.random() * Math.PI * 2
  });
  s.lastPlatY = y;
}

/** Jump using normalized power (0.18..1.2) and horizontal push dirX (-1..1) */
function performJump(s, powerNorm, dirX = 0) {
  const canJump = s.player.onGround || (s.time - s.lastGroundedAt <= 0.12);
  if (!canJump) return;

  const p = clamp((powerNorm - CHARGE_MIN) / (CHARGE_MAX - CHARGE_MIN), 0, 1);
  const vy = -lerp(JUMP_MIN, JUMP_MAX, p);
  s.player.vy = vy;
  s.player.onGround = false;

  s.player.vx = clamp(dirX, -1, 1) * 360; // slight boost for clarity

  burst(s, s.player.x + s.player.size / 2, s.player.y + s.player.size, 10, "#9bd5ff", 180, -Math.PI, Math.PI);
}

function updateWorld(s, dt) {
  // moving platforms
  for (const p of s.platforms) {
    if (p.move) {
      p.phase += dt;
      p.x += Math.sin(p.phase) * p.move * dt * 0.8;
      p.x = Math.max(20, Math.min(W - p.w - 20, p.x));
    }
  }

  // keyboard drift
  const driftInput = (s.input.right - s.input.left);
  const targetVx = driftInput * PLAYER.airDrift;
  s.player.vx += (targetVx - s.player.vx) * 0.12;

  // integrate (store prev for sweep)
  const prevY = s.player.y;
  s.player.vy += GRAV * dt;
  s.player.x += s.player.vx * dt;
  s.player.y += s.player.vy * dt;
  s.player.x = Math.max(0, Math.min(W - s.player.size, s.player.x));

  // sweep collision (prevBottom -> currBottom)
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

        if (!pl.ground) {
          const center = pl.x + pl.w / 2;
          const playerCenter = s.player.x + ps / 2;
          const perfect = Math.abs(playerCenter - center) <= 10;
          if (perfect) {
            s.combo = Math.min(10, s.combo + 1);
            s.perfectCount += 1;
            burst(s, playerCenter, s.player.y + ps, 24, "#b7f4ff", 260, Math.PI * 0.9, Math.PI * 2.1);
            shake(s, 6, 0.18);
          } else {
            s.combo = 0;
            burst(s, playerCenter, s.player.y + ps, 12, "#a8cfff", 200, Math.PI, Math.PI * 2);
            shake(s, 3, 0.10);
          }
        } else {
          s.combo = 0;
        }
        break;
      }
    }
  } else {
    if (s.player.onGround) s.lastGroundedAt = s.time;
    s.player.onGround = false;
  }

  // safety ground clamp
  const ps = s.player.size;
  if (s.player.y + ps > GROUND_Y) {
    s.player.y = GROUND_Y - ps;
    s.player.vy = 0;
    s.player.onGround = true;
    s.lastGroundedAt = s.time;
  }

  // peak
  s.peakY = Math.min(s.peakY, s.player.y);

  // spawn above
  const highestY = Math.min(...s.platforms.map(p => p.y));
  if (s.camY - highestY < H * 0.6) {
    const climbed = Math.max(0, Math.round((s.startY - s.peakY) / 60));
    const width = Math.max(56, 120 - climbed * 3.2);
    spawnPlatform(s, width, -120 - Math.random() * 45);
  }

  // camera follow
  const targetCam = s.player.y - 200;
  s.camY = lerp(s.camY, targetCam, 0.08);

  // particles
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i];
    p.vx *= 0.99; p.vy += 600 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt;
    if (p.l <= 0) { s.pool.push(p); s.particles.splice(i, 1); }
  }
}

/* ================== draw ================== */

function drawBG(ctx, t) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const Wv = ctx.canvas.width / dpr, Hv = ctx.canvas.height / dpr;
  ctx.clearRect(0, 0, Wv, Hv);

  const y1 = Hv * (0.2 + 0.1 * Math.sin(t * 0.2));
  const y2 = Hv * (0.9 + 0.1 * Math.cos(t * 0.2));
  const g = ctx.createLinearGradient(0, y1, Wv, y2);
  g.addColorStop(0, "rgba(80,60,180,0.10)");
  g.addColorStop(0.5, "rgba(20,140,255,0.08)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g; ctx.fillRect(0,0,Wv,Hv);

  ctx.fillStyle = "rgba(255,255,255,.8)";
  for (let i = 0; i < 110; i++) {
    const x = (i * 73 + Math.sin(t + i) * 999) % Wv;
    const y = (i * 91 + Math.cos(t * 0.7 + i) * 777) % Hv;
    const r = i % 13 === 0 ? 2 : 1;
    ctx.fillRect(x, y, r, r);
  }
}

function drawWorld(ctx, s) {
  ctx.clearRect(0, 0, W, H);

  // platforms
  for (const p of s.platforms) {
    const y = p.y - s.camY + H / 2;
    if (y > H + 30 || y < -30) continue;
    ctx.fillStyle = p.ground ? "rgba(180,210,255,1.0)" : "rgba(180,210,255,0.9)";
    roundRect(ctx, p.x, y, p.w, p.h, p.ground ? 0 : 6); ctx.fill();
    if (!p.ground) {
      ctx.fillStyle = "rgba(80,140,255,0.25)";
      roundRect(ctx, p.x, y + 12, p.w, 8, 6); ctx.fill();
    }
  }

  // player
  const py = s.player.y - s.camY + H / 2, px = s.player.x;
  ctx.fillStyle = "rgba(120,200,255,.35)";
  roundRect(ctx, px - 6, py - 6, s.player.size + 12, s.player.size + 12, 8); ctx.fill();
  ctx.fillStyle = "#dff2ff";
  roundRect(ctx, px, py, s.player.size, s.player.size, 6); ctx.fill();

  // charge ring (visual hint)
  if (s.input.spaceHeld || s.input.dragging) {
    const t = clamp((s.time - (s.input.spaceHeld ? s.input.spaceStart : s.input.chargeStart)) / CHARGE_MAX, 0, 1);
    drawRing(ctx, W / 2, H - 70, 34, t);
  }

  // particles
  for (const p of s.particles) {
    const y = p.y - s.camY + H / 2;
    ctx.globalAlpha = Math.max(0, p.l / p.life);
    ctx.fillStyle = p.c;
    if (p.shape === "tri") {
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.a) * p.r, y + Math.sin(p.a) * p.r);
      ctx.lineTo(p.x + Math.cos(p.a + 2.5) * p.r * 0.6, y + Math.sin(p.a + 2.5) * p.r * 0.6);
      ctx.lineTo(p.x + Math.cos(p.a - 2.5) * p.r * 0.6, y + Math.sin(p.a - 2.5) * p.r * 0.6);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(p.x, y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/* ================== utils ================== */

function burst(s, x, y, count, color, speed = 220, from = Math.PI, to = Math.PI * 2) {
  for (let i = 0; i < count; i++) {
    const a = rand(from, to);
    const v = speed * (0.5 + Math.random() * 0.7);
    const p = s.pool.pop() || {};
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * v;
    p.vy = Math.sin(a) * v * -1;
    p.a = Math.random() * Math.PI * 2;
    p.r = 2 + Math.random() * 3;
    p.c = color;
    p.life = 0.6 + Math.random() * 0.4;
    p.l = p.life;
    p.shape = Math.random() < 0.35 ? "tri" : "dot";
    s.particles.push(p);
  }
}
function drawRing(ctx, cx, cy, r, t) {
  ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
  ctx.strokeStyle = "#b7f4ff"; ctx.lineWidth = 6; ctx.stroke();
  ctx.globalAlpha = 1;
}
function roundRect(ctx, x, y, w, h, r) {
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
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }

function drawIntro(ctx) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.textAlign = "center";
  ctx.font = "bold 20px Inter, system-ui";
  ctx.fillText("Click Play to start…", W / 2, H / 2);
}
