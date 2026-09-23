"use client";

import Shell from "../../components/Shell";
import { FormEvent, useEffect, useState } from "react";
import { parseAudienceCsv } from "../../lib/csv";
import { api } from "../../lib/api";

type ListRow = { id: number; name: string; _count: { contacts: number } };
type Contact = { id: number; email: string; name: string; unsubscribed?: boolean };
type CheckRow = Contact & { status: "ok" | "fixed" | "removed"; reason: string };

export default function ListsPage() {
  const [lists, setLists] = useState<ListRow[]>([]);
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [email, setEmail] = useState("");
  const [cname, setCname] = useState("");
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState("");
  const [checks, setChecks] = useState<CheckRow[] | null>(null);

  const [busy, setBusy] = useState(false);

  async function load() {
    setLists(await api<ListRow[]>("/lists"));
  }
  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, []);

  async function createAndImport(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const rows = parseAudienceCsv(csv);
    if (!rows.length) {
      setMsg("CSV choose karo. File Name,Email columns wali honi chahiye.");
      return;
    }
    setBusy(true);
    try {
      const list = await api<ListRow>("/lists", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() || "Imported list" }),
      });
      const res = await api<{ added: number; skipped: number }>(`/lists/${list.id}/contacts/import`, {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      setMsg(`List ready. Imported ${res.added}, skipped ${res.skipped}`);
      setName("");
      setCsv("");
      await load();
      await openList(list.id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function createList(e: FormEvent) {
    e.preventDefault();
    await api("/lists", { method: "POST", body: JSON.stringify({ name }) });
    setName("");
    await load();
  }

  async function openList(id: number) {
    setOpenId(id);
    setChecks(null);
    setContacts(await api<Contact[]>(`/lists/${id}/contacts`));
  }

  async function addContact(e: FormEvent) {
    e.preventDefault();
    if (!openId) return;
    await api(`/lists/${openId}/contacts`, {
      method: "POST",
      body: JSON.stringify({ email, name: cname }),
    });
    setEmail("");
    setCname("");
    await openList(openId);
    await load();
  }

  async function importCsv(e: FormEvent) {
    e.preventDefault();
    if (!openId) return;
    const rows = parseAudienceCsv(csv);
    if (!rows.length) {
      setMsg("CSV se koi valid email nahi mili. Header Name,Email check karo.");
      return;
    }
    const res = await api<{ added: number; skipped: number }>(`/lists/${openId}/contacts/import`, {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
    setMsg(`Imported ${res.added}, skipped ${res.skipped}`);
    setCsv("");
    await openList(openId);
    await load();
  }

  async function runCheck() {
    if (!openId) return;
    setBusy(true);
    setMsg("Checking syntax + mail servers…");
    try {
      const res = await api<{ ok: number; fixed: number; removed: number; results: CheckRow[] }>(
        `/lists/${openId}/contacts/check`,
        { method: "POST" },
      );
      setChecks(res.results);
      setContacts(await api<Contact[]>(`/lists/${openId}/contacts`));
      await load();
      setMsg(`Auto-clean: ${res.ok} ok · ${res.fixed} fixed · ${res.removed} removed. MX ok still does not prove inbox exists.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeFlagged() {
    if (!openId || !checks) return;
    const ids = checks.filter((c) => c.status === "bad").map((c) => c.id);
    if (!ids.length) {
      setMsg("Koi bad email nahi.");
      return;
    }
    if (!confirm(`Remove ${ids.length} bad emails from this list?`)) return;
    const res = await api<{ removed: number }>(`/lists/${openId}/contacts/remove-bad`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
    setMsg(`${res.removed} removed.`);
    await openList(openId);
    await load();
    setChecks(null);
  }

  const openName = lists.find((l) => l.id === openId)?.name;

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Audience</h1>
          <p className="muted">CSV file Choose karke 400 contacts ek dafa import karo. One-by-one zaroori nahi.</p>
        </div>
      </div>
      {msg ? <p className="ok">{msg}</p> : null}
      <form className="card grid" onSubmit={createAndImport} style={{ gap: 12, marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>Import CSV (400+ contacts)</h3>
        <label className="field">
          <span>List name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Clients 2026" required />
        </label>
        <label className="field">
          <span>CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv,.txt"
            required
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setCsv(await file.text());
            }}
          />
        </label>
        <button className="accent" type="submit" disabled={busy}>
          {busy ? "Importing…" : "Create list and import file"}
        </button>
      </form>
      <div className="grid two">
        <div className="card">
          <form className="row" onSubmit={createList} style={{ marginBottom: 18 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="List name, e.g. Warm leads" required />
            <button type="submit">Create</button>
          </form>
          {lists.length === 0 ? (
            <div className="empty">
              <strong>No lists yet</strong>
              Create “Newsletter” or “Clients” to start adding people.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>List</th>
                  <th>Size</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lists.map((l) => (
                  <tr key={l.id} style={{ background: openId === l.id ? "#f6efe4" : undefined }}>
                    <td>{l.name}</td>
                    <td>{l._count.contacts}</td>
                    <td>
                      <button className="secondary sm" onClick={() => openList(l.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          {openId ? (
            <>
              <div className="toolbar">
                <h3 style={{ margin: 0 }}>{openName}</h3>
                <div className="row">
                  <span className="badge">{contacts.length} contacts</span>
                  <button className="sm" type="button" onClick={runCheck} disabled={busy}>
                    {busy ? "Checking…" : "Check emails"}
                  </button>
                </div>
              </div>
              <form className="grid two" onSubmit={addContact} style={{ marginBottom: 14 }}>
                <label className="field">
                  <span>Email</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <label className="field">
                  <span>Name</span>
                  <input value={cname} onChange={(e) => setCname(e.target.value)} />
                </label>
                <button type="submit">Add contact</button>
              </form>
              <form onSubmit={importCsv}>
                <label className="field">
                  <span>CSV file (Name + Email) — 400+ rows theek hain</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setCsv(await file.text());
                    }}
                  />
                </label>
                <p className="muted" style={{ margin: "8px 0" }}>
                  Header ho to Name,Email. Order ulta ho to bhi chalega.
                </p>
                <label className="field">
                  <span>Ya CSV yahan paste</span>
                  <textarea rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"Name,Email\nAli,ali@brand.com"} />
                </label>
                <button className="accent" type="submit" style={{ marginTop: 10 }}>
                  Import all
                </button>
              </form>
              {contacts.length > 0 ? (
                <table style={{ marginTop: 16 }}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => {
                      const hit = checks?.find((x) => x.id === c.id);
                      return (
                        <tr key={c.id}>
                          <td>{c.email}</td>
                          <td>
                            {c.name || "—"}{" "}
                            {c.unsubscribed ? <span className="badge draft">bounced</span> : null}
                          </td>
                          <td>
                            {hit ? (
                              <span className={`badge ${hit.status === "ok" ? "sent" : hit.status === "removed" ? "draft" : ""}`}>
                                {hit.status}: {hit.reason}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
            </>
          ) : (
            <div className="empty">
              <strong>Select a list</strong>
              Open a list on the left to add or import subscribers.
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
