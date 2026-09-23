"use client";

import Shell from "../../components/Shell";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Campaign = { id: number; name: string; status: string; subject: string };
type Quota = {
  region: string;
  max24HourSend: number;
  sentLast24Hours: number;
  remaining24Hours: number;
  maxSendRate: number;
  estimatedMonthlyLimit: number;
  usedPercent24h: number;
  stats2Weeks: { attempts: number; bounces: number; complaints: number; rejects: number };
};

function n(v?: number) {
  return (v ?? 0).toLocaleString("en-US");
}

export default function DashboardPage() {
  const [lists, setLists] = useState(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaErr, setQuotaErr] = useState("");

  useEffect(() => {
    api<{ id: number }[]>("/lists")
      .then((d) => setLists(d.length))
      .catch(() => {});
    api<Campaign[]>("/campaigns").then(setCampaigns).catch(() => {});
    api<Quota>("/smtp/quota")
      .then(setQuota)
      .catch((e) => setQuotaErr(e instanceof Error ? e.message : "Quota load fail"));
  }, []);

  const sent = campaigns.filter((c) => c.status === "sent" || c.status === "partial").length;
  const used = Math.min(100, quota?.usedPercent24h ?? 0);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Good morning.</h1>
          <p className="muted">Amazon SES official limits — live from AWS Mumbai (ap-south-1).</p>
        </div>
        <Link href="/campaigns" className="btn accent">
          New campaign
        </Link>
      </div>

      <div className="card quota-card">
        <div className="toolbar">
          <div>
            <h3 style={{ margin: 0 }}>SES sending capacity</h3>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              AWS monthly number nahi deta — official quota 24 hours ki hoti hai. Monthly = 24h limit × 30.
            </p>
          </div>
          <span className="tag">{quota?.region || "ap-south-1"}</span>
        </div>
        {quotaErr ? <p className="err">{quotaErr}</p> : null}
        <div className="grid stats" style={{ marginTop: 16 }}>
          <div className="stat">
            <p className="muted">Official 24h limit</p>
            <b>{quota ? n(quota.max24HourSend) : "—"}</b>
            <span className="tag">GetSendQuota</span>
          </div>
          <div className="stat">
            <p className="muted">Est. monthly capacity</p>
            <b>{quota ? n(quota.estimatedMonthlyLimit) : "—"}</b>
            <span className="tag">24h × 30 days</span>
          </div>
          <div className="stat">
            <p className="muted">Sent last 24 hours</p>
            <b>{quota ? n(quota.sentLast24Hours) : "—"}</b>
            <span className="tag">{quota ? `${n(quota.remaining24Hours)} remaining` : "AWS live"}</span>
          </div>
          <div className="stat">
            <p className="muted">Max send rate</p>
            <b>{quota ? quota.maxSendRate : "—"}</b>
            <span className="tag">emails / second</span>
          </div>
        </div>
        <div className="progress-track" style={{ marginTop: 18 }}>
          <div className="progress-fill" style={{ width: `${used}%` }} />
        </div>
        <p className="muted" style={{ margin: "8px 0 0", fontFamily: "Segoe UI, sans-serif", fontSize: 13 }}>
          24h used {quota ? `${quota.usedPercent24h}%` : "—"}. Last 2 weeks: {quota ? n(quota.stats2Weeks.attempts) : "—"} attempts ·{" "}
          {quota ? n(quota.stats2Weeks.bounces) : "—"} bounces · {quota ? n(quota.stats2Weeks.complaints) : "—"} complaints
        </p>
      </div>

      <div className="grid stats" style={{ marginTop: 16 }}>
        <div className="card stat">
          <p className="muted">Audience lists</p>
          <b>{lists}</b>
          <span className="tag">Ready to send</span>
        </div>
        <div className="card stat">
          <p className="muted">Campaigns</p>
          <b>{campaigns.length}</b>
          <span className="tag">{sent} sent / partial</span>
        </div>
        <div className="card stat">
          <p className="muted">Send pacing</p>
          <b>5s</b>
          <span className="tag">gap between each email</span>
        </div>
      </div>
      <div className="card" style={{ marginTop: 20 }}>
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>Recent campaigns</h3>
          <Link href="/campaigns" className="btn secondary sm">
            View all
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="empty">
            <strong>No campaigns yet</strong>
            Compose your first letter to the list. HTML, preview, then send via SES.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.slice(0, 6).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.subject}</td>
                  <td>
                    <span className={`badge ${c.status}`}>{c.status}</span>
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
