"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Eye, Lightbulb } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../AppContext";
import { KPICard } from "../kpi/KPICard";
import { CancelClassification } from "../charts/CancelClassification";
import { CustomerMissDrivers } from "../charts/CustomerMissDrivers";
import { WatchtowerSignals } from "../charts/WatchtowerSignals";
import { ODD_COLORS } from "../charts/ODDTimingChart";
import { C, TipCard, axisProps } from "../charts/shared";
import { RescueFlow } from "./RescueFlow";
import { Sparkline } from "../ui/Sparkline";
import { Badge, Button, Card, cn, LinkButton, StatusDot } from "../ui/primitives";
import { assess, findHotspot, getSnapshot, kpiById, monthsUpTo, prevMonth, series } from "@/lib/data/metrics";
import { stateStory, type StoryPoint } from "@/lib/data/narratives";
import { fmtCompact, fmtInt, fmtPct, fmtPct0, fmtPp, fmtSignedPct, monthLabel, monthName, monthShort } from "@/lib/format";

const KPI_STRIP = ["sales", "installs", "cancels", "cancelRate", "post", "cust", "pending", "onTime"] as const;

function GrowthCard({ model, state, month }: { model: ReturnType<typeof useApp>["model"]; state: string; month: string }) {
  const def = kpiById("cancels")!;
  const a = assess(model, def, month, state);
  const pm = prevMonth(model, month);
  const spark = series(model, "cancels", state).filter((p) => p.month <= month).map((p) => p.value);
  return (
    <div className={cn("flex min-h-[158px] flex-col justify-between rounded-[18px] border bg-white p-4 shadow-card", a.status === "critical" ? "border-bad/40" : "border-line")}>
      <div className="flex items-start justify-between"><div className="text-[12px] font-semibold text-mute">Cancel growth vs {pm ? monthName(pm) : "prior"}</div><StatusDot status={a.status} pulse /></div>
      <div className="flex items-end justify-between gap-2">
        <div className="num text-[34px] font-semibold leading-none tracking-tight" style={{ color: a.status === "critical" ? C.bad : undefined }}>{fmtSignedPct(a.delta?.value ?? null)}</div>
        <Sparkline values={spark} color={a.status === "critical" ? C.bad : C.indigo} width={84} height={34} />
      </div>
      <div className="border-t border-line-2 pt-2.5 text-[11.5px] text-mute">{fmtInt(a.delta?.previous ?? null)} → {fmtInt(a.delta?.current ?? null)} cancellations{a.anomaly ? " · anomaly" : ""}</div>
    </div>
  );
}

function Insight({ point }: { point: StoryPoint }) {
  return (
    <div className={cn("mt-5 flex gap-3 rounded-2xl border px-4 py-3.5 text-[14px] leading-relaxed", point.tone === "bad" ? "border-bad/25 bg-bad-soft/60" : point.tone === "good" ? "border-good/25 bg-good-soft/60" : "border-line bg-[#f7f7f3]")}>
      <Lightbulb className={cn("mt-0.5 size-4 shrink-0", point.tone === "bad" ? "text-bad" : "text-mute")} />
      <p className="text-ink-2">{point.text}</p>
    </div>
  );
}

interface StepDef {
  id: string;
  title: string;
  question: string;
  render: () => ReactNode;
}

export function StateDrilldown({ state }: { state: string }) {
  const { model, month, openKpi } = useApp();
  const pm = prevMonth(model, month);
  const cur = getSnapshot(model, month, state);
  const prev = pm ? getSnapshot(model, pm, state) : null;
  const port = getSnapshot(model, month, null);
  const story = useMemo(() => stateStory(model, month, state), [model, month, state]);
  const hot = findHotspot(model, month);
  const isHot = hot?.state === state && (assess(model, kpiById("cancels")!, month, state).delta?.value ?? 0) > 0.15;
  const cancelMoM = assess(model, kpiById("cancels")!, month, state);
  const [unlocked, setUnlocked] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  // reset the reveal when the state or month changes
  useEffect(() => {
    setUnlocked(1);
    setShowAll(false);
  }, [state, month]);

  // ---------------- step 1 data: Aug vs Sep clustered bars + indexed trend
  const compare = [
    { name: "Unique Sales", a: prev?.sales ?? null, b: cur.sales, unit: "n" },
    { name: "Installs", a: prev?.installs ?? null, b: cur.installs, unit: "n" },
    { name: "Cancellations", a: prev?.cancels ?? null, b: cur.cancels, unit: "n", hot: true },
    { name: "Cancel rate", a: prev?.cancelRate ?? null, b: cur.cancelRate, unit: "p" },
  ];
  const idx = useMemo(() => {
    const s = series(model, "sales", state), c = series(model, "cancels", state), i = series(model, "installs", state);
    const b = (arr: typeof s) => arr[0]?.value ?? null;
    return model.months.filter((m) => m <= month).map((m, k) => {
      const f = (arr: typeof s) => (arr[k].value !== null && b(arr) ? (arr[k].value! / b(arr)!) * 100 : null);
      return { label: monthShort(m), Sales: f(s), Installs: f(i), Cancellations: f(c) };
    });
  }, [model, state, month]);

  // ---------------- step 2 data: pre/on/post for prev vs cur
  const timing = [
    { label: pm ? monthName(pm) : "Prior", ...pick(prev) },
    { label: monthName(month), ...pick(cur) },
  ].filter((r) => r.pre !== null);

  const steps: StepDef[] = [
    {
      id: "change",
      title: `How did ${state} change?`,
      question: `${pm ? monthName(pm) : "Prior"} vs ${monthName(month)}`,
      render: () => (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {compare.map((c) => (
              <div key={c.name} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="eyebrow">{c.name}</div>
                  {c.a !== null && c.b !== null && (
                    <span className={cn("num text-xs font-bold", c.hot ? "text-bad" : "text-mute")}>{c.unit === "p" ? fmtPp(c.b - c.a, 1) : fmtSignedPct(c.b / c.a - 1)}</span>
                  )}
                </div>
                <div className="num mt-1 text-2xl font-semibold">{c.unit === "p" ? fmtPct(c.b) : fmtCompact(c.b)}</div>
                <div className="h-[110px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ n: pm ? monthShort(pm) : "Prior", v: c.a }, { n: monthShort(month), v: c.b }]} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="30%">
                      <XAxis dataKey="n" {...axisProps} />
                      <YAxis hide domain={[0, "dataMax"]} />
                      <Tooltip cursor={false} content={({ active, payload }) => active && payload?.length ? <TipCard title={c.name} rows={[{ label: String(payload[0].payload.n), value: c.unit === "p" ? fmtPct(payload[0].payload.v) : fmtInt(payload[0].payload.v) }]} /> : null} />
                      <Bar dataKey="v" radius={[8, 8, 0, 0]} animationDuration={700}>
                        <Cell fill={C.slate} />
                        <Cell fill={c.hot ? C.bad : C.indigo} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-line bg-white p-4">
            <div className="mb-1 text-[13px] font-semibold">Growth since {monthShort(model.months[0])} (indexed, {monthShort(model.months[0])} = 100)</div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={idx} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="label" {...axisProps} dy={6} />
                  <YAxis {...axisProps} width={40} domain={["dataMin - 5", "dataMax + 5"]} tickFormatter={(v) => String(Math.round(v))} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? <TipCard title={String(label)} rows={payload.map((p) => ({ label: String(p.name), value: Number(p.value).toFixed(0), color: String(p.color) }))} /> : null} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Sales" stroke={C.slateDeep} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Installs" stroke={C.lilac} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Cancellations" stroke={C.bad} strokeWidth={2.75} dot={{ r: 3, fill: "#fff", stroke: C.bad, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <Insight point={story.change} />
        </>
      ),
    },
    {
      id: "when",
      title: "When are customers cancelling?",
      question: "Pre · On · Post ODD",
      render: () => (
        <>
          <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
            <div className="flex flex-col justify-center rounded-2xl bg-ink p-6 text-white">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Post-ODD share · {monthName(month)}</div>
              <div className="num mt-2 text-[64px] font-semibold leading-none text-brand">{fmtPct0(cur.postPct)}</div>
              <div className="mt-2 text-sm text-white/70">
                {fmtInt(cur.postCancels)} of {fmtInt(cur.cancels)} cancellations after the Original Due Date
                {prev?.postPct != null && <> · was {fmtPct0(prev.postPct)} in {monthShort(pm!)}</>}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {(["pre", "on", "post"] as const).map((b) => (
                  <div key={b} className="rounded-xl bg-white/[0.08] px-2 py-2.5">
                    <div className="text-[10.5px] uppercase tracking-wider text-white/50">{b}-ODD</div>
                    <div className="num text-lg font-semibold">{fmtPct0(cur[`${b}Pct`])}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <div className="mb-2 text-[13px] font-semibold">Share of cancellations by timing</div>
              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timing} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }} barSize={38}>
                    <XAxis type="number" hide domain={[0, 1]} />
                    <YAxis type="category" dataKey="label" {...axisProps} width={78} tick={{ fill: "#3a3a36", fontSize: 12.5, fontWeight: 600 }} />
                    <Tooltip cursor={false} content={({ active, payload }) => active && payload?.length ? <TipCard title={String(payload[0].payload.label)} rows={[{ label: "Post-ODD", value: fmtPct0(payload[0].payload.post), color: ODD_COLORS.post }, { label: "On-ODD", value: fmtPct0(payload[0].payload.on), color: ODD_COLORS.on }, { label: "Pre-ODD", value: fmtPct0(payload[0].payload.pre), color: ODD_COLORS.pre }]} /> : null} />
                    <Bar dataKey="pre" stackId="s" fill={ODD_COLORS.pre} name="Pre-ODD" radius={[10, 0, 0, 10]} label={{ position: "center", formatter: (v: unknown) => fmtPct0(Number(v)), fontSize: 11, fill: "#333" }} />
                    <Bar dataKey="on" stackId="s" fill={ODD_COLORS.on} name="On-ODD" label={{ position: "center", formatter: (v: unknown) => fmtPct0(Number(v)), fontSize: 11, fill: "#333" }} />
                    <Bar dataKey="post" stackId="s" fill={ODD_COLORS.post} name="Post-ODD" radius={[0, 10, 10, 0]} label={{ position: "center", formatter: (v: unknown) => fmtPct0(Number(v)), fontSize: 12, fontWeight: 700, fill: "#fff" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <Insight point={story.timing} />
        </>
      ),
    },
    {
      id: "who",
      title: "Who is driving the miss?",
      question: "Customer · Company · Faux",
      render: () => (
        <>
          <Card className="p-5 sm:p-6"><CancelClassification model={model} month={month} state={state} /></Card>
          <Insight point={story.who} />
        </>
      ),
    },
    {
      id: "why",
      title: "Why are customers cancelling?",
      question: "Customer Miss reasons",
      render: () => (
        <>
          <Card className="p-5 sm:p-6"><CustomerMissDrivers model={model} month={month} state={state} /></Card>
          <Insight point={story.why} />
        </>
      ),
    },
    {
      id: "seen",
      title: "Could we see it coming?",
      question: "Watchtower signals",
      render: () => (
        <>
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card className="p-5 sm:p-6">
              <div className="mb-3 text-[13px] font-semibold">Watchtower state of {state}’s cancellations</div>
              <WatchtowerSignals model={model} month={month} state={state} />
            </Card>
            <Card className="flex flex-col justify-center p-6">
              <div className="eyebrow mb-2">Pending Customer Contact</div>
              <div className="flex items-end gap-3">
                <span className="num text-[52px] font-semibold leading-none">{fmtPct0(cur.pendingPct)}</span>
                {prev?.pendingPct != null && cur.pendingPct !== null && <span className="num pb-1.5 text-base font-bold text-bad">{fmtPp(cur.pendingPct - prev.pendingPct)}</span>}
              </div>
              <div className="mt-2 text-sm text-mute">Portfolio: {fmtPct0(port.pendingPct)} · BSW Delay Predicted {fmtPct0(cur.bswPct)} · Install in Jeopardy {fmtPct0(cur.jeopardyPct)}</div>
              <div className="mt-4 h-px bg-line" />
              <p className="mt-4 text-[13px] leading-relaxed text-mute">A major early-warning signal: unresolved customer contact is visible <strong className="text-ink">before</strong> the customer cancels.</p>
            </Card>
          </div>
          <Insight point={story.seen} />
        </>
      ),
    },
    {
      id: "do",
      title: "What should we do?",
      question: "Recommended action",
      render: () => (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card className="p-6">
            <Badge tone="brand" className="mb-3">RECOMMENDED ACTION</Badge>
            <h4 className="text-[22px] font-semibold leading-tight tracking-tight">Post-ODD Customer Rescue Workflow</h4>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
              {story.verdict === "customer-readiness"
                ? `${state}’s cancellations are a customer engagement and appointment-readiness problem, not a network one. Intervene at the first missed or rescheduled ODD — before the customer becomes unreachable.`
                : `Use the workflow below as the first response to late-stage cancellations in ${state}, and monitor whether operational signals need separate attention.`}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[#f7f7f3] p-3"><dt className="eyebrow">Population</dt><dd className="num mt-1 text-xl font-semibold">{fmtInt(cur.postCancels)}</dd><dd className="text-xs text-mute">Post-ODD cancels</dd></div>
              <div className="rounded-xl bg-[#f7f7f3] p-3"><dt className="eyebrow">Addressable core</dt><dd className="num mt-1 text-xl font-semibold">{fmtInt(["noaccessnothome", "customerrequestedreschedule", "cancelledwhiletechonjob"].reduce((a, k) => a + (cur[`reason:${k}`] ?? 0), 0))}</dd><dd className="text-xs text-mute">No-access, reschedule, tech-on-job</dd></div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href={`/actions?month=${month}#rescue`} variant="primary" size="lg">View Rescue Opportunities</LinkButton>
              <LinkButton href={`/watchtower?month=${month}&state=${encodeURIComponent(state.toLowerCase().replace(/\s+/g, "-"))}`} size="lg">Warning-signal story</LinkButton>
            </div>
          </Card>
          <Card className="bg-[#fbfaf5] p-6"><RescueFlow compact /></Card>
        </div>
      ),
    },
  ];

  const visible = showAll ? steps.length : unlocked;
  const unlock = (n: number) => {
    setUnlocked((u) => Math.max(u, n));
    setTimeout(() => refs.current[n - 1]?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/states?month=${month}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-mute transition hover:text-ink"><ArrowLeft className="size-3.5" /> All states</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[38px] font-semibold uppercase leading-none tracking-tight">{state}</h2>
              {isHot && <Badge tone="bad" className="animate-pulse-ring">HOTSPOT</Badge>}
            </div>
            <div className="mt-2 text-[15px] text-mute">{monthLabel(month)}</div>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-mute">
            <StatusDot status={cancelMoM.status} pulse /> Cancellations {fmtSignedPct(cancelMoM.delta?.value ?? null)} vs {pm ? monthShort(pm) : "prior"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
        {KPI_STRIP.slice(0, 5).map((id, i) => (
          <KPICard key={id} def={kpiById(id)!} model={model} month={month} state={state} onClick={() => openKpi(id, "trend", state)} delay={i * 40} />
        ))}
        <GrowthCard model={model} state={state} month={month} />
        {KPI_STRIP.slice(5).map((id, i) => (
          <KPICard key={id} def={kpiById(id)!} model={model} month={month} state={state} onClick={() => openKpi(id, "trend", state)} delay={(i + 6) * 40} />
        ))}
      </div>
      <p className="-mt-4 text-xs text-mute">Pending Customer Contact and On-Time Install are only provided by the workbook for its drill month. Click any card for its deep dive.</p>

      {/* progressive story */}
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <button key={s.id} disabled={i + 1 > visible} onClick={() => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" })} title={s.title}
                className={cn("grid size-8 place-items-center rounded-full border text-xs font-bold transition", i + 1 <= visible ? "border-ink bg-ink text-white" : "border-line bg-white text-soft")}>
                {i + 1 < visible || showAll ? <Check className="size-3.5" /> : i + 1}
              </button>
            ))}
          </div>
          {!showAll && unlocked < steps.length && (
            <button onClick={() => setShowAll(true)} className="flex items-center gap-1.5 text-xs font-semibold text-mute hover:text-ink"><Eye className="size-3.5" /> Reveal the full story</button>
          )}
        </div>

        <div className="space-y-6">
          {steps.slice(0, visible).map((s, i) => (
            <div key={s.id} ref={(el) => { refs.current[i] = el; }} className="animate-rise scroll-mt-24">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-bold text-ink">{i + 1}</span>
                <div>
                  <h3 className="text-[22px] font-semibold tracking-tight">{s.title}</h3>
                  <div className="eyebrow">{s.question}</div>
                </div>
              </div>
              {s.render()}
              {i + 1 === visible && i + 1 < steps.length && !showAll && (
                <div className="mt-6 flex justify-center">
                  <Button variant="primary" size="lg" onClick={() => unlock(i + 2)}>
                    Next: {steps[i + 1].title} <ArrowRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function pick(s: ReturnType<typeof getSnapshot> | null) {
  return { pre: s?.prePct ?? null, on: s?.onPct ?? null, post: s?.postPct ?? null };
}
