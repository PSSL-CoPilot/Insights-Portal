"use client";

import { Layers } from "lucide-react";
import type { DataModel, MonthKey } from "@/lib/data/types";
import { RankedBars, type RankedRow } from "../charts/RankedBars";
import { C } from "../charts/shared";
import { EmptyState } from "../ui/primitives";
import { fmtInt, fmtPct } from "@/lib/format";

export const EXPECTED_CHANNELS = ["D2D", "Digital", "Digital Partner", "Inbound", "Indirect", "OBTM", "Other"];

/**
 * Channel breakdown. The workbook currently has no channel-by-month data, so this shows an explicit
 * data-pending state. As soon as a "Channel Monthly" sheet (Month | Channel | Unique Sales | Installs |
 * Cancellations) is added, this component populates automatically — nothing is invented.
 */
export function ChannelBreakdown({ model, month }: { model: DataModel; month: MonthKey }) {
  const rows = model.channels?.filter((r) => r.month === month) ?? [];
  if (!model.channels || rows.length === 0) {
    return (
      <EmptyState title="Channel data pending" icon={<Layers className="size-5" />}>
        <p>
          The workbook doesn’t include a channel-level dataset{model.channels ? ` for this month` : ""}, so nothing is shown rather than inventing numbers.
        </p>
        <p className="mt-2">
          Add a sheet named <strong>Channel Monthly</strong> with columns <em>Month · Channel · Unique Sales · Installs · Cancellations</em> and this tab fills in automatically.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {EXPECTED_CHANNELS.map((c) => (
            <span key={c} className="rounded-full border border-dashed border-[#d6d6cf] bg-white px-3 py-1 text-xs font-medium text-mute">{c}</span>
          ))}
        </div>
      </EmptyState>
    );
  }
  const total = rows.reduce((a, r) => a + (r.cancels ?? 0), 0) || 1;
  const bars: RankedRow[] = [...rows]
    .sort((a, b) => (b.cancels ?? 0) - (a.cancels ?? 0))
    .map((r) => ({
      id: r.channel, label: r.channel, value: r.cancels, valueLabel: `${fmtInt(r.cancels)} · ${fmtPct((r.cancels ?? 0) / total, 0)}`,
      sub: r.sales ? `${fmtInt(r.sales)} sales · ${fmtPct((r.cancels ?? 0) / r.sales)} cancel rate` : undefined, color: C.indigo,
    }));
  return <RankedBars rows={bars} />;
}
