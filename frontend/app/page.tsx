"use client";

import { FormEvent, useState } from "react";
import { api } from "../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("hello@socialvelocityy.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("sv_token", res.token);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">S</div>
          <div>
            <h2 style={{ color: "#1a1f2c" }}>Social Velocityy</h2>
            <small>Private mail studio</small>
          </div>
        </div>
        <p className="muted">Sign in to send campaigns through Amazon SES.</p>
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <div className="err">{error}</div> : null}
        <button className="accent" type="submit">
          Enter workspace
        </button>
      </form>
    </div>
  );
}
