import React from "react";
import MissionsPanel from "./MissionsPanel";
import SkinPicker from "./SkinPicker";

export default function StartModal({ onStart, best, missions, selectedSkinId, onSelectSkin }){
  return (
    <div className="modal-wrap">
      <div className="modal">
        <h1 style={{marginTop:0, marginBottom:8}}>Space in-Finite</h1>
        <p className="tiny" style={{marginBottom:14}}>Hold to charge • Release to jump • ← / → (or swipe) to drift</p>
        <p style={{marginBottom:14}}>Best: <strong>{best} m</strong></p>
        <button className="btn" onClick={onStart}>Tap / Click to Start</button>
        <SkinPicker missions={missions} selectedId={selectedSkinId} onSelect={onSelectSkin}/>
        <MissionsPanel state={missions}/>
      </div>
    </div>
  );
}
