"use client";

import Shell from "../../components/Shell";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type Msg = {
  id: number;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  receivedAt: string;
  seen: boolean;
};

function isSent(m: Msg) {
  return m.fromName === "You";
}

function preview(m: Msg) {
  const t = (m.textBody || m.htmlBody.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return t.slice(0, 88) || "No preview";
}

function initials(m: Msg) {
  const src = (m.fromName || m.fromEmail || "?").trim();
  const parts = src.split(/[\s@]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

function hue(email: string) {
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 32% 32%)`;
}

function when(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  return same
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function InboxPage() {
  const [rows, setRows] = useState<Msg[]>([]);
  const [open, setOpen] = useState<Msg | null>(null);
  const [reply, setReply] = useState("");
  const [msg, setMsg] = useState("");
  const [configured, setConfigured] = useState(true);
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox");
  const [busy, setBusy] = useState(false);

  async function loadList() {
    const status = await api<{ imapConfigured: boolean }>("/inbox/status");
    setConfigured(status.imapConfigured);
    setRows(await api<Msg[]>("/inbox"));
  }

  async function sync() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ imported: number; total: number }>("/inbox/sync", { method: "POST" });
      await loadList();
      setMsg(r.imported ? `${r.imported} new messages` : "Up to date");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadList().catch((e) => setMsg(e.message));
  }, []);

  useEffect(() => {
    if (!configured) return;
    const t = setInterval(() => {
      loadList().catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [configured]);

  const inboxRows = useMemo(() => rows.filter((r) => !isSent(r)), [rows]);
  const sentRows = useMemo(() => rows.filter(isSent), [rows]);
  const visible = folder === "sent" ? sentRows : inboxRows;
  const unread = useMemo(() => inboxRows.filter((r) => !r.seen).length, [inboxRows]);

  async function openMsg(id: number) {
    const full = await api<Msg>(`/inbox/${id}`);
    setOpen(full);
    setReply("");
    setRows((list) => list.map((r) => (r.id === id ? { ...r, seen: true } : r)));
  }

  async function deleteMsg(id: number) {
    if (!confirm("Is mail ko app inbox se hataein?")) return;
    await api(`/inbox/${id}`, { method: "DELETE" });
    if (open?.id === id) setOpen(null);
    setRows((list) => list.filter((r) => r.id !== id));
    setMsg("Deleted from this inbox (Hostinger mailbox mein reh sakti hai).");
  }

  async function sendReply() {
    if (!open || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ to: string; subject: string }>(`/inbox/${open.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ body: reply.trim() }),
      });
      setReply("");
      await loadList();
      setFolder("sent");
      setMsg(`Sent to ${res.to}. Copy is in Sent — Inbox alag hai.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="mail-app">
        <aside className="mail-list">
          <div className="mail-list-head">
            <div className="mail-seg">
              <button type="button" className={folder === "inbox" ? "on" : ""} onClick={() => { setFolder("inbox"); setOpen(null); }}>
                Inbox{unread ? ` · ${unread}` : ""}
              </button>
              <button type="button" className={folder === "sent" ? "on" : ""} onClick={() => { setFolder("sent"); setOpen(null); }}>
                Sent
              </button>
            </div>
            <div className="mail-list-tools">
              <span>
                {folder === "sent" ? `${sentRows.length} sent` : `${inboxRows.length} messages`}
              </span>
              <button className="sm" type="button" onClick={sync} disabled={busy}>
                {busy ? "Syncing…" : "Sync"}
              </button>
            </div>
          </div>
          {msg ? (
            <p className="muted" style={{ margin: 0, padding: "8px 16px", fontSize: 12 }}>
              {msg}
            </p>
          ) : null}
          {!configured ? (
            <div className="mail-empty">
              Save Hostinger IMAP on Deliverability, then Sync.
            </div>
          ) : visible.length === 0 ? (
            <div className="mail-empty">{folder === "sent" ? "No sent mail yet." : "No incoming mail yet."}</div>
          ) : (
            visible.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`inbox-row${open?.id === m.id ? " active" : ""}${m.seen ? "" : " unread"}`}
                onClick={() => openMsg(m.id)}
              >
                <span className="ir-dot" />
                <div style={{ minWidth: 0 }}>
                  <div className="ir-name">{folder === "sent" ? m.toEmail || "Recipient" : m.fromName || m.fromEmail}</div>
                  <div className="ir-sub">{m.subject}</div>
                  <div className="ir-prev">{preview(m)}</div>
                </div>
                <div className="ir-time">{when(m.receivedAt)}</div>
              </button>
            ))
          )}
        </aside>
        <section className="mail-read">
          {!open ? (
            <div className="mail-empty">
              <div className="mail-mark">✉</div>
              <strong>Select a message</strong>
              Incoming mail stays in Inbox. Replies you send live in Sent.
            </div>
          ) : (
            <>
              <div className="mail-read-head">
                <h2>{open.subject}</h2>
                <div className="mail-meta">
                  <div className="avatar" style={{ background: hue(open.fromEmail), width: 32, height: 32, fontSize: 11 }}>
                    {initials(open)}
                  </div>
                  <div>
                    <div style={{ color: "#111827", fontWeight: 600 }}>
                      {open.fromName || open.fromEmail}
                    </div>
                    <div>
                      {isSent(open)
                        ? `To ${open.toEmail} · ${new Date(open.receivedAt).toLocaleString()}`
                        : `${open.fromEmail} · ${new Date(open.receivedAt).toLocaleString()}`}
                    </div>
                  </div>
                  <button className="secondary sm" type="button" style={{ marginLeft: "auto" }} onClick={() => deleteMsg(open.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <div className="mail-body">
                <div className="mail-sheet">
                {open.htmlBody ? (
                  <iframe title="mail" srcDoc={open.htmlBody} />
                ) : (
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Inter, sans-serif", margin: 0, lineHeight: 1.6 }}>{open.textBody}</pre>
                )}
                </div>
              </div>
              {!isSent(open) ? (
              <div className="mail-reply">
                <label className="field">
                  <span>Reply via SES</span>
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${open.fromEmail}`} />
                </label>
                <button className="accent sm" type="button" style={{ marginTop: 10 }} onClick={sendReply} disabled={busy}>
                  Send reply
                </button>
              </div>
              ) : (
                <div className="mail-reply">
                  <p className="muted" style={{ margin: 0 }}>This is a sent copy. Inbox is the other tab.</p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}
