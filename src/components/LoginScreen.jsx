import React, { useState } from "react";

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !age) return;
    onLogin(name, age);
  };

  return (
    <div className="login-screen">
      <form className="login-box" onSubmit={handleSubmit}>
        <h2>🚀 Enter Space</h2>
        <input
          type="text"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Your Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          required
        />
        <button type="submit">Continue</button>
      </form>
    </div>
  );
}
