"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { useApp } from "../AppContext";
import { Modal } from "../ui/Modal";
import { Badge, Button, Card, cn, Delta, Tabs } from "../ui/primitives";
import { TrendChart } from "../charts/TrendChart";
import { StateRanking, StateTable } from "../charts/StateRanking";
import { ODDTimingChart, ODD_COLORS, type OddBucket } from "../charts/ODDTimingChart";
import { CancelClassification } from "../charts/CancelClassification";
import { CustomerMissDrivers } from "../charts/CustomerMissDrivers";
import { WatchtowerSignals } from "../charts/WatchtowerSignals";
import { ChannelBreakdown } from "./ChannelBreakdown";
import { formatCompactKpi, formatKpiValue } from "./KPICard";
import { assess, describeTrend, findHotspot, getSnapshot, kpiById, kpiMeaning, prevMonth, series, snapVal, type KpiDef } from "@/lib/data/metrics";
import { fmtInt, fmtPct0, fmtPp, fmtSignedPct, monthLabel, monthShort, stateSlug } from "@/lib/format";

type TabId = "trend" | "states" | "channels" | "odd" | "class" | "drivers" | "signals";

const BASE_TABS: { id: TabId; label: string }[] = [
  { id: "trend", label: "Trend" },
  { id: "states", label: "States" },
  { id: "channels", label: "Channels" },
  { id: "odd", label: "ODD Timing" },
  { id: "class", label: "Classification" },
  { id: "drivers", label: "Drivers" },
];

function NextStep({ question, label, onClick }: { question: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group mt-5 flex w-full items-center justify-between gap-4 rounded-2xl border border-dashed border-[#cfcfc6] bg-white px-5 py-4 text-left transition hover:border-ink hover:bg-[#fbfaf5]">
      <div>
        <div className="eyebrow mb-0.5">Keep investigating</div>
        <div className="text-[15px] font-semibold">{question}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white transition group-hover:bg-ink-2">
        {label} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "bad" | "good" }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className={cn("num mt-1 text-2xl font-semibold", tone === "bad" && "text-bad", tone === "good" && "text-good")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-mute">{sub}</div>}
    </div>
  );
}

export function KPIDetailModal() {
  const { kpiModal, closeKpi } = useApp();
  const def = kpiModal ? kpiById(kpiModal.id) : undefined;
  if (!kpiModal || !def) return null;
  return <ModalBody key={`${kpiModal.id}|${kpiModal.state ?? ""}`} def={def} initialTab={kpiModal.tab as TabId | undefined} initialState={kpiModal.state} onClose={closeKpi} />;
}

function ModalBody({ def, initialTab, initialState, onClose }: { def: KpiDef; initialTab?: TabId; initialState?: string | null; onClose: () => void }) {
  const { model, month, state: globalState, setMonth } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(initialTab ?? "trend");
  const [focus, setFocus] = useState<string | null>(initialState !== undefined ? initialState : globalState);
  const [oddMode, setOddMode] = useState<"count" | "pct">("count");
  const [bucket, setBucket] = useState<OddBucket | null>(null);

  const tabs = def.group === "watch" ? [...BASE_TABS, { id: "signals" as TabId, label: "Signals" }] : BASE_TABS;
  const a = useMemo(() => assess(model, def, month, focus), [model, def, month, focus]);
  const snap = getSnapshot(model, month, focus);
  const value = snapVal(snap, def.key);
  const pm = prevMonth(model, month);
  const hot = useMemo(() => findHotspot(model, month), [model, month]);
  const drillTarget = focus ?? hot?.state ?? null;
  const pts = series(model, def.key, focus);
  const meaning = kpiMeaning(model, def, month, focus);
  const q = `month=${month}`;

  const goState = (s: string) => {
    onClose();
    router.push(`/states/${stateSlug(s)}?${q}`);
  };

  const crumbs = [def.label, focus ?? "All states", tabs.find((t) => t.id === tab)?.label ?? ""];

  return (
    <Modal
      open
      onClose={onClose}
      header={
        <div className="px-5 pb-4 pt-5 sm:px-7">
          <div className="eyebrow mb-2 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-brand" /> {def.label} — Deep dive
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pr-12">
            <div className="num text-[44px] font-semibold leading-none tracking-tight">{formatCompactKpi(def, value)}</div>
            <div className="flex items-center gap-2 pb-1">
              <Delta value={a.delta?.value ?? null} kind={a.delta?.kind ?? "rel"} tone={a.status === "critical" ? "bad" : a.status === "healthy" ? "good" : "neutral"} className="!text-base" />
              <span className="text-sm text-mute">vs {pm ? monthLabel(pm).split(" ")[0] : "prior month"}</span>
              {a.anomaly && a.status !== "neutral" && <Badge tone={a.status === "critical" ? "bad" : "warn"}>ANOMALY · {a.multiple!.toFixed(1)}× normal move</Badge>}
            </div>
            <div className="ml-auto hidden flex-wrap items-center gap-2 pb-1 md:flex">
              <Badge>{monthLabel(month)}</Badge>
              <Badge tone={focus ? "ink" : "neutral"}>{focus ?? "All states"}</Badge>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs tabs={tabs} value={tab} onChange={setTab} size="sm" />
            <div className="flex items-center gap-1 text-[12px] text-mute">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3" />}
                  <button
                    onClick={() => (i === 1 ? (setFocus(null), setTab("states")) : undefined)}
                    className={cn(i === crumbs.length - 1 ? "font-semibold text-ink" : i === 1 && focus ? "underline decoration-dotted hover:text-ink" : "")}
                  >
                    {c}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      }
    >
      {/* ---------------------------------------------------------------- TREND */}
      {tab === "trend" && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-semibold">{def.label} · {model.months.length ? `${monthShort(model.months[0])}–${monthShort(model.months[model.months.length - 1])}` : ""}</div>
                <div className="text-xs text-mute">{focus ?? "Portfolio"} · click a point to switch the month</div>
              </div>
            </div>
            {pts.filter((p) => p.value !== null).length < 2 ? (
              <div className="py-16 text-center text-sm text-mute">
                {focus ? `${focus}-level history for ${def.label} isn’t in the workbook (only ${pts.filter((p) => p.value !== null).length} month available).` : "Not enough data to draw a trend."}
              </div>
            ) : (
              <TrendChart points={pts} unit={def.unit} selected={month} anomaly={a.anomaly && a.status !== "neutral"} name={def.label} onSelectMonth={setMonth} />
            )}
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label={`Current · ${monthShort(month)}`} value={formatKpiValue(def, value, true)} />
            <Stat label={`Previous · ${pm ? monthShort(pm) : "—"}`} value={formatKpiValue(def, a.delta?.previous ?? null, true)} />
            <Stat label="MoM change" value={a.delta ? (a.delta.kind === "pp" ? fmtPp(a.delta.value) : fmtSignedPct(a.delta.value)) : "—"} tone={a.status === "critical" ? "bad" : a.status === "healthy" ? "good" : undefined} sub={a.baseline !== null ? `Typical move ≈ ${def.unit === "pct" ? fmtPp(a.baseline) : fmtSignedPct(a.baseline)}` : undefined} />
          </div>
          <Card className="flex gap-4 border-brand/60 bg-[#fffaf0] p-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-brand"><Sparkles className="size-4" /></span>
            <div>
              <div className="eyebrow mb-1">Insight</div>
              <p className="text-[14.5px] leading-relaxed text-ink-2">{describeTrend(model, def, month, focus)}</p>
              {meaning && <p className="mt-2 text-[13px] text-mute">{meaning}</p>}
            </div>
          </Card>
          <NextStep question="Where is it coming from?" label="Break down by state" onClick={() => setTab("states")} />
        </div>
      )}

      {/* ---------------------------------------------------------------- STATES */}
      {tab === "states" && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
            <Card className="p-5">
              <div className="mb-3">
                <div className="text-[15px] font-semibold">{def.label} by state · {monthLabel(month)}</div>
                <div className="text-xs text-mute">Click a state to focus the rest of this deep dive on it.</div>
              </div>
              <StateRanking model={model} month={month} def={def} selectedState={focus} onSelect={(s) => setFocus(focus === s ? null : s)} />
            </Card>
            <Card className="p-5">
              <div className="mb-3 text-[15px] font-semibold">State detail</div>
              <StateTable model={model} month={month} selectedState={focus} onSelect={(s) => setFocus(focus === s ? null : s)} />
            </Card>
          </div>
          {drillTarget && (
            <Card className="flex flex-wrap items-center justify-between gap-4 bg-ink p-5 text-white">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{focus ? "Focused state" : "Sharpest growth"}</div>
                <div className="text-lg font-semibold">
                  {drillTarget}
                  {hot?.state === drillTarget && hot.cancelsMoM !== null && <span className="ml-2 text-sm font-medium text-brand">cancellations {fmtSignedPct(hot.cancelsMoM)} vs {pm ? monthShort(pm) : "prior"}</span>}
                </div>
              </div>
              <Button variant="brand" size="lg" onClick={() => goState(drillTarget)}>
                Drill into {drillTarget} <ArrowRight className="size-4" />
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- CHANNELS */}
      {tab === "channels" && (
        <Card className="p-5 sm:p-6">
          <div className="mb-4 text-[15px] font-semibold">Channel breakdown · {monthLabel(month)}</div>
          <ChannelBreakdown model={model} month={month} />
        </Card>
      )}

      {/* ---------------------------------------------------------------- ODD TIMING */}
      {tab === "odd" && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold">When are customers cancelling? · {focus ?? "Portfolio"}</div>
                <div className="text-xs text-mute">Pre / On / Post Original Due Date · click a bar to change month</div>
              </div>
              <Tabs tabs={[{ id: "count", label: "Volume" }, { id: "pct", label: "Share" }]} value={oddMode} onChange={setOddMode} size="sm" />
            </div>
            <ODDTimingChart model={model} state={focus} mode={oddMode} selected={month} focus={bucket} onSelectMonth={setMonth} />
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            {(["pre", "on", "post"] as const).map((b) => {
              const key = b === "pre" ? "prePct" : b === "on" ? "onPct" : "postPct";
              const cnt = b === "pre" ? "preCancels" : b === "on" ? "onCancels" : "postCancels";
              const p = pm ? getSnapshot(model, pm, focus) : null;
              const dd = p && snap[key] !== null && p[key] !== null ? (snap[key] as number) - (p[key] as number) : null;
              return (
                <button key={b} onClick={() => setBucket(bucket === b ? null : b)} className={cn("rounded-2xl border bg-white p-4 text-left transition hover:border-ink", bucket === b ? "border-ink ring-2 ring-brand/50" : "border-line")}>
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-mute"><span className="size-2.5 rounded-full" style={{ background: ODD_COLORS[b] }} />{b === "pre" ? "Pre-ODD" : b === "on" ? "On-ODD" : "Post-ODD"}</div>
                  <div className="mt-1 flex items-baseline gap-2"><span className="num text-2xl font-semibold">{fmtPct0(snap[key])}</span><span className={cn("num text-xs font-semibold", b === "post" && (dd ?? 0) > 0.03 ? "text-bad" : "text-mute")}>{fmtPp(dd)}</span></div>
                  <div className="text-xs text-mute">{fmtInt(snap[cnt])} cancels</div>
                </button>
              );
            })}
          </div>
          <NextStep question="Who owns the miss — customer or company?" label="See classification" onClick={() => setTab("class")} />
        </div>
      )}

      {/* ---------------------------------------------------------------- CLASSIFICATION */}
      {tab === "class" && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="mb-4 text-[15px] font-semibold">Customer Miss · Company Miss · Faux · {focus ?? "Portfolio"} · {monthLabel(month)}</div>
            <CancelClassification model={model} month={month} state={focus} />
          </Card>
          <Card className="p-5 sm:p-6">
            <div className="mb-1 text-[15px] font-semibold">Customer Miss share over time</div>
            <TrendChart points={series(model, "custPct", focus)} unit="pct" selected={month} name="Customer Miss %" height={220} onSelectMonth={setMonth} />
          </Card>
          <NextStep question="Why are customers cancelling?" label="See the drivers" onClick={() => setTab("drivers")} />
        </div>
      )}

      {/* ---------------------------------------------------------------- DRIVERS */}
      {tab === "drivers" && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="mb-3">
              <div className="text-[15px] font-semibold">Customer Miss reasons · {focus ?? "Portfolio"} · {monthLabel(month)}</div>
              <div className="text-xs text-mute">Ranked by volume; chips show change vs prior month. Late-stage readiness reasons are highlighted when they surge.</div>
            </div>
            <CustomerMissDrivers model={model} month={month} state={focus} />
          </Card>
          {def.group === "watch" ? (
            <NextStep question="Could we see it coming?" label="See the signals" onClick={() => setTab("signals")} />
          ) : (
            <NextStep question="Could we have seen it coming?" label="Open Watchtower" onClick={() => { onClose(); router.push(`/watchtower?${q}${focus ? `&state=${stateSlug(focus)}` : ""}`); }} />
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- SIGNALS */}
      {tab === "signals" && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="mb-3 text-[15px] font-semibold">Watchtower state before cancellation · {focus ?? "Portfolio"} · {monthLabel(month)}</div>
            <WatchtowerSignals model={model} month={month} state={focus} />
          </Card>
          <NextStep question="What should we do about it?" label="See recommended actions" onClick={() => { onClose(); router.push(`/actions?${q}`); }} />
        </div>
      )}
    </Modal>
  );
}
