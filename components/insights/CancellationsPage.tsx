"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Flame } from "lucide-react";
import { useApp } from "../AppContext";
import { ODDTimingChart, ODD_COLORS, type OddBucket } from "../charts/ODDTimingChart";
import { TrendChart } from "../charts/TrendChart";
import { StateRanking } from "../charts/StateRanking";
import { CancelClassification, CLASS_COLORS } from "../charts/CancelClassification";
import { CustomerMissDrivers } from "../charts/CustomerMissDrivers";
import { C, TipCard, axisProps } from "../charts/shared";
import { Badge, Card, cn, SectionTitle, Tabs } from "../ui/primitives";
import { Sparkline } from "../ui/Sparkline";
import { assess, getSnapshot, kpiById, prevMonth, reasonAnnotation, reasonStats, series } from "@/lib/data/metrics";
import { diagnose } from "@/lib/data/narratives";
import { fmtInt, fmtPct, fmtPct0, fmtPp, fmtSignedPct, monthLabel, monthName, monthShort } from "@/lib/format";

type Tab = "timing" | "miss" | "class";
const TABS: { id: Tab; label: string }[] = [
  { id: "timing", label: "Cancellation Timing" },
  { id: "miss", label: "Customer Miss" },
  { id: "class", label: "Classification" },
];
const BUCKETS: { id: OddBucket; label: string; cnt: string; blurb: string }[] = [
  { id: "pre", label: "PRE ODD", cnt: "preCancels", blurb: "Before the Original Due Date" },
  { id: "on", label: "ON ODD", cnt: "onCancels", blurb: "On the Original Due Date" },
  { id: "post", label: "POST ODD", cnt: "postCancels", blurb: "After the Original Due Date" },
];

export function CancellationsPage() {
  const sp = useSearchParams();
  const rawTab = sp.get("tab");
  const [tab, setTab] = useState<Tab>(rawTab === "miss" || rawTab === "class" ? rawTab : "timing");
  useEffect(() => {
    if (rawTab === "timing" || rawTab === "miss" || rawTab === "class") setTab(rawTab);
  }, [rawTab]);
  const bucket = sp.get("bucket");

  return (
    <div className="space-y-7">
      <SectionTitle
        eyebrow="Cancellations"
        title={tab === "timing" ? "When are customers cancelling?" : tab === "miss" ? "Why are customers cancelling?" : "Who owns the miss?"}
        right={<Tabs tabs={TABS} value={tab} onChange={setTab} />}
      />
      {tab === "timing" && <TimingView initialBucket={bucket === "pre" || bucket === "on" || bucket === "post" ? bucket : null} />}
      {tab === "miss" && <CustomerMissView />}
      {tab === "class" && <ClassView />}
    </div>
  );
}

const Note = ({ children }: { children: ReactNode }) => <p className="mt-4 rounded-xl bg-[#f7f7f3] px-3.5 py-2.5 text-xs text-mute">{children}</p>;

// ------------------------------------------------------------------ timing
function TimingView({ initialBucket }: { initialBucket: OddBucket | null }) {
  const { model, month, state, setMonth } = useApp();
  const [mode, setMode] = useState<"count" | "pct">("count");
  const [bucket, setBucket] = useState<OddBucket | null>(initialBucket);
  const [sub, setSub] = useState<"trend" | "states" | "class" | "reasons">("trend");
  const pm = prevMonth(model, month);
  const s = getSnapshot(model, month, state);
  const p = pm ? getSnapshot(model, pm, state) : null;
  const shift = s.postPct !== null && p?.postPct != null ? s.postPct - p.postPct : null;
  const b = BUCKETS.find((x) => x.id === bucket);

  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold">Pre / On / Post ODD · {state ?? "Portfolio"}</div>
            {shift !== null && Math.abs(shift) >= 0.03 && (
              <div className="mt-1 flex items-center gap-2 text-[13px] text-mute">
                <Flame className="size-4 text-bad" />
                <span>
                  <strong className="text-ink">{monthName(month)}: structural shift.</strong> Post-ODD share {fmtPct0(p?.postPct)} → {fmtPct0(s.postPct)} ({fmtPp(shift)}); Pre-ODD {fmtPct0(p?.prePct)} → {fmtPct0(s.prePct)}.
                </span>
              </div>
            )}
          </div>
          <Tabs tabs={[{ id: "count", label: "Volume" }, { id: "pct", label: "Share" }]} value={mode} onChange={setMode} size="sm" />
        </div>
        <ODDTimingChart model={model} state={state} mode={mode} selected={month} focus={bucket} height={340} onSelectMonth={setMonth} />
        <p className="mt-1 text-xs text-soft">The selected month is emphasised. Click a bar to change the month; click a card below to focus a bucket.</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {BUCKETS.map((x) => {
          const key = `${x.id}Pct`;
          const spark = series(model, key, state).filter((q) => q.month <= month).map((q) => q.value);
          const cur = s[key];
          const prev = p ? p[key] : null;
          const d = cur !== null && prev !== null && prev !== undefined ? cur - prev : null;
          const hot = x.id === "post" && (d ?? 0) > 0.05;
          return (
            <button
              key={x.id}
              onClick={() => setBucket(bucket === x.id ? null : x.id)}
              className={cn("rounded-[18px] border p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-pop", hot ? "border-ink bg-ink text-white" : "border-line bg-white", bucket === x.id && "ring-2 ring-brand")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12px] font-bold tracking-wider" style={{ color: hot ? "#FFC72C" : undefined }}>
                  <span className="size-2.5 rounded-full" style={{ background: ODD_COLORS[x.id] }} />
                  {x.label}
                </div>
                {hot && <Badge tone="brand">DOMINANT</Badge>}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="num text-[46px] font-semibold leading-none">{fmtPct0(cur)}</div>
                  <div className={cn("mt-2 text-[13px]", hot ? "text-white/60" : "text-mute")}>
                    {fmtInt(s[x.cnt])} cancellations · {fmtPp(d)} MoM
                  </div>
                </div>
                <Sparkline values={spark} color={hot ? "#FFC72C" : "#5b5fe6"} width={92} height={40} />
              </div>
              <div className={cn("mt-3 text-xs", hot ? "text-white/50" : "text-soft")}>{x.blurb}</div>
            </button>
          );
        })}
      </div>

      {b && (
        <Card className="animate-rise p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[17px] font-semibold">{b.label} — drill-down</div>
            <Tabs
              tabs={[{ id: "trend", label: "Monthly trend" }, { id: "states", label: "States" }, { id: "class", label: "Classification" }, { id: "reasons", label: "Reasons" }]}
              value={sub}
              onChange={setSub}
              size="sm"
            />
          </div>
          {sub === "trend" && (
            <TrendChart
              points={series(model, `${b.id}Pct`, state)}
              unit="pct"
              selected={month}
              name={`${b.label} share`}
              anomaly={b.id === "post" && assess(model, kpiById("post")!, month, state).status === "critical"}
              onSelectMonth={setMonth}
              height={260}
            />
          )}
          {sub === "states" && <StateRanking model={model} month={month} def={kpiById(b.id)!} />}
          {sub === "class" && (
            <>
              <CancelClassification model={model} month={month} state={state} />
              <Note>The workbook classifies cancellations by month and state, not by timing bucket — this is the classification of all cancellations in the selection.</Note>
            </>
          )}
          {sub === "reasons" && (
            <>
              <CustomerMissDrivers model={model} month={month} state={state} />
              <Note>Reasons are provided per state and month, not per timing bucket — showing all Customer Miss reasons for the selection.</Note>
            </>
          )}
        </Card>
      )}
    </>
  );
}

// ------------------------------------------------------------------ customer miss
function CustomerMissView() {
  const { model, month, state, setState, setMonth } = useApp();
  const pm = prevMonth(model, month);
  const s = getSnapshot(model, month, state);
  const p = pm ? getSnapshot(model, pm, state) : null;
  const stats = useMemo(() => reasonStats(model, month, state), [model, month, state]);
  const d = useMemo(() => diagnose(model, month), [model, month]);
  const pattern = d.anomaly && d.hotspot && state === d.hotspot.state && stats.some((r) => r.lateStage && (r.mom ?? 0) > 0.5);
  const total = stats.reduce((a, r) => a + (r.count ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Month" value={month} onChange={setMonth} options={[...model.months].reverse().map((m) => ({ v: m, l: monthLabel(m) }))} />
        <FilterSelect label="State" value={state ?? ""} onChange={(v) => setState(v || null)} options={[{ v: "", l: "All states" }, ...model.states.map((x) => ({ v: x, l: x }))]} />
      </div>

      {pattern && (
        <Card className="animate-rise border-bad/30 bg-[#fffafa] p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bad text-white">
              <Flame className="size-4" />
            </span>
            <div>
              <div className="text-[15px] font-semibold">Scenario 2 customer-readiness pattern detected in {state}</div>
              <p className="mt-1 text-sm text-ink-2">
                {stats.filter((r) => r.lateStage && (r.mom ?? 0) > 0.25).map((r) => `${r.label} ${fmtSignedPct(r.mom)}`).join(" · ")} — customers not available, rescheduling, or cancelling with the technician on site, alongside a {fmtPct0(s.postPct)} Post-ODD share.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatBox label="Customer Miss cancellations" value={fmtInt(s.custMiss)} sub={p?.custMiss != null && s.custMiss !== null ? `${fmtSignedPct(s.custMiss / p.custMiss - 1)} vs ${monthShort(pm!)}` : undefined} tone="bad" />
        <StatBox label="Customer Miss share" value={fmtPct(s.custPct)} sub={p?.custPct != null && s.custPct !== null ? `${fmtPp(s.custPct - p.custPct)} vs ${monthShort(pm!)}` : undefined} />
        <StatBox label="With a named reason" value={fmtInt(total)} sub={s.custMiss ? `${fmtPct0(total / s.custMiss)} of Customer Miss` : undefined} />
      </div>

      <Card className="p-5 sm:p-6">
        <div className="mb-1 text-[15px] font-semibold">Customer Miss trend · {state ?? "Portfolio"}</div>
        <TrendChart points={series(model, "custMiss", state)} unit="count" selected={month} name="Customer Miss cancels" anomaly={assess(model, kpiById("cust")!, month, state).anomaly} onSelectMonth={setMonth} height={260} />
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-3 text-[15px] font-semibold">Ranked drivers · {monthLabel(month)}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-right text-[11px] uppercase tracking-wider text-mute">
                <th className="pb-2 text-left font-semibold">#</th>
                <th className="pb-2 text-left font-semibold">Reason</th>
                <th className="pb-2 font-semibold">Count</th>
                <th className="pb-2 font-semibold">Share</th>
                <th className="pb-2 font-semibold">Prior</th>
                <th className="pb-2 font-semibold">MoM</th>
                <th className="pb-2 pl-4 text-left font-semibold">Workbook note</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((r, i) => {
                const hot = r.lateStage && (r.mom ?? 0) > 0.25;
                const anno = state ? reasonAnnotation(model, month, state, r.label) : null;
                return (
                  <tr key={r.key} className={cn("border-t border-line-2 text-right", hot && "bg-[#fdf3f3]")}>
                    <td className="py-2.5 text-left text-mute">{i + 1}</td>
                    <td className="py-2.5 text-left font-semibold">
                      {r.label} {hot && <Badge tone="bad" className="ml-1 !px-1.5 !py-0 text-[9.5px]">HOTSPOT</Badge>}
                    </td>
                    <td className="num py-2.5 font-semibold">{fmtInt(r.count)}</td>
                    <td className="num py-2.5">{fmtPct0(r.share)}</td>
                    <td className="num py-2.5 text-mute">{fmtInt(r.prevCount)}</td>
                    <td className={cn("num py-2.5 font-semibold", (r.mom ?? 0) > 0.25 ? "text-bad" : "text-mute")}>{fmtSignedPct(r.mom)}</td>
                    <td className="py-2.5 pl-4 text-left text-xs text-mute">{anno?.insight ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-5 sm:p-6">
        <div className="mb-3 text-[15px] font-semibold">Driver mix</div>
        <CustomerMissDrivers model={model} month={month} state={state} showInsight={false} />
      </Card>
    </div>
  );
}

function StatBox({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bad" }) {
  return (
    <Card className="p-5">
      <div className="eyebrow">{label}</div>
      <div className="num mt-2 text-[34px] font-semibold leading-none">{value}</div>
      {sub && <div className={cn("mt-2 text-[13px]", tone === "bad" && sub.startsWith("+") ? "font-semibold text-bad" : "text-mute")}>{sub}</div>}
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-[12px] font-semibold text-mute">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold text-ink outline-none hover:border-ink focus:border-ink">
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

// ------------------------------------------------------------------ classification
function ClassView() {
  const { model, month, state } = useApp();
  const data = model.months.map((m) => {
    const s = getSnapshot(model, m, state);
    return { label: monthShort(m), "Customer Miss": s.custPct, "Company Miss": s.coPct, Faux: s.fauxPct };
  });
  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="mb-4 text-[15px] font-semibold">
          {state ?? "Portfolio"} · {monthLabel(month)}
        </div>
        <CancelClassification model={model} month={month} state={state} />
      </Card>
      <Card className="p-5 sm:p-6">
        <div className="mb-2 text-[15px] font-semibold">Share of cancellations over time</div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" {...axisProps} dy={6} />
              <YAxis {...axisProps} width={44} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip content={({ active, payload, label }) => (active && payload?.length ? <TipCard title={String(label)} rows={payload.map((q) => ({ label: String(q.name), value: fmtPct(Number(q.value)), color: String(q.color) }))} /> : null)} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Customer Miss" stroke={CLASS_COLORS.cust} strokeWidth={2.75} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Company Miss" stroke={CLASS_COLORS.co} strokeWidth={2.25} dot={false} />
              <Line type="monotone" dataKey="Faux" stroke={C.slateDeep} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
