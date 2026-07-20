/**
 * AstridrRail — the always-on Ástríðr presence, docked to the right of the app
 * shell across every route (mounted once in DashboardLayout, not per-page).
 *
 * Expanded: her AvatarAura hero + live voice state + conversation + controls.
 * Collapsed: a slim strip (avatar + live pulse) that reclaims the cockpit width.
 *
 * Replaces the standalone /chat page and the voice popup — conversation lives
 * here now. This is the shell (step 1); the conversation thread and voice
 * controls are wired in over the next commits.
 */

import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { AvatarAura } from "@/components/voice/AvatarAura";
import astridrAvatar from "@/assets/avatar/astridr-avatar.png";

const LS_KEY = "codepulse-astridr-rail-collapsed";

export function AstridrRail() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) ?? "false");
    } catch {
      return false;
    }
  });

  const update = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(v));
    } catch {
      /* localStorage unavailable — keep the optimistic in-memory value */
    }
  };

  // ── Collapsed: slim strip ──────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="hidden md:flex w-[64px] flex-shrink-0 flex-col items-center gap-4 py-5 border-l border-border bg-card relative">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <img
          src={astridrAvatar}
          alt="Ástríðr"
          className="w-11 h-11 rounded-full object-cover object-[50%_20%] border border-primary/50 shadow-[0_0_22px_rgba(6,182,212,0.5)]"
        />
        <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)] animate-pulse" />
        <span className="[writing-mode:vertical-rl] text-[9px] tracking-[0.25em] text-muted-foreground font-mono">
          LISTENING
        </span>
        <button
          type="button"
          onClick={() => update(false)}
          title="Expand Ástríðr"
          aria-label="Expand Ástríðr"
          className="mt-auto w-8 h-8 rounded-lg border border-border bg-muted text-muted-foreground hover:text-primary hover:border-primary/40 grid place-items-center transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  // ── Expanded: full presence ────────────────────────────────────────────
  return (
    <aside className="hidden md:flex w-[380px] flex-shrink-0 flex-col border-l border-border bg-card relative shadow-[-24px_0_80px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="font-mono font-bold tracking-[0.15em] text-[13px]">ÁSTRÍÐR</div>
          <div className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground">
            ALWAYS LISTENING
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-primary px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)] animate-pulse" />
            LISTENING
          </span>
          <button
            type="button"
            onClick={() => update(true)}
            title="Collapse Ástríðr"
            aria-label="Collapse Ástríðr"
            className="w-[26px] h-[26px] rounded-md border border-border bg-muted text-muted-foreground hover:text-primary hover:border-primary/40 grid place-items-center transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Avatar hero (the real audio-reactive AvatarAura) */}
      <div className="flex flex-col items-center pt-5 pb-2 shrink-0">
        <AvatarAura state="idle" ttsAnalyser={null} />
      </div>

      {/* Conversation thread — wired in the next commit */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          Say the wake word or type below to talk to Ástríðr.
        </p>
      </div>

      {/* Controls — wired in the next commit */}
      <div className="border-t border-border p-3 bg-black/20 text-center">
        <p className="font-mono text-[10.5px] text-muted-foreground/70">
          Voice + chat wiring — next step
        </p>
      </div>
    </aside>
  );
}

export default AstridrRail;
