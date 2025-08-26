import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const Ctx = createContext(null);
export const useSfx = () => useContext(Ctx);

const PATHS = {
  jump: "/sfx/jump.mp3",
  land: "/sfx/land.mp3",
  perfect: "/sfx/perfect.mp3",
  fail: "/sfx/fail.mp3",
  btn: "/sfx/btn.mp3",
  bgm: "/sfx/bgm.mp3",
};
const loadSafe = (path, { loop=false, vol=0.7 }={}) => {
  const a = new Audio(path);
  a.preload = "auto"; a.loop = loop; a.volume = vol;
  a.onerror = () => { a.__missing = true; };
  return a;
};

export function SfxProvider({ children }) {
  const cache = useRef({});
  const bgmRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const unlockedRef = useRef(false);

  useEffect(()=>{
    cache.current = {
      jump: loadSafe(PATHS.jump),
      land: loadSafe(PATHS.land),
      perfect: loadSafe(PATHS.perfect),
      fail: loadSafe(PATHS.fail),
      btn: loadSafe(PATHS.btn),
    };
    bgmRef.current = loadSafe(PATHS.bgm, { loop: true, vol: 0.35 });
  },[]);

  // unlock after first user gesture
  useEffect(()=>{
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      const all = Object.values(cache.current);
      if (bgmRef.current) all.push(bgmRef.current);
      all.forEach(a=>{
        try{ a.muted = true; a.play().then(()=>{ a.pause(); a.currentTime=0; a.muted=false; }).catch(()=>{}); }catch{}
      });
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    return ()=>{
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  },[]);

  const play = (name) => {
    if (muted) return;
    const a = cache.current[name];
    if (!a || a.__missing) return;
    try { a.currentTime = 0; a.play().catch(()=>{}); } catch {}
  };
  const playMusic = ()=> {
    const m = bgmRef.current; if (!m || m.__missing || muted || !musicOn) return;
    try { if (m.paused) m.play().catch(()=>{}); } catch {}
  };
  const stopMusic = ()=> { const m = bgmRef.current; if (!m) return; try{ m.pause(); }catch{} };

  useEffect(()=>{ if (muted || !musicOn) stopMusic(); }, [muted, musicOn]);

  const value = useMemo(()=>({ play, playMusic, stopMusic, muted, setMuted, musicOn, setMusicOn }), [muted, musicOn]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
