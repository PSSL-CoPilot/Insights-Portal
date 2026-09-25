"use client";

import { ArrowDown, CheckCircle2, GitBranch } from "lucide-react";
import { RESCUE_FLOW } from "@/lib/data/narratives";
import { cn } from "../ui/primitives";

/** The Post-ODD Customer Rescue workflow as a vertical decision flow. */
export function RescueFlow({ compact }: { compact?: boolean }) {
  return (
    <ol className="mx-auto flex max-w-md flex-col items-stretch">
      {RESCUE_FLOW.map((n, i) => (
        <li key={n.label} className="flex flex-col items-center" style={{ animation: `rise .5s ${i * 60}ms both` }}>
          <div
            className={cn(
              "flex w-full items-center gap-3 border px-4 text-[13.5px] font-medium transition hover:-translate-y-0.5 hover:shadow-card",
              compact ? "py-2" : "py-3",
              n.kind === "decision" ? "rounded-2xl border-dashed border-warn bg-warn-soft text-[#7a5200]" : n.kind === "end" ? "rounded-2xl border-ink bg-ink text-white" : "rounded-2xl border-line bg-white",
            )}
          >
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", n.kind === "end" ? "bg-brand text-ink" : n.kind === "decision" ? "bg-warn/20" : "bg-[#f0f0eb] text-mute")}>
              {n.kind === "decision" ? <GitBranch className="size-3.5" /> : n.kind === "end" ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </span>
            {n.label}
          </div>
          {i < RESCUE_FLOW.length - 1 && (
            <div className="flex h-6 flex-col items-center text-soft">
              <div className="w-px flex-1 bg-[#d6d6cf]" />
              <ArrowDown className="-mt-1 size-3.5" />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
