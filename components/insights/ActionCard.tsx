"use client";

import Link from "next/link";
import { ArrowRight, MapPin, Users } from "lucide-react";
import type { ActionItem, Priority } from "@/lib/data/narratives";
import { Badge, Card, cn } from "../ui/primitives";
import { fmtInt } from "@/lib/format";

export type ActionStatus = "Open" | "In Progress" | "Completed";
export const STATUSES: ActionStatus[] = ["Open", "In Progress", "Completed"];

const prio: Record<Priority, "bad" | "warn" | "indigo" | "neutral"> = { Critical: "bad", High: "warn", Medium: "indigo", Low: "neutral" };

export function ActionCard({ action, status, onStatus, index = 0 }: { action: ActionItem; status: ActionStatus; onStatus: (s: ActionStatus) => void; index?: number }) {
  const done = status === "Completed";
  return (
    <Card id={action.id} className={cn("animate-rise p-5 transition sm:p-6", done && "opacity-70")} style={{ animationDelay: `${index * 70}ms` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Badge tone={prio[action.priority]}>{action.priority.toUpperCase()}</Badge><span className="text-xs text-mute">{action.owner}</span></div>
          <h3 className={cn("mt-2.5 text-[20px] font-semibold tracking-tight", done && "line-through decoration-2")}>{action.title.toUpperCase()}</h3>
        </div>
        <div role="radiogroup" aria-label="Status" className="inline-flex rounded-full border border-line bg-[#f0f0eb] p-1">
          {STATUSES.map((s) => (
            <button key={s} role="radio" aria-checked={status === s} onClick={() => onStatus(s)} className={cn("rounded-full px-3 py-1 text-[12px] font-semibold transition", status === s ? (s === "Completed" ? "bg-good text-white" : s === "In Progress" ? "bg-brand text-ink" : "bg-ink text-white") : "text-mute hover:text-ink")}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[#f7f7f3] p-3.5">
          <dt className="eyebrow flex items-center gap-1.5"><MapPin className="size-3" /> Market</dt>
          <dd className="mt-1 text-[15px] font-semibold">{action.market}</dd>
        </div>
        <div className="rounded-xl bg-[#f7f7f3] p-3.5 sm:col-span-2">
          <dt className="eyebrow flex items-center gap-1.5"><Users className="size-3" /> Affected population</dt>
          <dd className="mt-1 flex items-baseline gap-2"><span className="num text-xl font-semibold">{action.population !== null ? fmtInt(action.population) : "—"}</span><span className="text-xs text-mute">{action.populationLabel}</span></dd>
        </div>
      </dl>

      <div className="mt-4 space-y-2 text-[13.5px] leading-relaxed">
        <p><strong>Expected impact:</strong> <span className="text-ink-2">{action.impact}</span></p>
        <p className="text-mute"><strong className="text-ink-2">Why:</strong> {action.why}</p>
      </div>
      <Link href={action.href} className="group mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink underline decoration-dotted underline-offset-4">
        See the evidence <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
      </Link>
    </Card>
  );
}
