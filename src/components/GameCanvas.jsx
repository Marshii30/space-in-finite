import React, { useEffect, useRef, useState } from "react";

/* ---------- canvas size ---------- */
const W = 480, H = 800;

/* ---------- physics & controls ---------- */
const GRAV = 1850;
const JUMP_MIN = 560, JUMP_MAX = 1300;
const CHARGE_MIN = 0.18, CHARGE_MAX = 1.20;
const PLAYER = { size: 28, airDrift: 300 };

const BASE_TOP = 740;
const COYOTE = 0.16;
const AIR_DAMP = 0.995;
const NEAR_GROUND_TOL = 1.25;

/* camera */
const CAM_LAG = 0.06;
const CAM_OFFSET = 230;

/* ---------- sound file paths ---------- */
const jumpSoundFile = "/sounds/jump.mp3";
const landSoundFile = "/sounds/land.mp3";
const defaultBgMusicFile = "/sounds/bg-music.mp3";

export default function GameCanvas({ running, onProgress, muted, selectedSong }) {
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const rafRef = useRef(0);
  const st = useRef(null);
  const aliveRef = useRef(false);
  const pausedRef = useRef(false);

  const [isMobile, setIsMobile] = useState(false);

  const progRef = useRef(onProgress);
  useEffect(() => { progRef.current = onProgress; }, [onProgress]);

  /* ---------- sounds ---------- */
  const jumpSound = useRef(null);
  const landSound = useRef(null);
  const bgMusic = useRef(null);
  const unlocked = useRef(false);

  useEffect(() => {
    jumpSound.current = new Audio(jumpSoundFile);
    landSound.current = new Audio(landSoundFile);

    // ✅ Use selectedSong if chosen, else fallback
    const bgFile = selectedSong ? `/songs/${selectedSong}.mp3` : defaultBgMusicFile;
    bgMusic.current = new Audio(bgFile);

    if (bgMusic.current) {
      if (selectedSong) {
        bgMusic.current.loop = false; // song plays once
      } else {
        bgMusic.current.loop = true; // fallback loops
      }
      bgMusic.current.volume = 0.35;
    }

    const unlock = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      if (bgMusic.current && running && !muted) {
        bgMusic.current.play().catch((err) => {
          console.warn("Autoplay blocked:", err);
        });
      }
    };

    // ✅ Handle game over when song finishes
    if (bgMusic.current && selectedSong) {
      bgMusic.current.onended = () => {
        const meters = Math.max(0, Math.round((st.current.startY - st.current.peakY) / 10));
        const playerName = localStorage.getItem("lastPlayerName") || "Unknown";

        // Save to leaderboard
        const leaderboard = JSON.parse(localStorage.getItem("leaderboard") || "[]");
        leaderboard.push({ name: playerName, score: meters });
        leaderboard.sort((a, b) => b.score - a.score); // highest first
        localStorage.setItem("leaderboard", JSON.stringify(leaderboard.slice(0, 10)));

        alert("🎵 Game Over — Song Finished!");
        window.location.reload(); // reset game
      };
    }

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      if (bgMusic.current) {
        bgMusic.current.pause();
        bgMusic.current = null;
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [running, muted, selectedSong]);

  /* ---------- detect mobile ---------- */
  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsMobile(mobile);
  }, []);

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    const setup = (canvas) => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = W * dpr;
      canvas.height = H * dpr;

      if (isMobile) {
        const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
        canvas.style.width = W * scale + "px";
        canvas.style.height = H * scale + "px";
      } else {
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
      }

      const ctx = canvas.getContext("2d", { alpha: true });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    };
    const bctx = setup(bgRef.current);
    const fctx = setup(fgRef.current);
    st.current = createWorld();
    drawBG(bctx, 0, 0);
    drawWorld(fctx, st.current);

    const onResize = () => {
      setup(bgRef.current);
      setup(fgRef.current);
      drawBG(bctx, st.current?.time || 0, 0);
      drawWorld(fctx, st.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile]);

  /* ---------- visibility / pause fix ---------- */
  useEffect(() => {
    const pause = () => { pausedRef.current = true; cancelAnimationFrame(rafRef.current); aliveRef.current = false; };
    const resume = () => {
      if (!running) return;
      if (aliveRef.current) return;
      const s = st.current;
      if (s) s.last = performance.now() / 1000;
      startLoop();
    };

    const onVisibility = () => (document.hidden ? pause() : resume());
    const onPageShow = () => resume();
    const onPageHide = () => pause();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("focus", resume);
    window.addEventListener("blur", pause);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", resume);
      window.removeEventListener("blur", pause);
    };
  }, [running]);

  /* ---------- main loop ---------- */
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    aliveRef.current = false;
    if (!running) return;

    const bctx = bgRef.current.getContext("2d");
    const fctx = fgRef.current.getContext("2d");
    st.current = createWorld();
    drawWorld(fctx, st.current);

    startLoop();

    function frame(nowMs) {
      rafRef.current = requestAnimationFrame(frame);
      if (pausedRef.current) return;
      const s = st.current; if (!s) return;

      const now = nowMs / 1000;
      const dt  = Math.min(0.033, now - s.last);
      s.last = now; s.time = now;

      updateWorld(s, dt, jumpSound, landSound);
      const meters = Math.max(0, Math.round((s.startY - s.peakY) / 10));
      drawBG(bctx, now, meters);
      drawWorld(fctx, s);

      progRef.current?.(meters);
      const hud = document.getElementById("hud-score");
      if (hud) hud.innerHTML = `Height: <strong>${meters} m</strong>`;
    }

    function startLoop() {
      if (aliveRef.current) return;
      pausedRef.current = false;
      const s = st.current;
      if (s) s.last = performance.now() / 1000;
      aliveRef.current = true;
      rafRef.current = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      aliveRef.current = false;
    };
  }, [running]);

  /* ---------- inputs (drag + keyboard only) ---------- */
  useEffect(() => {
    const canvas = fgRef.current;
    if (!canvas) return;

    const oldTA = canvas.style.touchAction;
    const oldOGA = document.documentElement.style.overscrollBehavior;
    canvas.style.touchAction = "none";
    document.documentElement.style.overscrollBehavior = "none";

    let startX = 0, startY = 0;
    let activePointer = null;

    const pointerDown = (e) => {
      const s = st.current; if (!s) return;
      if (activePointer !== null && e.pointerId !== activePointer) return;
      activePointer = e.pointerId ?? 1;
      try { canvas.setPointerCapture?.(activePointer); } catch(_) {}
      e.preventDefault();
      startX = e.clientX; startY = e.clientY;
      s.input.dragging = true;
      s.input.chargeStart = s.time;
      s.input.dx = 0; s.input.dy = 0;
    };
    const pointerMove = (e) => {
      const s = st.current; if (!s || !s.input.dragging) return;
      if (activePointer !== null && e.pointerId !== undefined && e.pointerId !== activePointer) return;
      e.preventDefault();
      s.input.dx = e.clientX - startX;
      s.input.dy = e.clientY - startY;
    };
    const release = (e) => {
      const s = st.current;
      if (!s || !s.input.dragging) { activePointer = null; return; }
      if (activePointer !== null && e.pointerId !== undefined && e.pointerId !== activePointer) return;
      e.preventDefault();
      s.input.dragging = false;

      const rect = canvas.getBoundingClientRect();
      const normLen = Math.hypot(s.input.dx, s.input.dy) / Math.max(rect.width, rect.height);
      const hold    = Math.max(0, s.time - s.input.chargeStart);
      const upBias  = Math.max(0, -s.input.dy) / Math.max(1, rect.height);

      const power = clamp(CHARGE_MIN + normLen*1.0 + upBias*0.7 + hold*0.3, CHARGE_MIN, CHARGE_MAX);
      s.input.wantJump = { power, dirX: 0, at: s.time };

      // 🔊 play jump sound
      if (jumpSound.current && !muted) {
        jumpSound.current.currentTime = 0;
        jumpSound.current.play().catch(()=>{});
      }

      activePointer = null;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch (_) {}
    };

    const keyDown = (e) => {
      const s = st.current; if (!s) return;
      if (e.code === "ArrowLeft"  || e.code === "KeyA") { s.input.left = 1; e.preventDefault(); }
      if (e.code === "ArrowRight" || e.code === "KeyD") { s.input.right = 1; e.preventDefault(); }
      if (e.code === "Space") {
        if (!s.input.spaceHeld) { 
          s.input.spaceHeld = true; 
          s.input.spaceStart = s.time; 
        }
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

        // 🔊 play jump sound
        if (jumpSound.current && !muted) {
          jumpSound.current.currentTime = 0;
          jumpSound.current.play().catch(()=>{});
        }

        e.preventDefault();
      }
    };

    const opts = { passive: false };
    canvas.addEventListener("pointerdown", pointerDown, opts);
    canvas.addEventListener("pointermove", pointerMove, opts);
    canvas.addEventListener("pointerup",   release,     opts);
    canvas.addEventListener("pointercancel", release,   opts);
    canvas.addEventListener("pointerleave",  release,   opts);
    window.addEventListener("keydown", keyDown, opts);
    window.addEventListener("keyup",   keyUp,   opts);

    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup",   release);
      canvas.removeEventListener("pointercancel", release);
      canvas.removeEventListener("pointerleave",  release);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup",   keyUp);
      canvas.style.touchAction = oldTA;
      document.documentElement.style.overscrollBehavior = oldOGA;
    };
  }, [muted]);

  /* ---------- mobile button handlers ---------- */
  const moveLeft = () => { const s = st.current; if (s) s.input.left = 1; };
  const stopLeft = () => { const s = st.current; if (s) s.input.left = 0; };
  const moveRight = () => { const s = st.current; if (s) s.input.right = 1; };
  const stopRight = () => { const s = st.current; if (s) s.input.right = 0; };

  return (
    <div className="game-wrap" style={{ touchAction: "none" }}>
      <div className="stage">
        <canvas ref={bgRef} width={W} height={H} style={{ pointerEvents: "none" }} />
        <canvas ref={fgRef} width={W} height={H} />
      </div>

      {isMobile && (
        <div className="mobile-controls">
          <button onTouchStart={moveLeft} onTouchEnd={stopLeft}>⬅️</button>
          <button onTouchStart={moveRight} onTouchEnd={stopRight}>➡️</button>
        </div>
      )}
    </div>
  );
}

/* ========== WORLD / PHYSICS ========== */
function createWorld(){
  const s = {
    time: 0, last: 0,
    camY: 0,
    player: { x: W*0.5 - PLAYER.size/2, y: 0, vx:0, vy:0, size: PLAYER.size, onGround:true },
    lastGroundedAt: 0,
    peakY: Infinity,
    input: { left:0, right:0, spaceHeld:false, spaceStart:0, dragging:false, chargeStart:0, dx:0, dy:0, wantJump: undefined },
    platforms: [],
    startY: 0, nextSpawnY: 0, maxMeters: 3000,
  };
  s.platforms.push({ x:0, y:BASE_TOP, w:W, h:24, type:"base" });
  s.player.y = BASE_TOP - s.player.size;
  let y = BASE_TOP - 130;
  for(let i=0;i<6;i++){
    const w = i<2 ? 120 : Math.max(70, 120 - i*10);
    const x = 40 + Math.random()*(W - 80 - w);
    s.platforms.push({ x, y, w, h:14, type:"plat", move: 0, phase: 0 });
    y -= 120;
  }
  s.startY = s.player.y;
  s.peakY  = s.player.y;
  s.camY   = s.player.y - CAM_OFFSET;
  s.nextSpawnY = y;
  return s;
}

function performJump(s, powerNorm, dirX=0){
  const nearBase = (s.player.y + s.player.size) >= (BASE_TOP - NEAR_GROUND_TOL);
  const canJump = s.player.onGround || nearBase || (s.time - s.lastGroundedAt <= COYOTE);
  if(!canJump) return false;
  if(nearBase) s.player.y = BASE_TOP - s.player.size - 0.5;
  const p = clamp((powerNorm - CHARGE_MIN)/(CHARGE_MAX - CHARGE_MIN), 0, 1);
  s.player.vy = -lerp(JUMP_MIN, JUMP_MAX, p);
  s.player.vx = clamp(dirX, -1, 1) * 380;
  s.player.onGround = false;
  s.input.wantJump = undefined;
  return true;
}

function updateWorld(s, dt, jumpSound, landSound){
  if(s.input.wantJump){
    const ok = performJump(s, s.input.wantJump.power, s.input.wantJump.dirX);
    if(!ok && (s.time - s.input.wantJump.at) > 0.7){
      s.input.wantJump = undefined;
    }
  }
  const drift = (s.input.right - s.input.left);
  const targetVx = drift * PLAYER.airDrift;
  if(!s.player.onGround){ s.player.vx += (targetVx - s.player.vx) * 0.12; s.player.vx *= AIR_DAMP; }
  else { s.player.vx += (targetVx - s.player.vx) * 0.18; }
  const prevY = s.player.y;
  s.player.vy += GRAV * dt;
  s.player.x  += s.player.vx * dt;
  s.player.y  += s.player.vy * dt
    s.player.x   = Math.max(0, Math.min(W - s.player.size, s.player.x));
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
        if (!s.player.onGround && landSound?.current && !landSound.current.muted) {
          landSound.current.currentTime = 0;
          landSound.current.play().catch(()=>{});
        }
        s.player.onGround = true; 
        s.lastGroundedAt = s.time; 
        break; 
      }
    }
  }else{ 
    if(s.player.onGround) s.lastGroundedAt = s.time; 
    s.player.onGround = false; 
  }

  const ps = s.player.size;
  if(s.player.y + ps > BASE_TOP){ 
    s.player.y = BASE_TOP - ps; 
    s.player.vy = 0; 
    if (!s.player.onGround && landSound?.current && !landSound.current.muted) {
      landSound.current.currentTime = 0;
      landSound.current.play().catch(()=>{});
    }
    s.player.onGround = true; 
    s.lastGroundedAt = s.time; 
  }

  s.peakY = Math.min(s.peakY, s.player.y);
  const targetCam = s.player.y - CAM_OFFSET;
  s.camY += (targetCam - s.camY) * CAM_LAG;
  spawnAsNeeded(s);
}

function spawnAsNeeded(s){
  while (true) {
    const spawnedMeters = Math.max(0, Math.round((s.startY - s.nextSpawnY) / 10));
    if (spawnedMeters >= s.maxMeters) break;
    const highestY = Math.min(...s.platforms.map(p=>p.y));
    if (highestY < s.camY - 120) break;
    const m = spawnedMeters;
    let wMin=70, wMax=120, gap=120, movers=0;
    if (m < 300) { wMin = 70; wMax = 120; gap = 120; movers = 0; }
    else if (m < 600) { wMin = 40; wMax = 70;  gap = 128; movers = 0.25; } // ✅ Added movers earlier
    else if (m < 1000) { wMin = 50; wMax = 90;  gap = 145; movers = 0; }
    else if (m < 1500) { wMin = 54; wMax = 92;  gap = 150; movers = 0.25; }
    else if (m < 2000) { wMin = 36; wMax = 64;  gap = 165; movers = 0.32; }
    else if (m < 2250) { wMin = 36; wMax = 64;  gap = 170; movers = 0.55; } 
    else if (m < 2700) { wMin = 70; wMax = 120; gap = 120; movers = 0; }
    else { wMin = 20; wMax = 32;  gap = 190; movers = 0.45; }

    const width = Math.floor(wMin + Math.random()*(wMax - wMin));
    const x = 20 + Math.random()*(W - 40 - width);
    const y = s.nextSpawnY - gap;
    const p = { x, y, w: width, h: 14, type:"plat", move: 0, phase: 0 };
    if (Math.random() < movers) { p.move = 70 + Math.random()*90; p.phase = Math.random()*6; }
    s.platforms.push(p);
    s.nextSpawnY = y;
    while (s.platforms.length > 32) s.platforms.splice(1,1);
  }
}

function drawBG(ctx, t, meters){
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const Wv = ctx.canvas.width / dpr, Hv = ctx.canvas.height / dpr;
  ctx.clearRect(0,0,Wv,Hv);

  const g1 = ctx.createLinearGradient(0,0,0,Hv);
  g1.addColorStop(0,"#0b1222");
  g1.addColorStop(1,"#071422");
  ctx.fillStyle = g1; ctx.fillRect(0,0,Wv,Hv);

  if (meters < 1000) {
    const neb = ctx.createRadialGradient(Wv*0.5, Hv*0.85, 60, Wv*0.5, Hv*1.1, 600);
    neb.addColorStop(0,"rgba(35,120,255,0.12)");
    neb.addColorStop(1,"transparent");
    ctx.fillStyle = neb; ctx.fillRect(0,0,Wv,Hv);
  } else if (meters < 2000) {
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for(let i=0;i<120;i++){
      const x = (i*59 + Math.sin(t*0.3 + i)*500) % Wv;
      const y = (i*71 + Math.cos(t*0.27 + i)*600) % Hv;
      const r = (i%15===0) ? 2 : 1;
      ctx.fillRect(x,y,r,r);
    }
  } else if (meters < 2700) {
    const solar = ctx.createRadialGradient(Wv*0.5, Hv*0.2, 40, Wv*0.5, Hv*0.2, 500);
    solar.addColorStop(0,"rgba(255,200,120,0.12)");
    solar.addColorStop(1,"transparent");
    ctx.fillStyle = solar; ctx.fillRect(0,0,Wv,Hv);
  } else {
    const sun = ctx.createRadialGradient(Wv*0.5, Hv*0.5, 60, Wv*0.5, Hv*0.5, 600);
    sun.addColorStop(0,"rgba(255,230,120,0.95)");
    sun.addColorStop(0.3,"rgba(255,150,50,0.75)");
    sun.addColorStop(1,"transparent");
    ctx.fillStyle = sun; ctx.fillRect(0,0,Wv,Hv);
  }
}

function drawWorld(ctx, s){
  ctx.clearRect(0,0,W,H);

  for(const p of s.platforms){
    const yy = p.y - s.camY + H/2;
    if (yy < -40 || yy > H+40) continue;
    const color = p.type==="base" ? "rgba(180,210,255,1.0)" : "rgba(160,190,255,0.9)";
    ctx.fillStyle = color;
    roundRect(ctx, p.x, yy, p.w, p.h, 8); ctx.fill();
    if(p.type!=="base"){ ctx.fillStyle = "rgba(80,140,255,0.25)"; roundRect(ctx, p.x, yy+12, p.w, 8, 6); ctx.fill(); }
  }

  const px = s.player.x, py = s.player.y - s.camY + H/2, ps = s.player.size;
  ctx.fillStyle = "rgba(120,200,255,.35)";
  roundRect(ctx, px-6, py-6, ps+12, ps+12, 8); ctx.fill();
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, px, py, ps, ps, 6); ctx.fill();

  if(s.input.spaceHeld || s.input.dragging){
    const held = s.input.spaceHeld ? (s.time - s.input.spaceStart) : (s.time - s.input.chargeStart);
    const t = clamp(held / CHARGE_MAX, 0, 1);
    drawRing(ctx, W/2, H-70, 34, t);
  }

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

