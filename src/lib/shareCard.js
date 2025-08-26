export async function generateShareCard({ score, best, combo, skinName }) {
  const w = 800, h = 418;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0,0,w,h);
  g.addColorStop(0,"#0b1430"); g.addColorStop(1,"#001018");
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

  ctx.fillStyle = "rgba(255,255,255,.7)";
  for(let i=0;i<120;i++) ctx.fillRect(Math.random()*w, Math.random()*h, Math.random()<0.85?1:2, Math.random()<0.9?1:2);

  ctx.fillStyle = "#b7f4ff"; ctx.font = "bold 28px Inter, system-ui";
  ctx.fillText("Space in-Finite", 26, 44);

  ctx.fillStyle = "#eaffff"; ctx.font = "bold 72px Inter, system-ui";
  ctx.fillText(`${score} m`, 26, 130);

  ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "20px Inter, system-ui";
  ctx.fillText(`Best: ${best} m`, 28, 170);
  ctx.fillText(`Best Combo Mult: x${(1 + (combo||0)*0.5).toFixed(1)}`, 28, 198);

  ctx.fillStyle = "rgba(255,255,255,.2)";
  round(ctx, w-220, 24, 196, 44, 14); ctx.fill();
  ctx.fillStyle = "#eaffff"; ctx.font = "16px Inter, system-ui";
  ctx.fillText(`Skin: ${skinName}`, w-206, 52);

  ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = "14px Inter, system-ui";
  ctx.fillText("Play again and climb higher!", 26, h-28);

  return c.toDataURL("image/png");

  function round(ctx,x,y,w,h,r){
    const rr = Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y); ctx.lineTo(x+w-rr,y); ctx.quadraticCurveTo(x+w,y,x+w,y+rr);
    ctx.lineTo(x+w,y+h-rr); ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
    ctx.lineTo(x+rr,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-rr);
    ctx.lineTo(x,y+rr); ctx.quadraticCurveTo(x,y,x+rr,y); ctx.closePath();
  }
}
