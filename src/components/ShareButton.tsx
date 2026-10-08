"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, ShieldOff, Share2, X } from "lucide-react";

/** Per-dashboard, explicit share control: creates / copies / revokes a read-only public link. */
export function ShareButton({ dashboardId }: { dashboardId: string | null }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!dashboardId) return;
    try { const j = await (await fetch(`/api/dashboards/${dashboardId}/share`)).json(); setToken(j.token ?? null); } catch {}
  }, [dashboardId]);
  useEffect(() => { if (!open) return; let live = true; Promise.resolve().then(() => { if (live) void refresh(); }); return () => { live = false; }; }, [open, refresh]);

  const act = async (method: "POST" | "DELETE") => {
    if (!dashboardId) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/dashboards/${dashboardId}/share`, { method });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      setToken(j.token ?? null);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/share/${token}` : "";
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} disabled={!dashboardId}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs text-blue-300 hover:bg-blue-500/20 transition-all disabled:opacity-50"
      ><Share2 className="w-3.5 h-3.5" /> Share</button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 glass-card p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2"><Link2 className="w-4 h-4 text-blue-400" />Share this dashboard</h4>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          {!token ? (
            <>
              <p className="text-[11px] text-slate-400 mb-3">Creates a private link anyone can open without signing in. They see this dashboard, its charts and the first 100 rows of this dataset, read-only. Nothing else in your account is exposed. You can revoke it any time.</p>
              <button onClick={() => act("POST")} disabled={busy} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-50">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Create share link
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 outline-none" />
                <button onClick={copy} className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10" title="Copy link">{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
              </div>
              <p className="text-[10px] text-slate-500 mb-3">Anyone with this link can view (not edit) this dashboard and its data preview.</p>
              <button onClick={() => act("DELETE")} disabled={busy} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs hover:bg-red-500/20 disabled:opacity-50">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />} Revoke link
              </button>
            </>
          )}
          {err && <p className="text-[11px] text-red-400 mt-2">{err}</p>}
        </div>
      )}
    </div>
  );
}
