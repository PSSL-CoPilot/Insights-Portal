"use client";

import { RankedBars, type RankedRow } from "./RankedBars";
import { C } from "./shared";
import { fmtInt, fmtPct, fmtPct0, fmtSignedPct } from "@/lib/format";
import type { DataModel, MonthKey } from "@/lib/data/types";
import { findHotspot, stateRows, type KpiDef } from "@/lib/data/metrics";
import { Badge, cn } from "../ui/primitives";

/** Horizontal state ranking for a KPI. The data-detected hotspot stands out; every bar is clickable. */
export function StateRanking({
  model, month, def, selectedState, onSelect,
}: { model: DataModel; month: MonthKey; def: KpiDef; selectedState?: string | null; onSelect?: (state: string) => void }) {
  const rows = stateRows(model, month);
  const hot = findHotspot(model, month);
  const fmt = (v: number | null) => (v === null ? "—" : def.unit === "pct" ? fmtPct(v) : fmtInt(v));
  const withVal = rows.map((r) => ({ r, v: r.snapshot[def.key] ?? null }));
  const sorted = [...withVal].sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  if (!sorted.some((x) => x.v !== null)) {
    return <div className="rounded-xl bg-[#f7f7f3] px-4 py-6 text-center text-sm text-mute">State-level values for {def.label} aren’t in the workbook for this month.</div>;
  }
  const bars: RankedRow[] = sorted.map(({ r, v }) => {
    const isHot = hot?.state === r.state && !!(r.cancelsMoM !== null && r.cancelsMoM > 0.15);
    return {
      id: r.state,
      label: (
        <span className="flex items-center gap-2">
          {r.state}
          {isHot && <Badge tone="bad" className="!px-1.5 !py-0 text-[9.5px] tracking-wider">HOTSPOT</Badge>}
        </span>
      ),
      value: v,
      valueLabel: fmt(v),
      sub: r.cancelsMoM !== null ? `Cancels ${fmtSignedPct(r.cancelsMoM)} vs prior month` : undefined,
      color: isHot ? C.bad : selectedState === r.state ? C.indigo : C.lilac,
      emphasis: isHot || selectedState === r.state,
      onClick: onSelect ? () => onSelect(r.state) : undefined,
      tip: `Click to focus ${r.state}`,
    };
  });
  return <RankedBars rows={bars} />;
}

export function StateTable({
  model, month, selectedState, onSelect,
}: { model: DataModel; month: MonthKey; selectedState?: string | null; onSelect?: (s: string) => void }) {
  const rows = [...stateRows(model, month)].sort((a, b) => (b.cancels ?? 0) - (a.cancels ?? 0));
  const hot = findHotspot(model, month);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="text-right text-[11px] uppercase tracking-wider text-mute">
            <th className="pb-2 pl-3 text-left font-semibold">State</th>
            <th className="pb-2 font-semibold">Sales</th>
            <th className="pb-2 font-semibold">Installs</th>
            <th className="pb-2 font-semibold">Cancels</th>
            <th className="pb-2 font-semibold">Cancel rate</th>
            <th className="pb-2 font-semibold">MoM growth</th>
            <th className="pb-2 font-semibold">Post-ODD</th>
            <th className="pb-2 pr-3 font-semibold">Pending contact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isHot = hot?.state === r.state && (r.cancelsMoM ?? 0) > 0.15;
            return (
              <tr
                key={r.state}
                onClick={onSelect ? () => onSelect(r.state) : undefined}
                className={cn("border-t border-line-2 text-right transition", onSelect && "cursor-pointer hover:bg-[#f5f5f1]", isHot && "bg-[#fdf3f3]", selectedState === r.state && "bg-indigo-soft/60")}
              >
                <td className="py-2.5 pl-3 text-left font-semibold">
                  <span className="flex items-center gap-2">{r.state}{isHot && <span className="size-1.5 rounded-full bg-bad" />}</span>
                </td>
                <td className="num py-2.5">{fmtInt(r.sales)}</td>
                <td className="num py-2.5">{fmtInt(r.installs)}</td>
                <td className="num py-2.5 font-semibold">{fmtInt(r.cancels)}</td>
                <td className="num py-2.5">{fmtPct(r.cancelRate)}</td>
                <td className={cn("num py-2.5 font-semibold", (r.cancelsMoM ?? 0) > 0.15 ? "text-bad" : "text-mute")}>{fmtSignedPct(r.cancelsMoM)}</td>
                <td className="num py-2.5">{fmtPct0(r.postPct)}</td>
                <td className="num py-2.5 pr-3">{fmtPct0(r.pendingPct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
