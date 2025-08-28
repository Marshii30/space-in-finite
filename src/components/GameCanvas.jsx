import React, { useEffect, useRef } from "react";

/* ---- canvas size ---- */
const W = 480, H = 800;

/* ---- physics & controls (unchanged) ---- */
const GRAV = 1850;
const JUMP_MIN = 560, JUMP_MAX = 1300;
const CHARGE_MIN = 0.18, CHARGE_MAX = 1.20;
const PLAYER = { size: 28, airDrift: 300 };
const BASE_TOP = 740;
const COYOTE = 0.16;
const AIR_DAMP = 0.995;
const NEAR_GROUND_TOL = 1.25;

/* ---- progression targets ---- */
const MAX_METERS = 3000;

/* ---- platform streaming (NEW) ---- */
const LEAD_METERS = 120;         // keep ~12 "meters" of lead above current peak
const CULL_BELOW_PX = H * 1.2;   // cull platforms far below the view

export default function GameCanvas({ running, onProgress }) {
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const rafRef = useRef(0);
  const st = useRef(null);

  /* stable onProgress */
  const progRef = useRef(onProgress);
  useEffect(() => { progRef.current = onProgress; }, [onProgress]);

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    const setup = (canvas) => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      const ctx = canvas.getContext("2d", { alpha: true });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    };
    const bctx = setup(bgRef.current);
    const fctx = setup(fgRef.current);
    st.current = createWorld();
    drawBG(bctx, 0);
    drawWorld(fctx, st.current);

    const onResize = () => { setup(bgRef.current); setup(fgRef.current); drawBG(bctx, st.current?.time || 0); drawWorld(fctx, st.current); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ---------- loop ---------- */
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!running) return;

    const bctx = bgRef.current.getContext("2d");
    const fctx = fgRef.current.getContext("2d");
    st.current = createWorld();                  // fresh run
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

      // Height for HUD
      const meters = Math.max(0, Math.round((s.startY - s.peakY) / 10));
      progRef.current?.(meters);
      const hud = document.getElementById("hud-score");
      if (hud) hud.innerHTML = `Height: <strong>${meters} m</strong>`;
    };

    st.current.last = performance.now() / 1000;
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  /* ---------- inputs: drag+release & Space; arrows steer (unchanged) ---------- */
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
    const pointerUp = (e) => {
      const s = st.current; if (!s || !s.input.dragging) return;
      e.preventDefault();
      s.input.dragging = false;

      const rect = canvas.getBoundingClientRect();
      const normLen = Math.hypot(s.input.dx, s.input.dy) / Math.max(rect.width, rect.height);
      const hold    = Math.max(0, s.time - s.input.chargeStart);
      const upBias  = Math.max(0, -s.input.dy) / Math.max(1, rect.height);

      const power = clamp(CHARGE_MIN + normLen*1.0 + upBias*0.7 + hold*0.3, CHARGE_MIN, CHARGE_MAX);
      const dirX  = clamp(s.input.dx / (rect.width * 0.4), -1, 1);

      s.input.wantJump = { power, dirX, at: s.time };
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
        const held = Math.max(0.02, s.time - s.input.spaceStart);
        const power = clamp(CHARGE_MIN + held, CHARGE_MIN, CHARGE_MAX);
        s.input.spaceHeld = false;
        s.input.wantJump = { power, dirX: 0, at: s.time };
        e.preventDefault();
      }
    };

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", pointerDown, { passive: false });
    canvas.addEventListener("pointermove", pointerMove, { passive: false });
    canvas.addEventListener("pointerup",   pointerUp,   { passive: false });
    canvas.addEventListener("pointercancel", pointerUp, { passive: false });
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup",   keyUp,   { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  return (
    <div className="game-wrap" style={{ touchAction: "none" }}>
      <div className="stage">
        <canvas ref={bgRef} width={W} height={H} style={{ pointerEvents: "none" }}/>
        <canvas ref={fgRef} width={W} height={H}/>
      </div>
    </div>
  );
}

/* ================== world / physics ================== */

function createWorld(){
  const s = {
    time: 0, last: 0,
    player: { x: W*0.5 - PLAYER.size/2, y: 0, vx:0, vy:0, size: PLAYER.size, onGround:true },
    lastGroundedAt: 0,
    peakY: Infinity,
    camY: 0,                                       // camera y (follows player)
    input: {
      left:0, right:0,
      spaceHeld:false, spaceStart:0,
      dragging:false, chargeStart:0, dx:0, dy:0,
      wantJump: undefined,          // { power, dirX, at }
    },
    platforms: [],
    startY: 0,

    // streaming state (NEW)
    highestGeneratedMeters: 0,                     // how far we’ve generated
  };

  // base
  s.platforms.push({ x:0, y:BASE_TOP, w:W, h:24, type:"base" });

  // player on base
  s.player.y = BASE_TOP - s.player.size;
  s.player.vx = 0; s.player.vy = 0; s.player.onGround = true;
  s.lastGroundedAt = 0;

  // initial seed (static)
  let y = BASE_TOP - 130;
  for(let i=0;i<6;i++){
    const w = i<2 ? 120 : Math.max(70, 120 - i*10);
    const x = 40 + Math.random()*(W - 80 - w);
    s.platforms.push({ x, y, w, h:14, type:"plat", move: 0, phase: 0 });
    y -= 120;
  }

  s.startY = s.player.y;
  s.peakY  = s.player.y;

  // camera starts a bit above player so they’re comfortably visible
  s.camY = s.player.y - 220;

  // we’ve “generated” at least the starting stack:
  s.highestGeneratedMeters = metersFromY(s, y);

  return s;
}

function performJump(s, powerNorm, dirX=0){
  const nearBase = (s.player.y + s.player.size) >= (BASE_TOP - NEAR_GROUND_TOL);
  const canJump = s.player.onGround || nearBase || (s.time - s.lastGroundedAt <= COYOTE);
  if(!canJump) return false;

  if(nearBase) s.player.y = BASE_TOP - s.player.size - 0.5; // nudge off base

  const p = clamp((powerNorm - CHARGE_MIN)/(CHARGE_MAX - CHARGE_MIN), 0, 1);
  s.player.vy = -lerp(JUMP_MIN, JUMP_MAX, p);
  s.player.vx = clamp(dirX, -1, 1) * 380;
  s.player.onGround = false;

  s.input.wantJump = undefined;
  return true;
}

function updateWorld(s, dt){
  // consume queued jump (keep intent up to 0.7s)
  if(s.input.wantJump){
    const ok = performJump(s, s.input.wantJump.power, s.input.wantJump.dirX);
    if(!ok && (s.time - s.input.wantJump.at) > 0.7){
      s.input.wantJump = undefined;
    }
  }

  // steering only affects the square
  const drift = (s.input.right - s.input.left);
  const targetVx = drift * PLAYER.airDrift;
  if(!s.player.onGround){
    s.player.vx += (targetVx - s.player.vx) * 0.12;
    s.player.vx *= AIR_DAMP;
  }else{
    s.player.vx += (targetVx - s.player.vx) * 0.18;
  }

  // integrate
  const prevY = s.player.y;
  s.player.vy += GRAV * dt;
  s.player.x  += s.player.vx * dt;
  s.player.y  += s.player.vy * dt;
  s.player.x   = Math.max(0, Math.min(W - s.player.size, s.player.x));

  // collisions (falling)
  if(s.player.vy >= 0){
    const px = s.player.x, ps = s.player.size;
    const prevBottom = prevY + ps;
    const currBottom = s.player.y + ps;
    for(const pl of s.platforms){
      const top = pl.y;
      const horz = (px + ps > pl.x) && (px < pl.x + pl.w);
      const crossed = prevBottom <= top && currBottom >= top;
      if(horz && crossed){
        s.player.y = top - ps;
        s.player.vy = 0;
        s.player.onGround = (pl.type !== "cloud");   // keep logic same (no clouds used now)
        s.lastGroundedAt = s.time;
        break;
      }
    }
  }else{
    if(s.player.onGround) s.lastGroundedAt = s.time;
    s.player.onGround = false;
  }

  // base clamp (missed landings fall back to base)
  const ps = s.player.size;
  if(s.player.y + ps > BASE_TOP){
    s.player.y = BASE_TOP - ps;
    s.player.vy = 0;
    s.player.onGround = true;
    s.lastGroundedAt = s.time;
  }

  // peak for HUD
  s.peakY = Math.min(s.peakY, s.player.y);
  const meters = Math.max(0, Math.round((s.startY - s.peakY)/10));

  // ---------- camera follow (unchanged feel) ----------
  const targetCam = s.player.y - 220; // slight offset so player is shown comfortably
  s.camY = lerp(s.camY, targetCam, 0.08);

  // ---------- PLATFORM STREAMING (NEW) ----------
  // 1) Generate more platforms above if needed up to MAX_METERS
  const needUpTo = Math.min(MAX_METERS, meters + LEAD_METERS);
  if (needUpTo > s.highestGeneratedMeters) {
    generateUpToMeters(s, needUpTo);
    s.highestGeneratedMeters = needUpTo;
  }

  // 2) Cull platforms far below the camera (keep the base always)
  const viewBottomY = s.camY + H/2;
  for (let i = s.platforms.length - 1; i >= 0; i--) {
    const pl = s.platforms[i];
    if (pl.type === "base") continue;
    if (pl.y - viewBottomY > CULL_BELOW_PX) {
      s.platforms.splice(i, 1);
    }
  }
}

/* ================== difficulty / generation (kept same behavior) ================== */

/* Convert y to meters climbed from start */
function metersFromY(s, y){
  return Math.max(0, Math.round((s.startY - y) / 10));
}

/* Tier parameters based on meters (mirrors your existing difficulty idea) */
function tierForMeters(m){
  // Defaults (early game)
  let widthMin = 70, widthMax = 120, gapY = 120, movers = 0, moverSpeed = 0;

  if (m < 300) { // L1 normal
    widthMin = 70; widthMax = 120; gapY = 120; movers = 0; moverSpeed = 0;
  } else if (m < 600) { // shrink blocks
    widthMin = 50; widthMax = 90; gapY = 120; movers = 0; moverSpeed = 0;
  } else if (m < 1000) { // bigger vertical gaps
    widthMin = 50; widthMax = 90; gapY = 140; movers = 0; moverSpeed = 0;
  } else if (m < 1500) { // movers introduced
    widthMin = 48; widthMax = 86; gapY = 145; movers = 0.35; moverSpeed = 70;
  } else if (m < 2000) { // harder: small + big gaps + movers
    widthMin = 42; widthMax = 78; gapY = 155; movers = 0.45; moverSpeed = 85;
  } else if (m < 2700) { // normal again like early game
    widthMin = 70; widthMax = 120; gapY = 120; movers = 0.15; moverSpeed = 55;
  } else { // 2700-3000: very tiny + big gaps (very hard)
    widthMin = 34; widthMax = 56; gapY = 170; movers = 0.55; moverSpeed = 95;
  }

  return { widthMin, widthMax, gapY, movers, moverSpeed };
}

/* Generate platforms from the current highest in s up to target meters */
function generateUpToMeters(s, targetMeters){
  // Find current highest (smallest y)
  let highestY = Number.POSITIVE_INFINITY;
  for (const p of s.platforms) highestY = Math.min(highestY, p.y);
  if (!isFinite(highestY)) highestY = BASE_TOP - 130;

  // continue from there
  let y = highestY - 1;

  // Generate until we reach targetMeters in terms of y
  while (metersFromY(s, y) < targetMeters) {
    const m = metersFromY(s, y);
    const tier = tierForMeters(m);
    const w = rand(tier.widthMin, tier.widthMax);

    const x = 20 + Math.random() * (W - 40 - w);
    // push a platform
    const plat = { x, y, w, h: 14, type: "plat", move: 0, phase: 0 };
    if (Math.random() < tier.movers) {
      plat.move = tier.moverSpeed;              // oscillation amplitude proxy
      plat.phase = Math.random() * Math.PI * 2;
    }
    s.platforms.push(plat);

    // step upward by gap
    y -= tier.gapY;
  }
}

/* ================== drawing (unchanged visuals) ================== */

function drawBG(ctx, t){
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const Wv = ctx.canvas.width / dpr, Hv = ctx.canvas.height / dpr;
  ctx.clearRect(0,0,Wv,Hv);

  // deep space
  const g1 = ctx.createLinearGradient(0,0,0,Hv);
  g1.addColorStop(0,"#0b1222");
  g1.addColorStop(1,"#071422");
  ctx.fillStyle = g1; ctx.fillRect(0,0,Wv,Hv);

  // nebula
  const neb = ctx.createRadialGradient(Wv*0.5, Hv*0.85, 60, Wv*0.5, Hv*1.1, 600);
  neb.addColorStop(0,"rgba(35,120,255,0.10)");
  neb.addColorStop(1,"transparent");
  ctx.fillStyle = neb; ctx.fillRect(0,0,Wv,Hv);

  // stars
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for(let i=0;i<140;i++){
    const x = (i*73 + Math.sin(t*0.6 + i)*999) % Wv;
    const y = (i*89 + Math.cos(t*0.5 + i)*777) % Hv;
    const r = i%17===0 ? 2 : 1;
    ctx.fillRect(x,y,r,r);
  }
}

function drawWorld(ctx, s){
  ctx.clearRect(0,0,W,H);

  // platforms (shifted by camera)
  for(const p of s.platforms){
    const yy = p.y - s.camY + H/2;
    if (yy < -40 || yy > H + 60) continue; // small cull for draw
    const color = p.type==="base" ? "rgba(180,210,255,1.0)" : "rgba(160,190,255,0.9)";
    ctx.fillStyle = color;
    roundRect(ctx, p.x, yy, p.w, p.h, 8); ctx.fill();
    if(p.type!=="base"){
      ctx.fillStyle = "rgba(80,140,255,0.25)";
      roundRect(ctx, p.x, yy+12, p.w, 8, 6); ctx.fill();
    }
  }

  // player (shifted by camera)
  const { x:px, y:py, size:ps } = s.player;
  const pyy = py - s.camY + H/2;
  ctx.fillStyle = "rgba(120,200,255,.35)";
  roundRect(ctx, px-6, pyy-6, ps+12, ps+12, 8); ctx.fill();
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, px, pyy, ps, ps, 6); ctx.fill();

  // charge ring while charging
  if(s.input.spaceHeld || s.input.dragging){
    const held = s.input.spaceHeld ? (s.time - s.input.spaceStart) : (s.time - s.input.chargeStart);
    const t = clamp(held / CHARGE_MAX, 0, 1);
    drawRing(ctx, W/2, H-70, 34, t);
  }

  // height top-center
  const meters = Math.max(0, Math.round((s.startY - s.peakY)/10));
  ctx.fillStyle = "#cde6ff";
  ctx.font = "bold 18px Inter, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`${meters}m`, W/2, 28);
}

function drawRing(ctx, cx, cy, r, t){
  ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*t);
  ctx.strokeStyle = "#b7f4ff"; ctx.lineWidth = 6; ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ================== utils ================== */
function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.lineTo(x+w-rr, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+rr);
  ctx.lineTo(x+w, y+h-rr);
  ctx.quadraticCurveTo(x+w, y+h, x+w-rr, y+h);
  ctx.lineTo(x+rr, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-rr);
  ctx.lineTo(x, y+rr);
  ctx.quadraticCurveTo(x, y, x+rr, y);
  ctx.closePath();
}
function lerp(a,b,t){ return a + (b-a)*t; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function rand(a,b){ return a + Math.random()*(b-a); }
