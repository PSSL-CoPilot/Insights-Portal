"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Eye } from "lucide-react";
import { useApp } from "../AppContext";
import { Badge, Card, cn, LinkButton, SectionTitle } from "../ui/primitives";
import { C } from "../charts/shared";
import { assess, findHotspot, getSnapshot, kpiById, nk, prevMonth, reasonStats, REASON_LABELS, watchSignals, type SignalRow } from "@/lib/data/metrics";
import { fmtInt, fmtPct, fmtPct0, fmtPp, monthLabel, monthShort, slugToState, stateSlug } from "@/lib/format";

const SIGNAL_META: Record<SignalRow["id"], { kpi?: string; tone: string; meaning: string }> = {
  noAction: { tone: C.slate, meaning: "No Watchtower warning before the cancellation — these were hard to predict." },
  pending: { kpi: "pending", tone: C.warn, meaning: "Customer contact unresolved — the strongest early-warning signal, and one Brightspeed can act on." },
  action: { kpi: "action", tone: C.indigo, meaning: "Action required even without technical jeopardy." },
  jeopardy: { kpi: "jeopardy", tone: C.lilac, meaning: "Technical installation risk — secondary in this scenario." },
  bsw: { kpi: "bsw", tone: C.lilac, meaning: "Existing predictive BSW-delay model — stays low, so build readiness isn’t the driver." },
};

export function WatchtowerPage() {
  const { model, month, state, openKpi } = useApp();
  const sp = useSearchParams();
  const hot = useMemo(() => findHotspot(model, month), [model, month]);
  const fromUrl = slugToState(sp.get("state") ?? "", model.states);
  const [storyState, setStoryState] = useState<string | null>(fromUrl ?? state ?? hot?.state ?? model.states[0] ?? null);
  useEffect(() => {
    if (fromUrl) setStoryState(fromUrl);
  }, [fromUrl]);

  const sig = watchSignals(model, month, state);
  const pm = prevMonth(model, month);
  const prev = pm ? getSnapshot(model, pm, state) : null;
  const strongest = [...sig].filter((s) => s.actionable && s.pct !== null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  const flagged = sig.filter((s) => s.actionable).reduce((a, s) => a + (s.pct ?? 0), 0);
  const cancels = getSnapshot(model, month, state).cancels;
  const PREV_KEY: Record<string, string> = { noAction: "noActionPct", pending: "pendingPct", action: "actionPct", jeopardy: "jeopardyPct", bsw: "bswPct" };

  return (
    <div className="space-y-9">
      <SectionTitle
        eyebrow={`Watchtower · ${monthLabel(month)} · ${state ?? "Portfolio"}`}
        title="Could we see the cancellation coming?"
        sub="Watchtower’s state of each order before it cancelled. This is the insights-portal interpretation layer — not a replica of Watchtower itself."
      />

      {!sig.some((s) => s.pct !== null) ? (
        <Card className="p-8 text-center text-sm text-mute">Watchtower signal data isn’t in the workbook for {state ?? "the portfolio"} in {monthLabel(month)}. Pick the workbook’s latest month or clear the state filter.</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {sig.map((s, i) => {
              const meta = SIGNAL_META[s.id];
              const key = strongest?.id === s.id;
              const pv = prev ? prev[PREV_KEY[s.id]] : null;
              const d = s.pct !== null && pv !== null && pv !== undefined ? s.pct - pv : null;
              const a = meta.kpi ? assess(model, kpiById(meta.kpi)!, month, state) : null;
              return (
                <button
                  key={s.id}
                  disabled={!meta.kpi}
                  onClick={() => meta.kpi && openKpi(meta.kpi, "signals", state)}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className={cn(
                    "relative animate-rise overflow-hidden rounded-[18px] border p-5 text-left shadow-card transition",
                    meta.kpi && "hover:-translate-y-0.5 hover:shadow-pop",
                    key ? "border-ink bg-ink text-white" : "border-line bg-white",
                  )}
                >
                  {key && <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-brand/30 blur-2xl" />}
                  <div className="relative flex items-start justify-between gap-2">
                    <div className={cn("text-[12px] font-semibold leading-tight", key ? "text-white/70" : "text-mute")}>{s.label}</div>
                    {key && <Badge tone="brand" className="!px-1.5 !py-0 text-[9.5px]">EARLY WARNING</Badge>}
                  </div>
                  <div className="relative mt-3 num text-[42px] font-semibold leading-none">{fmtPct0(s.pct)}</div>
                  <div className={cn("relative mt-2 text-xs", key ? "text-white/60" : "text-mute")}>
                    {s.count !== null ? `≈${fmtInt(s.count)} cancellations` : ""}
                    {d !== null && Math.abs(d) >= 0.005 && <span className={cn("ml-2 font-bold", a?.status === "critical" ? (key ? "text-[#ff8a8e]" : "text-bad") : "")}>{fmtPp(d)}</span>}
                  </div>
                  <div className={cn("relative mt-4 h-1.5 overflow-hidden rounded-full", key ? "bg-white/15" : "bg-[#f0f0eb]")}>
                    <div className="h-full rounded-full" style={{ width: `${(s.pct ?? 0) * 100}%`, background: key ? C.brand : meta.tone }} />
                  </div>
                  <p className={cn("relative mt-3 text-[12px] leading-snug", key ? "text-white/60" : "text-mute")}>{meta.meaning}</p>
                </button>
              );
            })}
          </div>

          <Card className="grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <div className="eyebrow mb-1.5">How many could we have seen coming?</div>
              <div className="flex items-end gap-3">
                <span className="num text-[52px] font-semibold leading-none">{fmtPct0(flagged)}</span>
                <span className="pb-1.5 text-sm text-mute">of {monthShort(month)} cancellations carried a Watchtower warning{cancels ? ` (≈${fmtInt(Math.round(flagged * cancels))} of ${fmtInt(cancels)})` : ""}</span>
              </div>
            </div>
            <p className="text-[14px] leading-relaxed text-ink-2">
              {strongest ? (
                <>
                  <strong>{strongest.label}</strong> alone accounts for {fmtPct0(strongest.pct)}. Customer-contact warnings are materially stronger than technical or BSW risk, so most of what was visible in advance was a <em>customer engagement</em> problem that a rescue workflow can act on.
                </>
              ) : null}
              <span className="mt-2 block text-xs text-soft">Signals describe orders that later cancelled; they show visibility, not proven preventability.</span>
            </p>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line-2 px-6 py-4 text-[15px] font-semibold">Signals by state</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="text-right text-[11px] uppercase tracking-wider text-mute">
                    <th className="px-6 py-2.5 text-left font-semibold">State</th><th className="font-semibold">No action</th><th className="font-semibold">Pending contact</th><th className="font-semibold">Action needed</th><th className="font-semibold">In jeopardy</th><th className="font-semibold">BSW delay</th><th className="px-6 text-left font-semibold">Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {model.watchtower.map((w) => {
                    const isHot = w.state === hot?.state && (w.pendingPct ?? 0) >= 0.4;
                    return (
                      <tr key={w.state} className={cn("border-t border-line-2 text-right", w.isPortfolio && "bg-[#f7f7f3] font-semibold", isHot && "bg-[#fdf3f3]")}>
                        <td className="px-6 py-2.5 text-left font-semibold">{w.state}</td>
                        <td className="num">{fmtPct0(w.noActionPct)}</td>
                        <td className={cn("num font-semibold", isHot && "text-bad")}>{fmtPct0(w.pendingPct)}</td>
                        <td className="num">{fmtPct0(w.actionPct)}</td>
                        <td className="num">{fmtPct0(w.jeopardyPct)}</td>
                        <td className="num">{fmtPct0(w.bswPct)}</td>
                        <td className="px-6 text-left text-xs text-mute">{w.interpretation ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <SignalStory storyState={storyState} setStoryState={setStoryState} />
    </div>
  );
}

// ------------------------------------------------------------------ warning → cancellation story
function SignalStory({ storyState, setStoryState }: { storyState: string | null; setStoryState: (s: string) => void }) {
  const { model, month } = useApp();
  const [active, setActive] = useState(0);
  const s = storyState ? getSnapshot(model, month, storyState) : null;
  const rs = storyState ? reasonStats(model, month, storyState) : [];
  const late = rs.filter((r) => r.lateStage);
  const lateCount = late.reduce((a, r) => a + (r.count ?? 0), 0);
  const lateShare = s?.custMiss ? lateCount / s.custMiss : null;

  if (!s || !storyState) return null;
  const nodes: { title: string; big: string; sub: string; pct: number | null; detail: ReactNode }[] = [
    {
      title: "Warning signal", big: fmtPct0(s.pendingPct), sub: "Pending Customer Contact", pct: s.pendingPct,
      detail: <>Before cancelling, {fmtPct0(s.pendingPct)} of {storyState}’s orders sat in <strong>Pending Customer Contact</strong> — visible to Watchtower, but no automated customer action followed.</>,
    },
    {
      title: "Timing", big: fmtPct0(s.postPct), sub: "Post ODD", pct: s.postPct,
      detail: <>The customer was still un-contacted when the Original Due Date passed: {fmtPct0(s.postPct)} of cancellations happen <strong>after</strong> ODD ({fmtInt(s.postCancels)} orders).</>,
    },
    {
      title: "Classification", big: fmtPct0(s.custPct), sub: "Customer Miss", pct: s.custPct,
      detail: <>{fmtPct0(s.custPct)} are classified <strong>Customer Miss</strong> ({fmtInt(s.custMiss)} orders) versus Company Miss {fmtPct0(s.coPct)} — the customer, not the network, is where the order is lost.</>,
    },
    {
      title: "Reason", big: fmtPct0(lateShare), sub: "No Access · Reschedule · Tech on job", pct: lateShare,
      detail: <>{fmtInt(lateCount)} Customer Miss cancels are <strong>{late.map((r) => r.label).join(", ")}</strong> — late-stage appointment-readiness failures.</>,
    },
    {
      title: "Outcome", big: fmtInt(s.cancels), sub: "Cancellations", pct: 1,
      detail: <>Final failure: <strong>{fmtInt(s.cancels)}</strong> cancellations in {monthLabel(month)} ({fmtPct(s.cancelRate)} cancel rate). Each stage above was an opportunity to intervene.</>,
    },
  ];

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <SectionTitle eyebrow="Warning signal → final cancellation" title="How a warning becomes a cancellation" sub="Click a stage to see what it means. Percentages are shares of the state’s cancellations at each stage — not a tracked per-order path." />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-mute">
          Story for
          <select value={storyState} onChange={(e) => setStoryState(e.target.value)} className="h-9 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold text-ink outline-none hover:border-ink">
            {model.states.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-col items-stretch gap-0 lg:flex-row">
        {nodes.map((n, i) => (
          <div key={n.title} className="flex flex-1 flex-col items-stretch lg:flex-row lg:items-center">
            <button
              onClick={() => setActive(i)}
              className={cn(
                "flex-1 rounded-[18px] border p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-pop",
                active === i ? "border-ink bg-ink text-white" : i === 0 ? "border-warn/50 bg-[#fffaf0]" : "border-line bg-white",
              )}
            >
              <div className={cn("text-[10.5px] font-bold uppercase tracking-wider", active === i ? "text-brand" : "text-mute")}>{i + 1} · {n.title}</div>
              <div className="num mt-2 text-[30px] font-semibold leading-none">{n.big}</div>
              <div className={cn("mt-1.5 text-[12px] leading-snug", active === i ? "text-white/65" : "text-mute")}>{n.sub}</div>
              <div className={cn("mt-3 h-1 overflow-hidden rounded-full", active === i ? "bg-white/15" : "bg-[#eeeee8]")}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (n.pct ?? 0) * 100)}%`, background: active === i ? C.brand : i === 0 ? C.warn : C.indigo }} />
              </div>
            </button>
            {i < nodes.length - 1 && (
              <svg className="mx-auto my-1 h-8 w-8 shrink-0 rotate-90 text-[#b9b9b0] lg:mx-1 lg:my-0 lg:h-6 lg:w-9 lg:rotate-0" viewBox="0 0 36 24" fill="none">
                <path d="M2 12h26" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" style={{ animation: "dash-flow 1s linear infinite" }} />
                <path d="M26 6l8 6-8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <Card className="mt-5 animate-rise p-5 sm:p-6" key={`${active}-${storyState}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-3xl text-[15px] leading-relaxed text-ink-2">{nodes[active].detail}</div>
          <div className="flex flex-wrap gap-2">
            {active === 0 && <LinkButton href={`/cancellations?tab=timing&bucket=post&month=${month}`} size="sm">See timing <Eye className="size-3.5" /></LinkButton>}
            {active === 3 && <LinkButton href={`/cancellations?tab=miss&month=${month}&state=${stateSlug(storyState)}`} size="sm">Review Customer Miss</LinkButton>}
            {active === 4 && <LinkButton href={`/actions?month=${month}#rescue`} variant="primary" size="sm">View Rescue Opportunities</LinkButton>}
            <LinkButton href={`/states/${stateSlug(storyState)}?month=${month}`} size="sm">Open {storyState}</LinkButton>
          </div>
        </div>
      </Card>
    </section>
  );
}
