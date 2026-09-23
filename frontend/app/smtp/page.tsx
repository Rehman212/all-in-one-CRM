"use client";

import Shell from "../../components/Shell";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";

type Smtp = {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
};

export default function SmtpPage() {
  const [form, setForm] = useState<Smtp>({
    host: "ap-south-1",
    port: 587,
    username: "",
    password: "",
    fromEmail: "hello@socialvelocityy.com",
    fromName: "Social Velocityy",
  });
  const [to, setTo] = useState("rehmanwebs1@gmail.com");
  const [msg, setMsg] = useState("");
  const [imap, setImap] = useState({
    imapHost: "imap.hostinger.com",
    imapPort: 993,
    imapUser: "hello@socialvelocityy.com",
    imapPassword: "",
  });

  useEffect(() => {
    api<Smtp>("/smtp")
      .then((s) => {
        if (!s) return;
        setForm({
          host: "ap-south-1",
          port: 587,
          username: "",
          password: "",
          fromEmail: s.fromEmail,
          fromName: s.fromName,
        });
      })
      .catch((e) => setMsg(e.message));
    api<{ imapHost: string; imapPort: number; imapUser: string }>("/inbox/status")
      .then((s) =>
        setImap((prev) => ({
          ...prev,
          imapHost: s.imapHost,
          imapPort: s.imapPort,
          imapUser: s.imapUser,
        })),
      )
      .catch(() => {});
  }, []);

  function set<K extends keyof Smtp>(key: K, value: Smtp[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveAndTest(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/smtp", { method: "POST", body: JSON.stringify(form) });
      await api("/smtp/test", { method: "POST", body: JSON.stringify({ to }) });
      setMsg("Test email Amazon ne accept kar li. Gmail Inbox/Spam check karo.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Deliverability</h1>
          <p className="muted">SMTP nahi. IAM Access Key + Secret se SES API — region Mumbai.</p>
        </div>
      </div>
      {msg ? <p className={msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("denied") ? "err" : "ok"}>{msg}</p> : null}
      <form className="card grid" onSubmit={saveAndTest} style={{ maxWidth: 640, gap: 14 }}>
        <label className="field">
          <span>AWS Access Key ID (AKIA…)</span>
          <input value={form.username} onChange={(e) => set("username", e.target.value)} required placeholder="IAM → Security credentials → Access key" />
        </label>
        <label className="field">
          <span>AWS Secret Access Key</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
            placeholder="SMTP password mat dalo. Secret Access Key dalo."
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>From email</span>
          <input value={form.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} required />
        </label>
        <label className="field">
          <span>Test Gmail</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <button className="accent" type="submit">
          Save keys and send test
        </button>
      </form>

      <form
        className="card grid"
        style={{ maxWidth: 640, gap: 14, marginTop: 20 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg("");
          try {
            await api("/inbox/imap", { method: "POST", body: JSON.stringify(imap) });
            setMsg("IMAP save. Inbox page pe Refresh from Hostinger dabao.");
          } catch (err) {
            setMsg(err instanceof Error ? err.message : "IMAP save fail");
          }
        }}
      >
        <h3 style={{ margin: 0 }}>Inbox (replies yahan dikhengi)</h3>
        <p className="muted" style={{ margin: 0 }}>
          Yeh Hostinger mailbox hai, AWS nahi. Jo log campaign pe Reply karein, mail hello@ pe aati hai — app IMAP se wahan se uthati hai.
        </p>
        <label className="field">
          <span>IMAP host</span>
          <input value={imap.imapHost} onChange={(e) => setImap((s) => ({ ...s, imapHost: e.target.value }))} />
        </label>
        <label className="field">
          <span>Mailbox email</span>
          <input value={imap.imapUser} onChange={(e) => setImap((s) => ({ ...s, imapUser: e.target.value }))} required />
        </label>
        <label className="field">
          <span>Mailbox password (Hostinger email password)</span>
          <input
            type="password"
            value={imap.imapPassword}
            onChange={(e) => setImap((s) => ({ ...s, imapPassword: e.target.value }))}
            placeholder="AWS secret nahi — hello@ ka password"
            autoComplete="new-password"
          />
        </label>
        <button className="secondary" type="submit">
          Save IMAP
        </button>
      </form>
    </Shell>
  );
}
