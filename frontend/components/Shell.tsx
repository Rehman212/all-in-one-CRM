"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { IconDash, IconGear, IconMail, IconPeople } from "./Icons";

const items = [
  { href: "/dashboard", label: "Overview", icon: <IconDash /> },
  { href: "/lists", label: "Audience", icon: <IconPeople /> },
  { href: "/campaigns", label: "Campaigns", icon: <IconMail /> },
  { href: "/inbox", label: "Inbox", icon: <IconMail /> },
  { href: "/smtp", label: "Deliverability", icon: <IconGear /> },
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const current = items.find((i) => i.href === path)?.label || "Overview";
  const flush = path === "/inbox";

  useEffect(() => {
    if (!localStorage.getItem("sv_token")) window.location.href = "/";
  }, []);

  function logout() {
    localStorage.removeItem("sv_token");
    window.location.href = "/";
  }

  return (
    <div className={`app${flush ? " mail-mode" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <h2>Social Velocityy</h2>
            <small>Mail studio</small>
          </div>
        </div>
        <div className="nav-label">Workspace</div>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={`side-link${path === item.href ? " active" : ""}`}>
            {item.icon}
            {item.label}
          </Link>
        ))}
        <div className="side-footer">
          <div className="user-chip">
            <div className="brand-mark" style={{ width: 34, height: 34, fontSize: 14 }}>
              H
            </div>
            <div>
              <b>Agency admin</b>
              hello@socialvelocityy.com
            </div>
          </div>
          <button className="ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="crumb">SV Mailer / {current}</div>
            <b style={{ fontSize: 16 }}>socialvelocityy.com</b>
          </div>
          <span className="ses-pill">Amazon SES · ap-south-1 · Production</span>
        </header>
        <div className={`wrap${flush ? " flush" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
