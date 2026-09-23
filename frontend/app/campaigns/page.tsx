"use client";

import Shell from "../../components/Shell";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type ListRow = { id: number; name: string };
type Campaign = {
  id: number;
  name: string;
  subject: string;
  status: string;
  list: { name: string };
  _count: { sends: number };
};
type Template = { id: number; name: string; html: string };

export default function CampaignsPage() {
  const [lists, setLists] = useState<ListRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [listId, setListId] = useState("");
  const [tplName, setTplName] = useState("");
  const [tplId, setTplId] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"code" | "preview">("code");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [progress, setProgress] = useState<{
    campaignId: number;
    campaignName: string;
    status: string;
    total: number;
    sent: number;
    failed: number;
    remaining: number;
    skipped?: number;
    currentEmail: string;
    delaySeconds: number;
    etaSeconds: number;
    lastError: string;
  } | null>(null);

  async function load() {
    setLists(await api<ListRow[]>("/lists"));
    setCampaigns(await api<Campaign[]>("/campaigns"));
    setTemplates(await api<Template[]>("/templates"));
  }
  useEffect(() => {
    load().catch((e) => setMsg(e.message));
    api<{ campaignId: number; campaignName: string; status: string; total: number; sent: number; failed: number; remaining: number; currentEmail: string; delaySeconds: number; etaSeconds: number; lastError: string }[]>("/campaigns/active")
      .then((jobs) => {
        if (jobs[0]) {
          setSendingId(jobs[0].campaignId);
          setProgress(jobs[0]);
        }
      })
      .catch(() => {});
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!htmlBody.trim()) {
      setMsg("Pehle HTML paste ya .html file upload karo.");
      return;
    }
    await api("/campaigns", {
      method: "POST",
      body: JSON.stringify({ name, subject, htmlBody, listId: Number(listId) }),
    });
    await load();
    setMsg("Campaign save ho gaya. Neeche Send dabao.");
  }

  async function saveTemplate() {
    if (!tplName.trim()) {
      setMsg("Template ka short name likho.");
      return;
    }
    if (!htmlBody.trim()) {
      setMsg("HTML box mein template paste karo.");
      return;
    }
    const payload = JSON.stringify({ name: tplName.trim(), html: htmlBody });
    if (tplId) {
      await api(`/templates/${tplId}`, { method: "PATCH", body: payload });
      setMsg("Template update ho gaya.");
    } else {
      const created = await api<Template>("/templates", { method: "POST", body: payload });
      setTplId(String(created.id));
      setMsg("Template save ho gaya.");
    }
    await load();
  }

  async function saveTemplateAsNew() {
    if (!tplName.trim() || !htmlBody.trim()) {
      setMsg("Name + HTML dono chahiye.");
      return;
    }
    const created = await api<Template>("/templates", {
      method: "POST",
      body: JSON.stringify({ name: tplName.trim(), html: htmlBody }),
    });
    setTplId(String(created.id));
    await load();
    setMsg("Naya template save.");
  }

  async function deleteTemplate() {
    if (!tplId) {
      setMsg("Pehle dropdown se template select karo.");
      return;
    }
    const t = templates.find((x) => String(x.id) === tplId);
    if (!confirm(`Delete template “${t?.name || tplId}”?`)) return;
    await api(`/templates/${tplId}`, { method: "DELETE" });
    setTplId("");
    setTplName("");
    setHtmlBody("");
    await load();
    setMsg("Template delete ho gaya.");
  }

  async function send(id: number) {
    if (!confirm("Har email ke beech 5 seconds rukenge. Send start karein?")) return;
    setMsg("Sending start… har mail ke baad 5s wait.");
    try {
      const started = await api<{
        campaignId: number;
        campaignName: string;
        status: string;
        total: number;
        sent: number;
        failed: number;
        remaining: number;
        currentEmail: string;
        delaySeconds: number;
        etaSeconds: number;
        lastError: string;
      }>(`/campaigns/${id}/send`, { method: "POST" });
      setSendingId(id);
      setProgress(started);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Send failed");
    }
  }

  async function cancelSend(id: number) {
    if (!confirm("Stop this campaign? Jo mail already gayi woh gayi, baaki nahi jayengi.")) return;
    try {
      await api(`/campaigns/${id}/cancel`, { method: "POST" });
      setMsg("Stop request bhej di.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  useEffect(() => {
    if (!sendingId) return;
    const t = setInterval(() => {
      api<NonNullable<typeof progress>>(`/campaigns/${sendingId}/progress`)
        .then((p) => {
          setProgress(p);
          if (p.status === "done" || p.status === "failed" || p.status === "cancelled") {
            setMsg(
              p.status === "cancelled"
                ? `Stopped. Sent ${p.sent}, remaining ${p.remaining}.`
                : p.status === "done"
                  ? `Khatam. Sent ${p.sent}, failed ${p.failed}.`
                  : `Ruk gayi: ${p.lastError || "failed"}`,
            );
            setSendingId(null);
            load().catch(() => {});
          }
        })
        .catch(() => {});
    }, 800);
    return () => clearInterval(t);
  }, [sendingId]);

  const previewHtml = useMemo(() => htmlBody.replace(/\{\{name\}\}/g, "Ayesha"), [htmlBody]);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Compose</h1>
          <p className="muted">Teen simple steps. HTML name box mein nahi — HTML sirf bade box mein.</p>
        </div>
      </div>
      {msg ? <p className="ok">{msg}</p> : null}

      {progress && progress.total > 0 ? (
        <div className="card quota-card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 6px" }}>
            {progress.status === "sending" ? "Sending" : progress.status} {progress.campaignName || "campaign"}
          </h3>
          <p className="muted" style={{ margin: 0 }}>
            {progress.sent} sent · {progress.failed} failed · {progress.remaining} remaining
            {progress.skipped ? ` · ${progress.skipped} already mailed (skipped)` : ""}
            {progress.currentEmail ? ` · now: ${progress.currentEmail}` : ""}
          </p>
          <div className="progress-track" style={{ marginTop: 14 }}>
            <div
              className="progress-fill"
              style={{
                width: `${progress.total ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="muted" style={{ margin: "8px 0 0", fontFamily: "Segoe UI, sans-serif", fontSize: 13 }}>
            Har mail ke baad {progress.delaySeconds}s wait. ETA ~{Math.ceil((progress.etaSeconds || 0) / 60)} min.
            {progress.lastError ? ` Last error: ${progress.lastError}` : ""}
          </p>
          {progress.status === "sending" && sendingId ? (
            <button className="secondary sm" type="button" style={{ marginTop: 12 }} onClick={() => cancelSend(sendingId)}>
              Stop / cancel
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="card step-card">
        <div className="step-num">1</div>
        <div>
          <h3>HTML template lo</h3>
          <p className="muted">File upload karo, ya pehle se saved template load karo, ya step 2 mein paste karo.</p>
          <div className="grid two" style={{ marginTop: 12 }}>
            <label className="field">
              <span>Saved templates</span>
              <select
                value={tplId}
                onChange={(e) => {
                  const id = e.target.value;
                  setTplId(id);
                  const t = templates.find((x) => String(x.id) === id);
                  if (t) {
                    setHtmlBody(t.html);
                    setTplName(t.name);
                    setTab("preview");
                    setMsg(`Loaded “${t.name}”. Edit HTML, then Update — ya Delete.`);
                  }
                }}
              >
                <option value="">Select a saved template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Upload .html file</span>
              <input
                type="file"
                accept=".html,.htm,text/html"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setHtmlBody(await f.text());
                  setTab("preview");
                  setMsg("HTML file load ho gayi. Preview check karo.");
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="card step-card">
        <div className="step-num">2</div>
        <div style={{ minWidth: 0 }}>
          <h3>HTML yahan hai</h3>
          <p className="muted">Poora email yahan paste karo. Code = edit. Preview = Gmail jaisa nazar.</p>
          <div className="row" style={{ margin: "12px 0" }}>
            <button type="button" className={tab === "code" ? "accent sm" : "secondary sm"} onClick={() => setTab("code")}>
              Edit HTML
            </button>
            <button type="button" className={tab === "preview" ? "accent sm" : "secondary sm"} onClick={() => setTab("preview")}>
              Preview
            </button>
          </div>
          {tab === "code" ? (
            <textarea
              className="html-editor"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder={"<!DOCTYPE html>\n<html>\n...paste full email here...\n</html>"}
            />
          ) : htmlBody.trim() ? (
            <iframe title="preview" className="html-preview" srcDoc={previewHtml} />
          ) : (
            <div className="empty">Abhi HTML nahi. Upload, load, ya paste karo.</div>
          )}
          <div className="grid two" style={{ marginTop: 14 }}>
            <label className="field">
              <span>Save this HTML for later — short name only</span>
              <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. STUS supplier email" />
            </label>
            <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="accent" onClick={saveTemplate}>
                {tplId ? "Update template" : "Save new template"}
              </button>
              {tplId ? (
                <>
                  <button type="button" className="secondary" onClick={saveTemplateAsNew}>
                    Save as new
                  </button>
                  <button type="button" className="secondary" onClick={deleteTemplate}>
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <form className="card step-card" onSubmit={create}>
        <div className="step-num">3</div>
        <div style={{ width: "100%" }}>
          <h3>Campaign details + send</h3>
          <div className="grid two" style={{ marginTop: 12 }}>
            <label className="field">
              <span>Campaign name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="April STUS blast" />
            </label>
            <label className="field">
              <span>Send to which list?</span>
              <select value={listId} onChange={(e) => setListId(e.target.value)} required>
                <option value="">Choose audience list</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Email subject (inbox mein yeh dikhega)</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </label>
          <button className="accent" type="submit" style={{ marginTop: 16 }}>
            Save campaign
          </button>
        </div>
      </form>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 12px" }}>Saved campaigns — yahan se Send</h3>
        {campaigns.length === 0 ? (
          <div className="empty">Abhi koi campaign save nahi.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>List</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.subject}</td>
                  <td>{c.list.name}</td>
                  <td>
                    <span className={`badge ${c.status}`}>{c.status}</span>
                    {c._count?.sends ? (
                      <span className="muted" style={{ marginLeft: 8 }}>
                        {c._count.sends} emails logged
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <button className="accent sm" onClick={() => send(c.id)} disabled={sendingId === c.id || c.status === "sending"}>
                      {sendingId === c.id || c.status === "sending" ? "Sending…" : "Send now"}
                    </button>
                    {(sendingId === c.id || c.status === "sending") ? (
                      <button className="secondary sm" style={{ marginLeft: 8 }} onClick={() => cancelSend(c.id)}>
                        Stop
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
