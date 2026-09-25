"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { assess, getSnapshot, kpiMeaning, prevMonth, series, snapVal, type KpiDef } from "@/lib/data/metrics";
import type { DataModel, MonthKey } from "@/lib/data/types";
import { fmtCompact, fmtInt, fmtPctSmart, fmtPp, fmtSignedPct, monthShort } from "@/lib/format";
import { Badge, cn, StatusDot, statusColor } from "../ui/primitives";
import { Sparkline } from "../ui/Sparkline";

export function formatKpiValue(def: KpiDef, v: number | null, full = false): string {
  if (v === null) return "—";
  if (def.unit === "pct") return fmtPctSmart(v);
  return full || Math.abs(v) < 10000 ? fmtInt(v) : fmtCompact(v);
}

/** Compact count formatting used on cards: 7238 → "7.2K", 380 → "380". */
export function formatCompactKpi(def: KpiDef, v: number | null): string {
  if (v === null) return "—";
  if (def.unit === "pct") return fmtPctSmart(v);
  return Math.abs(v) >= 1000 ? fmtCompact(v) : fmtInt(v);
}

const SPOTLIGHT = new Set(["post", "pending"]);

export function KPICard({
  def, model, month, state, onClick, delay = 0,
}: { def: KpiDef; model: DataModel; month: MonthKey; state: string | null; onClick: () => void; delay?: number }) {
  const snap = getSnapshot(model, month, state);
  const value = snapVal(snap, def.key);
  const pm = prevMonth(model, month);
  const prevVal = pm ? snapVal(getSnapshot(model, pm, state), def.key) : null;
  const a = assess(model, def, month, state);
  const d = a.delta;
  const spark = series(model, def.key, state).filter((p) => p.month <= month).map((p) => p.value);
  const companion = def.companion ? snapVal(snap, def.companion.key) : null;
  const meaning = kpiMeaning(model, def, month, state);
  const spotlight = SPOTLIGHT.has(def.id) && a.status === "critical";
  const unavailable = value === null;

  const dir = d ? (d.value > 0 ? "up" : d.value < 0 ? "down" : "flat") : "flat";
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const tone = a.status === "critical" ? "bad" : a.status === "warning" ? "warn" : a.status === "healthy" ? "good" : "neutral";
  const deltaTxt = d ? (d.kind === "pp" ? fmtPp(d.value) : fmtSignedPct(d.value)) : "—";

  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "group relative flex min-h-[158px] animate-rise flex-col justify-between overflow-hidden rounded-[18px] border p-4 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        spotlight ? "border-ink bg-ink text-white" : a.status === "critical" ? "border-bad/40 bg-white" : "border-line bg-white hover:border-[#d2d2ca]",
        unavailable && "opacity-70",
      )}
      aria-label={`${def.label}: ${formatKpiValue(def, value)}. Open deep dive.`}
    >
      {spotlight && <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-brand/25 blur-2xl" />}
      <div className="relative flex items-start justify-between gap-2">
        <div className={cn("text-[12px] font-semibold leading-tight", spotlight ? "text-white/70" : "text-mute")}>{def.label}</div>
        <div className="flex items-center gap-1.5">
          {a.anomaly && a.status !== "neutral" && (
            <Badge tone={a.status === "critical" ? "bad" : "warn"} className={cn("!px-1.5 !py-0 text-[9.5px] tracking-wider", spotlight && "!bg-brand !text-ink")}>
              {spotlight ? "FOCUS" : "ANOMALY"}
            </Badge>
          )}
          <StatusDot status={a.status} pulse />
        </div>
      </div>

      <div className="relative mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="num text-[34px] font-semibold leading-none tracking-tight">{formatCompactKpi(def, value)}</div>
          {companion !== null && (
            <div className={cn("mt-1.5 text-[11px]", spotlight ? "text-white/60" : "text-mute")}>
              {fmtInt(companion)} <span className="opacity-80">{def.companion!.label.replace(/ cancels$/i, "")}</span>
            </div>
          )}
        </div>
        <div className="shrink-0">
          <Sparkline values={spark} color={spotlight ? "#FFC72C" : a.status === "neutral" ? "#5b5fe6" : statusColor(a.status)} width={84} height={34} />
        </div>
      </div>

      <div className="relative mt-3 flex items-center justify-between gap-2 border-t pt-2.5 text-[11.5px]" style={{ borderColor: spotlight ? "rgba(255,255,255,.14)" : "#f0f0eb" }}>
        <span className={cn("flex items-center gap-1 font-semibold", tone === "bad" ? (spotlight ? "text-[#ff8a8e]" : "text-bad") : tone === "warn" ? "text-[#c98400]" : tone === "good" ? "text-good" : spotlight ? "text-white/70" : "text-mute")}>
          <Arrow className="size-3.5" />
          <span className="num">{deltaTxt}</span>
          <span className={cn("font-normal", spotlight ? "text-white/50" : "text-soft")}>MoM</span>
        </span>
        <span className={cn("num", spotlight ? "text-white/50" : "text-soft")} title={pm ? `${monthShort(pm)} value` : undefined}>
          {pm && prevVal !== null ? `${monthShort(pm)} ${formatCompactKpi(def, prevVal)}` : ""}
        </span>
      </div>

      {meaning && <div className={cn("relative mt-2 line-clamp-2 text-[11px] leading-snug", spotlight ? "text-white/60" : "text-mute")}>{meaning}</div>}
    </button>
  );
}
