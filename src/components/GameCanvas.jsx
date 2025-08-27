import React, { useEffect, useRef } from "react";

/* ---- fixed canvas (no camera) ---- */
const W = 480, H = 800;

/* ---- physics & controls ---- */
const GRAV = 1850;
const JUMP_MIN = 560, JUMP_MAX = 1300;
const CHARGE_MIN = 0.18, CHARGE_MAX = 1.20;
const PLAYER = { size: 28, airDrift: 300 };
const GROUND_Y = 740;                 // top of base
const COYOTE = 0.16;                  // 160ms grace
const AIR_DAMP = 0.995;
const NEAR_GROUND_TOL = 1.25;         // treat within ~1px as grounded

export default function GameCanvas({ running, onProgress }) {
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const rafRef = useRef(0);
  const st = useRef(null);

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
    st.current = createWorld();
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

      const peakMeters = Math.max(0, Math.round((s.startY - s.peakY) / 10));
      onProgress?.(peakMeters);
      const hud = document.getElementById("hud-score");
      if (hud) hud.innerHTML = `Height: <strong>${peakMeters} m</strong>`;
    };

    st.current.last = performance.now() / 1000;
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, onProgress]);

  /* ---------- inputs: drag+release & Space; arrows steer ---------- */
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

      // queue the jump; physics will consume as soon as allowed
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
    input: {
      left:0, right:0,
      spaceHeld:false, spaceStart:0,
      dragging:false, chargeStart:0, dx:0, dy:0,
      wantJump: undefined,          // { power, dirX, at }
    },
    platforms: [],
    startY: 0,
  };

  // base
  s.platforms.push({ x:0, y:GROUND_Y, w:W, h:22, type:"base" });

  // player on base
  s.player.y = GROUND_Y - s.player.size;
  s.player.vx = 0; s.player.vy = 0; s.player.onGround = true;
  s.lastGroundedAt = 0;

  // a few initial platforms
  let y = GROUND_Y - 130;
  for(let i=0;i<6;i++){
    const w = i<2 ? 120 : Math.max(70, 120 - i*10);
    const x = 40 + Math.random()*(W - 80 - w);
    s.platforms.push({ x, y, w, h:14, type:"plat", move: Math.random()<0.25 ? (40+Math.random()*70) : 0, phase: Math.random()*6 });
    y -= 120;
  }

  s.startY = s.player.y;
  s.peakY  = s.player.y;
  return s;
}

function performJump(s, powerNorm, dirX=0){
  const nearGround = (s.player.y + s.player.size) >= (GROUND_Y - NEAR_GROUND_TOL);
  const canJump = s.player.onGround || nearGround || (s.time - s.lastGroundedAt <= COYOTE);
  if(!canJump) return false;

  // tiny nudge above base to avoid instant re-clamp
  if(nearGround) s.player.y = GROUND_Y - s.player.size - 0.5;

  const p = clamp((powerNorm - CHARGE_MIN)/(CHARGE_MAX - CHARGE_MIN), 0, 1);
  s.player.vy = -lerp(JUMP_MIN, JUMP_MAX, p);
  s.player.vx = clamp(dirX, -1, 1) * 380;
  s.player.onGround = false;

  s.input.wantJump = undefined;
  return true;
}

function updateWorld(s, dt){
  // 1) consume queued jump ASAP (no tiny time window—keep until grounded)
  if(s.input.wantJump){
    const ok = performJump(s, s.input.wantJump.power, s.input.wantJump.dirX);
    if(!ok && (s.time - s.input.wantJump.at) > 0.7){ // give up after 0.7s
      s.input.wantJump = undefined;
    }
  }

  // 2) move platforms
  for(const p of s.platforms){
    if(p.move){
      p.phase += dt;
      p.x += Math.sin(p.phase) * p.move * dt * 0.8;
      p.x = Math.max(12, Math.min(W - p.w - 12, p.x));
    }
  }

  // 3) air/ground steering for the square
  const drift = (s.input.right - s.input.left);
  const targetVx = drift * PLAYER.airDrift;
  if(!s.player.onGround){
    s.player.vx += (targetVx - s.player.vx) * 0.12;
    s.player.vx *= AIR_DAMP;
  }else{
    s.player.vx += (targetVx - s.player.vx) * 0.18;
  }

  // 4) integrate
  const prevY = s.player.y;
  s.player.vy += GRAV * dt;
  s.player.x  += s.player.vx * dt;
  s.player.y  += s.player.vy * dt;
  s.player.x   = Math.max(0, Math.min(W - s.player.size, s.player.x));

  // 5) collisions (falling)
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
        s.player.onGround = true;
        s.lastGroundedAt = s.time;
        break;
      }
    }
  }else{
    if(s.player.onGround) s.lastGroundedAt = s.time;
    s.player.onGround = false;
  }

  // 6) clamp to base
  const ps = s.player.size;
  if(s.player.y + ps > GROUND_Y){
    s.player.y = GROUND_Y - ps;
    s.player.vy = 0;
    s.player.onGround = true;
    s.lastGroundedAt = s.time;
  }

  // 7) peak for HUD
  s.peakY = Math.min(s.peakY, s.player.y);
}

/* ================== drawing ================== */

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

  // platforms
  for(const p of s.platforms){
    const color = p.type==="base" ? "rgba(180,210,255,1.0)" : "rgba(160,190,255,0.9)";
    ctx.fillStyle = color;
    roundRect(ctx, p.x, p.y, p.w, p.h, 8); ctx.fill();
    if(p.type!=="base"){
      ctx.fillStyle = "rgba(80,140,255,0.25)";
      roundRect(ctx, p.x, p.y+12, p.w, 8, 6); ctx.fill();
    }
  }

  // player
  const { x:px, y:py, size:ps } = s.player;
  ctx.fillStyle = "rgba(120,200,255,.35)";
  roundRect(ctx, px-6, py-6, ps+12, ps+12, 8); ctx.fill();
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, px, py, ps, ps, 6); ctx.fill();

  // charge ring while charging
  if(s.input.spaceHeld || s.input.dragging){
    const held = s.input.spaceHeld ? (s.time - s.input.spaceStart) : (s.time - s.input.chargeStart);
    const t = clamp(held / CHARGE_MAX, 0, 1);
    drawRing(ctx, W/2, H-70, 34, t);
  }

  // height label
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
