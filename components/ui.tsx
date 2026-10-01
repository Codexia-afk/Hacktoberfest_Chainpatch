"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight, BookOpen, Box, Braces, Check, CircleHelp, FilePlus2, GitBranch, Layers3, Menu, MessageCircle, Settings2, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

export function Brand() {
  return <Link className="brand" href="/" aria-label="ChainPatch home"><span className="brand-mark"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19V9a4 4 0 0 1 4-4h2M19 5v10a4 4 0 0 1-4 4h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="m9 14 6-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="5" cy="19" r="2" fill="currentColor" /><circle cx="19" cy="5" r="2" fill="currentColor" /></svg></span>chainpatch<span className="brand-period">.</span></Link>;
}

export function ModelStatus() {
  const [status, setStatus] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal }).then(r => { if (!r.ok) throw new Error("Connection check failed"); return r.json(); }).then(d => setStatus(d.connected)).catch(e => { if (e.name !== "AbortError") setStatus(false); });
    const onStatus = (e: Event) => setStatus((e as CustomEvent<boolean>).detail);
    window.addEventListener("chainpatch:model-status", onStatus);
    return () => { controller.abort(); window.removeEventListener("chainpatch:model-status", onStatus); };
  }, []);
  return <Link href="/settings" className="model-status"><span className={`status-dot ${status ? "live" : ""}`} /><span>{status === null ? "Checking Ollama…" : status ? "Ollama · Gemma connected" : "Ollama setup needed"}<small>{status === null ? "Checking local model" : status ? "Local model available" : "Sample mode available"}</small></span><ArrowUpRight size={14} /></Link>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to main content</a><aside className={`sidebar ${menuOpen ? "mobile-expanded" : ""}`}><Brand />
    <div className="workspace-switch"><span className="workspace-avatar">L</span><span>Lumen workspace<small>Local sandbox</small></span><span className="tiny-key">01</span></div>
    <p className="nav-label">INVESTIGATE</p>
    <nav aria-label="Main navigation">{[{ href: "/workspace", icon: Layers3, label: "Workspace" }, { href: "/review/demo", icon: GitBranch, label: "Interactive demo" }, { href: "/playground", icon: Braces, label: "Judge presentation" }, { href: "/gemma", icon: MessageCircle, label: "Ollama + Gemma" }, { href: "/create", icon: FilePlus2, label: "Create review" }].map(({ href, icon: Icon, label }) => <Link key={href} href={href} className={path === href ? "active" : ""} aria-label={label} title={label} aria-current={path === href ? "page" : undefined}><Icon size={18} /><span>{label}</span>{href === "/review/demo" && <span className="nav-count">1</span>}</Link>)}</nav>
    <button className="mobile-menu-toggle" aria-label={menuOpen ? "Close resource navigation" : "Open resource navigation"} aria-expanded={menuOpen} aria-controls="resource-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
    <div className="sidebar-note"><span className="small-caps"><ShieldCheck size={14} /> BUILT TO INSPECT</span><p>One changed instruction.<br />An entirely new route.</p><Link href="/docs">Understand the method <ArrowUpRight size={14} /></Link></div>
    <nav className="bottom-nav" id="resource-navigation" aria-label="Resources"><Link href="/docs" className={path === "/docs" ? "active" : ""} aria-current={path === "/docs" ? "page" : undefined}><BookOpen size={18} /><span>Documentation</span></Link><Link href="/settings" className={path === "/settings" ? "active" : ""} aria-current={path === "/settings" ? "page" : undefined}><Settings2 size={18} /><span>Settings</span></Link></nav><ModelStatus />
  </aside><div className="main-shell"><header className="app-topbar"><span><Box size={15} /> Lumen workspace <span className="slash">/</span> {path.startsWith("/review") ? "Update review" : path === "/workspace" ? "Overview" : path === "/create" ? "New review" : path === "/docs" ? "Documentation" : path === "/playground" ? "Judge presentation" : path === "/gemma" ? "Live Gemma" : "Configuration"}</span><span className="sandbox-tag"><span /> LOCAL SIMULATION</span></header><main id="main-content" tabIndex={-1}>{children}</main><footer className="app-footer"><span>Inspect the change. Keep the workflow.</span><span>ChainPatch · Open source <GitBranch size={13} /></span></footer></div></div>;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "amber" | "green" | "blue"; children: React.ReactNode }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Empty({ children }: { children: React.ReactNode }) { return <div className="empty"><CircleHelp size={25} /><p>{children}</p></div>; }
export function Loading() { return <div className="loading" role="status"><span className="spinner" />Loading your review…</div>; }
export function ErrorBox({ message }: { message: string }) { return <div className="error-box" role="alert">{message}</div>; }
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
export const Icons = { Activity, Braces, Check };
