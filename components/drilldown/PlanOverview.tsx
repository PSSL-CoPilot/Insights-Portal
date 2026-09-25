"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Crosshair } from "lucide-react";
import { useApp } from "../AppContext";
import { planRows, StateRanking, StateTable, type PlanKind } from "../charts/StateRanking";
import { Badge, Card, cn, RichText, SectionTitle, Tabs } from "../ui/primitives";
import { kpiById } from "@/lib/data/metrics";
import { diagnose } from "@/lib/data/narratives";
import { fmtInt, fmtPct, fmtPct0, fmtSignedPct, monthLabel, monthName, stateSlug } from "@/lib/format";

const METRICS = [
  { id: "cancels", label: "Cancellations" },
  { id: "cancelRate", label: "Cancel rate" },
  { id: "post", label: "Post ODD %" },
  { id: "cust", label: "Customer Miss %" },
  { id: "pending", label: "Pending contact %" },
] as const;

/**
 * State and Channel Plan: one page that tells where the problem sits (focus state, then focus channel),
 * shows where they intersect, and lets the reader switch the ranking between states and channels.
 */
export function PlanOverview({ kind: initialKind }: { kind: PlanKind }) {
  const { model, month, state: filterState, setState } = useApp();
  const router = useRouter();
  const [kind, setKind] = useState<PlanKind>(initialKind);
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("cancels");
  const { rows, focus } = planRows(model, month, kind);
  const sorted = [...rows].sort((a, b) => (b.cancelsMoM ?? -1) - (a.cancelsMoM ?? -1));
  const d = diagnose(model, month);
  const base = kind === "state" ? "states" : "channels";
  const go = (name: string) => {
    if (kind === "state") setState(name);
    router.push(`/${base}/${stateSlug(name)}?month=${month}`);
  };
  const open = (k: PlanKind, name: string) => {
    if (k === "state") setState(name);
    router.push(`/${k === "state" ? "states" : "channels"}/${stateSlug(name)}?month=${month}`);
  };
  const fs = d.hotspot && (d.hotspot.cancelsMoM ?? 0) > 0.15 ? d.hotspot : null;
  const fc = d.focusChannel && (d.focusChannel.contribution ?? 0) > 0.25 ? d.focusChannel : null;
  const focusCards: { kind: PlanKind; name: string | null; row: typeof fs | typeof fc }[] = [
    { kind: "state", name: fs?.state ?? null, row: fs },
    { kind: "channel", name: fc?.channel ?? null, row: fc },
  ];
  const noun = kind === "state" ? "state" : "channel";

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow={`State and Channel Plan · ${monthLabel(month)}`}
        title="Where do we need a plan?"
        sub="Start with the focus market, then the focus channel within it, then open a plan to review what changed, when, who, why and whether it could have been seen coming."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {focusCards.map((x, i) => (
          <Card key={x.kind} className="flex items-center gap-4 border-brand/50 bg-brand-soft p-5">
            <span className="bs-gradient grid size-11 shrink-0 place-items-center rounded-2xl text-[15px] font-bold text-[#111]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="eyebrow">Focus {x.kind}</div>
              <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">
                {x.row ? <RichText text={`**${x.name}**: cancellations ${fmtSignedPct(x.row.cancelsMoM)}, **${fmtPct0(x.row.contribution)}** of the increase, ${fmtPct(x.row.cancelRate)} cancel rate.`} /> : `Every ${x.kind} is within its normal range in ${monthName(month)}.`}
              </p>
            </div>
            {x.row && (
              <button onClick={() => open(x.kind, x.name!)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-panel px-4 text-[13px] font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5">
                Open plan <ArrowUpRight className="size-4" />
              </button>
            )}
          </Card>
        ))}
      </div>

      <StateChannelMatrix onState={(s) => open("state", s)} onChannel={(c) => open("channel", c)} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-semibold tracking-tight">All {noun}s, ranked by cancellation growth</h3>
          <p className="text-sm text-mute">Select any {noun} to open its plan.</p>
        </div>
        <Tabs tabs={[{ id: "state", label: "By state" }, { id: "channel", label: "By channel" }]} value={kind} onChange={(v) => setKind(v as PlanKind)} />
      </div>

      <div className={cn("grid gap-4 sm:grid-cols-2", kind === "state" ? "xl:grid-cols-3" : "xl:grid-cols-4")}>
        {sorted.map((r, i) => {
          const isHot = focus === r.name;
          const up = (r.cancelsMoM ?? 0) > 0.005, down = (r.cancelsMoM ?? 0) < -0.005;
          return (
            <Card key={r.name} interactive onClick={() => go(r.name)} className={cn("group animate-rise p-5", isHot && "border-bad/40 bg-bad-soft", filterState === r.name && "ring-2 ring-brand")} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[17px] font-semibold">{r.name}{isHot && <Badge tone="bad">FOCUS</Badge>}</div>
                  <div className="mt-0.5 text-xs text-mute">{fmtInt(r.sales)} sales · {fmtInt(r.installs)} installs</div>
                </div>
                <span className="grid size-8 place-items-center rounded-full bg-subtle text-mute transition group-hover:bg-panel group-hover:text-white"><ArrowUpRight className="size-4" /></span>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <div className="num text-[34px] font-semibold leading-none">{fmtInt(r.cancels)}</div>
                  <div className="mt-1 text-xs text-mute">cancellations</div>
                </div>
                <div className={cn("num text-xl font-bold", up ? "text-bad" : down ? "text-good" : "text-mute")}>{fmtSignedPct(r.cancelsMoM)}</div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line-2 pt-3 text-center text-xs">
                <div><div className="num text-[15px] font-semibold">{fmtPct(r.cancelRate)}</div><div className="text-mute">cancel rate</div></div>
                <div><div className="num text-[15px] font-semibold">{fmtPct0(r.postPct)}</div><div className="text-mute">Post ODD</div></div>
                <div><div className="num text-[15px] font-semibold">{fmtPct0(r.pendingPct)}</div><div className="text-mute">pending</div></div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[15px] font-semibold">Compare {noun}s</div>
          <Tabs tabs={METRICS.map((m) => ({ id: m.id, label: m.label }))} value={metric} onChange={setMetric} size="sm" />
        </div>
        <StateRanking model={model} month={month} def={kpiById(metric)!} selectedState={kind === "state" ? filterState : null} onSelect={go} kind={kind} />
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[15px] font-semibold">{kind === "state" ? "State" : "Channel"} detail</div>
          {kind === "state" && filterState && <button onClick={() => setState(null)} className="text-xs font-semibold text-mute underline">Clear state filter</button>}
        </div>
        <StateTable model={model} month={month} selectedState={kind === "state" ? filterState : null} onSelect={go} kind={kind} />
      </Card>
    </div>
  );
}

/** State × channel cancel rate heatmap for the drill month. */
export function StateChannelMatrix({ onState, onChannel, highlight }: { onState?: (s: string) => void; onChannel?: (c: string) => void; highlight?: string }) {
  const { model, month } = useApp();
  if (!model.stateChannel.length) return null;
  const rates = model.stateChannel.map((r) => r.cancelRate ?? 0);
  const lo = Math.min(...rates), hi = Math.max(...rates);
  const cell = (st: string, ch: string) => model.stateChannel.find((r) => r.state === st && r.channel === ch);
  const heat = (v: number) => {
    const t = hi > lo ? (v - lo) / (hi - lo) : 0;
    return t > 0.6 ? "bg-bad text-white" : t > 0.35 ? "bg-indigo text-[#111]" : t > 0.15 ? "bg-lilac text-[#111]" : "bg-subtle text-ink-2";
  };
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-1 text-[15px] font-semibold">State × Channel cancel rate · {model.drillMonth ? monthLabel(model.drillMonth) : ""}</div>
      <p className="mb-4 text-xs text-mute">Darker cells carry higher cancel rates. Select a row or column heading to open that plan.{month !== model.drillMonth ? " This cross view is published for the latest month only." : ""}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-1 text-[12.5px]">
          <thead>
            <tr>
              <th />
              {model.channelNames.map((c) => (
                <th key={c} className="px-1 pb-1 text-center font-semibold text-mute">
                  <button onClick={() => onChannel?.(c)} className={cn("hover:text-ink hover:underline", highlight === c && "text-ink")}>{c}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.states.map((s) => (
              <tr key={s}>
                <th className="whitespace-nowrap pr-2 text-left font-semibold">
                  <button onClick={() => onState?.(s)} className={cn("hover:underline", highlight === s && "text-ink")}>{s}</button>
                </th>
                {model.channelNames.map((c) => {
                  const r = cell(s, c);
                  return (
                    <td key={c} title={r ? `${s} ${c}: ${fmtInt(r.cancels)} cancellations of ${fmtInt(r.sales)} sales` : undefined}
                      className={cn("num rounded-lg px-2 py-2 text-center font-semibold", r?.cancelRate != null ? heat(r.cancelRate) : "bg-subtle text-soft", highlight && highlight !== s && highlight !== c && "opacity-45")}>
                      {fmtPct(r?.cancelRate ?? null)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
