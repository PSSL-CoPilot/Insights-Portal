/**
 * Data-driven storytelling: executive summary, diagnosis, insights and recommended actions.
 * All numbers are read from the workbook-backed model at call time. Text templates only choose
 * *which* sentences apply based on what the data shows.
 */
import type { DataModel, MonthKey } from "./types";
import {
  assess, findHotspot, getSnapshot, kpiById, kpiDelta, nk, prevMonth, reasonStats, stateRows, excessCancels,
  type StateRow, REASON_LABELS,
} from "./metrics";
import { fmtInt, fmtPct, fmtPct0, fmtPp, fmtSignedPct, monthName, monthShort } from "../format";

export type RootCause = "customer-readiness" | "operational" | "mixed" | "stable" | "insufficient";

export interface Diagnosis {
  month: MonthKey;
  prev: MonthKey | null;
  cancelsMoM: number | null;
  salesMoM: number | null;
  installsMoM: number | null;
  anomaly: boolean;
  cancelRate: number | null;
  prevCancelRate: number | null;
  postPct: number | null;
  prevPostPct: number | null;
  postCancels: number | null;
  prevPostCancels: number | null;
  custPct: number | null;
  dominantClass: { label: string; pct: number } | null;
  pendingPct: number | null;
  pendingDelta: number | null;
  bswPct: number | null;
  jeopardyPct: number | null;
  hotspot: StateRow | null;
  runnerUpGrowth: number | null;
  lateDrivers: { label: string; count: number; mom: number }[];
  excess: ReturnType<typeof excessCancels>;
  rootCause: RootCause;
}

export function diagnose(model: DataModel, month: MonthKey): Diagnosis {
  const prev = prevMonth(model, month);
  const cur = getSnapshot(model, month, null);
  const pv = prev ? getSnapshot(model, prev, null) : null;
  const rel = (a: number | null, b: number | null | undefined) => (a !== null && b ? a / b - 1 : null);
  const cancelsDef = kpiById("cancels")!;
  const anomaly = assess(model, cancelsDef, month, null).anomaly && (kpiDelta(model, cancelsDef, month, null)?.value ?? 0) > 0;

  const hotspot = findHotspot(model, month);
  const others = stateRows(model, month).filter((r) => r.state !== hotspot?.state).map((r) => r.cancelsMoM).filter((x): x is number => x !== null);

  const classes = [
    { label: "Customer Miss", pct: cur.custPct },
    { label: "Company Miss", pct: cur.coPct },
    { label: "Faux Cancel", pct: cur.fauxPct },
  ].filter((c): c is { label: string; pct: number } => c.pct !== null).sort((a, b) => b.pct - a.pct);

  const lateDrivers = reasonStats(model, month, null)
    .filter((r) => r.mom !== null && r.count !== null && r.mom > 0.25)
    .sort((a, b) => (b.mom ?? 0) - (a.mom ?? 0))
    .slice(0, 3)
    .map((r) => ({ label: r.label, count: r.count as number, mom: r.mom as number }));

  const pendingDelta = cur.pendingPct !== null && pv?.pendingPct != null ? cur.pendingPct - pv.pendingPct : null;
  const bswDelta = cur.bswPct !== null && pv?.bswPct != null ? cur.bswPct - pv.bswPct : null;
  const jeoDelta = cur.jeopardyPct !== null && pv?.jeopardyPct != null ? cur.jeopardyPct - pv.jeopardyPct : null;
  const postShift = cur.postPct !== null && pv?.postPct != null ? cur.postPct - pv.postPct : null;
  const coDelta = cur.coPct !== null && pv?.coPct != null ? cur.coPct - pv.coPct : null;

  let rootCause: RootCause = "insufficient";
  if (!prev) rootCause = "insufficient";
  else if (!anomaly) rootCause = "stable";
  else {
    const customerLed = (cur.custPct ?? 0) >= 0.5 && (pendingDelta ?? 0) > 0 && (pendingDelta ?? 0) > Math.max(bswDelta ?? 0, jeoDelta ?? 0, 0) && (postShift ?? 0) > 0;
    const opsLed = (bswDelta ?? 0) > 0.02 || (jeoDelta ?? 0) > 0.02 || (coDelta ?? 0) > 0.03;
    rootCause = customerLed && !opsLed ? "customer-readiness" : opsLed && !customerLed ? "operational" : "mixed";
  }

  return {
    month, prev,
    cancelsMoM: rel(cur.cancels, pv?.cancels), salesMoM: rel(cur.sales, pv?.sales), installsMoM: rel(cur.installs, pv?.installs),
    anomaly, cancelRate: cur.cancelRate, prevCancelRate: pv?.cancelRate ?? null,
    postPct: cur.postPct, prevPostPct: pv?.postPct ?? null, postCancels: cur.postCancels, prevPostCancels: pv?.postCancels ?? null,
    custPct: cur.custPct, dominantClass: classes[0] ?? null,
    pendingPct: cur.pendingPct, pendingDelta, bswPct: cur.bswPct, jeopardyPct: cur.jeopardyPct,
    hotspot, runnerUpGrowth: others.length ? Math.max(...others) : null, lateDrivers,
    excess: excessCancels(model, month), rootCause,
  };
}

// ------------------------------------------------------------------ executive summary
export interface ExecSummary {
  headline: string;
  /** Paragraphs; `**bold**` marks data-derived figures to emphasise. */
  paragraphs: string[];
  rootCause: RootCause;
  chips: { label: string; value: string; tone: "bad" | "good" | "neutral" }[];
}

const shortReason = (l: string) => (nk(l) === nk(REASON_LABELS.resched) ? "Customer Reschedules" : nk(l) === nk(REASON_LABELS.tech) ? "Cancelled while Tech on Job" : l);

export function executiveSummary(model: DataModel, month: MonthKey): ExecSummary {
  const d = diagnose(model, month);
  const M = monthName(month);
  const paras: string[] = [];
  const chips: ExecSummary["chips"] = [];

  if (!d.prev || d.cancelsMoM === null) {
    return {
      headline: `${M}: baseline month`,
      paragraphs: [`${M} is the first month in the workbook, so no month-over-month comparison is possible. Select a later month to see what changed.`],
      rootCause: "insufficient", chips,
    };
  }

  const cm = fmtSignedPct(d.cancelsMoM);
  const sm = fmtSignedPct(d.salesMoM);
  if (d.anomaly) {
    const outpaces = (d.salesMoM ?? 0) < d.cancelsMoM / 2;
    let p1 = `**${M} cancellations ${d.cancelsMoM >= 0 ? "increased" : "changed"} ${cm.replace("+", "")}** while Unique Sales moved only **${sm}**, ${outpaces ? "indicating that the deterioration is **not explained by sales growth**" : "so sales growth explains only part of the change"}.`;
    p1 += ` Cancel rate ${(d.cancelRate ?? 0) > (d.prevCancelRate ?? 0) ? "rose" : "fell"} to **${fmtPct(d.cancelRate)}** from ${fmtPct(d.prevCancelRate)}`;
    if (d.installsMoM !== null && d.installsMoM < 0) p1 += `, and installs fell ${fmtSignedPct(d.installsMoM).replace("−", "")} despite higher sales`;
    paras.push(p1 + ".");

    if (d.postPct !== null && d.prevPostPct !== null) {
      const shift = d.postPct - d.prevPostPct;
      paras.push(
        shift > 0.03
          ? `The cancellation mix shifted significantly toward **Post-ODD**, which now represents **${fmtPct0(d.postPct)}** of cancellations (from ${fmtPct0(d.prevPostPct)})${d.postCancels !== null && d.prevPostCancels ? ` — ${fmtInt(d.postCancels)} orders, ${fmtSignedPct(d.postCancels / d.prevPostCancels - 1)} vs ${monthShort(d.prev)}` : ""}.`
          : `The timing mix was broadly unchanged: Post-ODD is ${fmtPct0(d.postPct)} of cancellations (${fmtPct0(d.prevPostPct)} prior).`,
      );
    }

    if (d.dominantClass) {
      const drivers = d.lateDrivers.map((x) => `${shortReason(x.label)} (${fmtSignedPct(x.mom)})`);
      paras.push(
        `**${d.dominantClass.label}** remains the dominant classification at ${fmtPct0(d.dominantClass.pct)} of cancellations` +
          (drivers.length ? `, and the fastest-growing customer-side reasons are ${drivers.join(", ")}` : "") + ".",
      );
    }

    if (d.hotspot && d.hotspot.cancelsMoM !== null) {
      const h = d.hotspot;
      const parts = [`cancellations ${fmtSignedPct(h.cancelsMoM)}`];
      if (h.postPct !== null) parts.push(`${fmtPct0(h.postPct)} Post-ODD`);
      if (h.pendingPct !== null) parts.push(`${fmtPct0(h.pendingPct)} Pending Customer Contact`);
      paras.push(
        `**${h.state}** is the most affected market — ${parts.join(", ")}${d.runnerUpGrowth !== null ? `, versus ${fmtSignedPct(d.runnerUpGrowth)} for the next-highest state` : ""}.`,
      );
    }

    if (d.rootCause === "customer-readiness") {
      paras.push(
        `The data therefore points toward a **customer engagement and appointment-readiness issue** rather than primarily a BSW or network readiness problem` +
          (d.bswPct !== null ? ` (BSW Delay Predicted is only ${fmtPct0(d.bswPct)}${d.jeopardyPct !== null ? `, Install in Jeopardy ${fmtPct0(d.jeopardyPct)}` : ""}).` : "."),
      );
    } else if (d.rootCause === "operational") {
      paras.push(`Company-side and network-readiness signals are rising, so the data points toward an **operational readiness issue** rather than customer behaviour alone.`);
    } else {
      paras.push(`Customer-side and operational signals both moved, so the root cause is **mixed** — drill into timing and reasons to separate them.`);
    }
  } else {
    paras.push(
      `**${M} looks stable.** Cancellations moved ${cm} on ${sm} sales growth, with a cancel rate of ${fmtPct(d.cancelRate)} (${fmtPct(d.prevCancelRate)} prior) — within normal month-to-month variation.`,
    );
    if (d.postPct !== null) paras.push(`Post-ODD accounts for ${fmtPct0(d.postPct)} of cancellations and ${d.dominantClass?.label ?? "Customer Miss"} remains the dominant classification. No significant operational anomaly is present.`);
  }

  chips.push({ label: "Cancellations", value: cm, tone: d.anomaly ? "bad" : "neutral" });
  chips.push({ label: "Unique Sales", value: sm, tone: "neutral" });
  if (d.postPct !== null) chips.push({ label: "Post-ODD share", value: fmtPct0(d.postPct), tone: d.anomaly ? "bad" : "neutral" });
  if (d.hotspot && d.anomaly) chips.push({ label: "Hotspot", value: d.hotspot.state, tone: "bad" });

  return {
    headline: d.anomaly ? `${M}: cancellations ${cm}, sales ${sm}` : `${M}: performance in line with trend`,
    paragraphs: paras,
    rootCause: d.rootCause,
    chips,
  };
}

// ------------------------------------------------------------------ insights
export type Severity = "critical" | "high" | "medium" | "low";

export interface Insight {
  id: string;
  severity: Severity;
  metric: { label: string; value: string; delta?: string };
  title: string;
  insight: string;
  evidence: string[];
  action: string;
  explore: { label: string; href: string };
}

const sevRank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function buildInsights(model: DataModel, month: MonthKey): Insight[] {
  const d = diagnose(model, month);
  const out: Insight[] = [];
  if (!d.prev) return out;
  const cur = getSnapshot(model, month, null);
  const pv = getSnapshot(model, d.prev, null);
  const M = monthName(month);
  const P = monthShort(d.prev);
  const hot = d.hotspot;
  const q = `month=${month}`;

  if (d.cancelsMoM !== null) {
    out.push({
      id: "cancel-mom",
      severity: d.anomaly ? "critical" : "low",
      metric: { label: "Total cancellations", value: fmtInt(cur.cancels), delta: fmtSignedPct(d.cancelsMoM) },
      title: d.anomaly ? `${M} cancellations increased ${fmtSignedPct(d.cancelsMoM).replace("+", "")} MoM` : `${M} cancellations are within normal range (${fmtSignedPct(d.cancelsMoM)} MoM)`,
      insight: d.anomaly
        ? `The move is far outside the ~${fmtPct(assess(model, kpiById("cancels")!, month, null).baseline, 0)} typical month-to-month movement seen earlier in the year, and sales grew only ${fmtSignedPct(d.salesMoM)}.`
        : `Cancellations track sales growth (${fmtSignedPct(d.salesMoM)}), so no intervention is signalled.`,
      evidence: [
        `Cancels ${fmtInt(pv.cancels)} → ${fmtInt(cur.cancels)}; sales ${fmtInt(pv.sales)} → ${fmtInt(cur.sales)}`,
        `Cancel rate ${fmtPct(d.prevCancelRate)} → ${fmtPct(d.cancelRate)}`,
        ...(d.excess && d.anomaly ? [`≈${fmtInt(Math.round(d.excess.excess))} cancellations above what the ${fmtPct(d.excess.baselineRate)} baseline rate would produce`] : []),
      ],
      action: d.anomaly ? "Move downstream: check where in the lifecycle (ODD timing) and which markets drive the increase." : "Keep monitoring; no action required.",
      explore: { label: "Explore", href: `/insights?${q}#cancel-mom` },
    });
  }

  if (d.postPct !== null && d.prevPostPct !== null) {
    const shift = d.postPct - d.prevPostPct;
    if (Math.abs(shift) >= 0.03) {
      out.push({
        id: "post-odd",
        severity: shift > 0 ? "high" : "low",
        metric: { label: "Post-ODD share", value: fmtPct0(d.postPct), delta: fmtPp(shift) },
        title: `Post-ODD cancellations ${shift > 0 ? "increased" : "decreased"} from ${fmtPct0(d.prevPostPct)} to ${fmtPct0(d.postPct)}`,
        insight: shift > 0 ? "Customers are now being lost late — after the committed date has passed — rather than early in the order life-cycle." : "The mix is moving toward earlier cancellations.",
        evidence: [
          `Post-ODD cancels: ${fmtInt(d.prevPostCancels)} → ${fmtInt(d.postCancels)}${d.postCancels !== null && d.prevPostCancels ? ` (${fmtSignedPct(d.postCancels / d.prevPostCancels - 1)})` : ""}`,
          `Pre-ODD share ${fmtPct0(pv.prePct)} → ${fmtPct0(cur.prePct)}; On-ODD ${fmtPct0(pv.onPct)} → ${fmtPct0(cur.onPct)}`,
        ],
        action: "Focus on late-stage appointment and contact breakdowns; trigger rescue at the first ODD miss.",
        explore: { label: "Explore timing", href: `/cancellations?tab=timing&bucket=post&${q}` },
      });
    }
  }

  if (hot && d.anomaly && hot.cancelsMoM !== null) {
    out.push({
      id: "hotspot",
      severity: "high",
      metric: { label: `${hot.state} cancellations`, value: fmtInt(hot.cancels), delta: fmtSignedPct(hot.cancelsMoM) },
      title: `${hot.state} cancellations increased approximately ${fmtSignedPct(hot.cancelsMoM).replace("+", "")}`,
      insight: `${hot.state} contributes ${fmtPct0(hot.contribution)} of the portfolio's cancellation increase${d.runnerUpGrowth !== null ? `; the next-fastest state grew ${fmtSignedPct(d.runnerUpGrowth)}` : ""}.`,
      evidence: [
        `Cancel rate ${fmtPct(hot.cancelRate)}; Post-ODD ${fmtPct0(hot.postPct)}; Customer Miss ${fmtPct0(hot.custPct)}`,
        ...(hot.pendingPct !== null ? [`Pending Customer Contact ${fmtPct0(hot.pendingPct)}`] : []),
      ],
      action: `Prioritise a ${hot.state} customer-rescue pilot before any network-wide intervention.`,
      explore: { label: `Explore ${hot.state}`, href: `/states?${q}` },
    });
  }

  if (d.pendingPct !== null && d.pendingDelta !== null) {
    const a = assess(model, kpiById("pending")!, month, null);
    if (d.pendingDelta > 0.02) {
      out.push({
        id: "pending",
        severity: a.anomaly ? "medium" : "low",
        metric: { label: "Pending Customer Contact", value: fmtPct0(d.pendingPct), delta: fmtPp(d.pendingDelta) },
        title: `Pending Customer Contact increased materially (${fmtPct0(pv.pendingPct)} → ${fmtPct0(d.pendingPct)})`,
        insight: "Unresolved customer contact is the strongest early-warning signal — visible before the cancellation happens.",
        evidence: [
          `Install in Jeopardy ${fmtPct0(d.jeopardyPct)} and BSW Delay Predicted ${fmtPct0(d.bswPct)} remain low by comparison`,
          `≈${fmtInt(Math.round(d.pendingPct * (cur.cancels ?? 0)))} ${M} cancellations carried this signal`,
        ],
        action: "Use Pending Customer Contact as an automated rescue trigger.",
        explore: { label: "Explore Watchtower", href: `/watchtower?${q}` },
      });
    }
  }

  const late = reasonStats(model, month, null).filter((r) => r.lateStage && r.mom !== null && r.mom > 0.25);
  if (late.length) {
    out.push({
      id: "late-drivers",
      severity: "medium",
      metric: { label: "Late-stage customer misses", value: fmtInt(late.reduce((a, r) => a + (r.count ?? 0), 0)), delta: "" },
      title: `${late.map((r) => shortReason(r.label)).join(", ")} surged`,
      insight: "These reasons describe customers who are not ready or available at appointment time — an engagement problem, not a build problem.",
      evidence: late.map((r) => `${r.label}: ${fmtInt(r.prevCount)} → ${fmtInt(r.count)} (${fmtSignedPct(r.mom)})`),
      action: "Add confirmation and one-click rescheduling ahead of the technician visit.",
      explore: { label: "Review Customer Miss", href: `/cancellations?tab=miss&${q}` },
    });
  }

  const inst = d.installsMoM;
  if (inst !== null && inst < 0 && (d.salesMoM ?? 0) > 0) {
    out.push({
      id: "installs",
      severity: "medium",
      metric: { label: "Installs", value: fmtInt(cur.installs), delta: fmtSignedPct(inst) },
      title: `Installs fell ${fmtSignedPct(inst).replace("−", "")} despite ${fmtSignedPct(d.salesMoM)} higher sales`,
      insight: `Install conversion dropped from ${fmtPct(pv.installs && pv.sales ? pv.installs / pv.sales : null)} to ${fmtPct(cur.installs && cur.sales ? cur.installs / cur.sales : null)} of sales${cur.onTimePct !== null && pv.onTimePct !== null ? `; on-time installs ${fmtPct0(pv.onTimePct)} → ${fmtPct0(cur.onTimePct)}` : ""}.`,
      evidence: [`Installs ${fmtInt(pv.installs)} → ${fmtInt(cur.installs)}`],
      action: "Track the recovered installs once the rescue workflow is live.",
      explore: { label: "Sales → Install journey", href: `/journey?${q}` },
    });
  }

  if (d.anomaly && d.rootCause === "customer-readiness") {
    out.push({
      id: "not-bsw",
      severity: "low",
      metric: { label: "BSW Delay Predicted", value: fmtPct0(d.bswPct), delta: "" },
      title: "Network / BSW readiness is not the driver",
      insight: "Predictive BSW and jeopardy signals stayed low while customer-contact signals rose, ruling out a broad network readiness issue.",
      evidence: [`Install in Jeopardy ${fmtPct0(d.jeopardyPct)} · Company Miss ${fmtPct0(cur.coPct)} (${fmtPct0(pv.coPct)} prior)`],
      action: "Do not divert network capacity; keep the operational watch in place.",
      explore: { label: "Explore Watchtower", href: `/watchtower?${q}` },
    });
  }

  return out.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
}

// ------------------------------------------------------------------ actions
export type Priority = "Critical" | "High" | "Medium" | "Low";

export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  priority: Priority;
  market: string;
  population: number | null;
  populationLabel: string;
  impact: string;
  why: string;
  href: string;
}

export function buildActions(model: DataModel, month: MonthKey): ActionItem[] {
  const d = diagnose(model, month);
  const cur = getSnapshot(model, month, null);
  const hot = d.hotspot;
  const market = hot && d.anomaly ? hot.state : "All markets";
  const scope = hot && d.anomaly ? hot.state : null;
  const scopeSnap = scope ? getSnapshot(model, month, scope) : cur;
  const rescuePop = scopeSnap.postCancels ?? (scopeSnap.cancels !== null && scopeSnap.postPct !== null ? Math.round(scopeSnap.cancels * scopeSnap.postPct) : null);
  const resched = scopeSnap[`reason:${nk(REASON_LABELS.resched)}`] ?? null;
  const pendingPop = scopeSnap.pendingPct !== null && scopeSnap.cancels !== null ? Math.round(scopeSnap.pendingPct * scopeSnap.cancels) : null;
  const lateTotal = ["noAccess", "resched", "tech"].reduce((a, k) => a + (scopeSnap[`reason:${nk(REASON_LABELS[k as keyof typeof REASON_LABELS])}`] ?? 0), 0);
  const q = `month=${month}`;

  return [
    {
      id: "rescue", title: "Post-ODD Customer Rescue", owner: "Customer Care / COR", priority: d.anomaly ? "Critical" : "Medium", market,
      population: rescuePop, populationLabel: `Post-ODD cancels in ${scope ?? "portfolio"} (${monthShort(month)})`,
      impact: `Reduce avoidable Customer Miss — the ${fmtInt(lateTotal)} No-Access, Reschedule and Tech-on-Job cancels are the addressable core.`,
      why: `Post-ODD is ${fmtPct0(scopeSnap.postPct)} of cancels and Customer Miss is ${fmtPct0(scopeSnap.custPct)} in ${scope ?? "the portfolio"}.`,
      href: `/actions?${q}#rescue`,
    },
    {
      id: "confirm", title: "Appointment Confirmation", owner: "Customer Operations", priority: d.anomaly ? "High" : "Medium", market,
      population: pendingPop, populationLabel: `Cancels that carried Pending Customer Contact`,
      impact: "Convert unresolved contact into a confirmed appointment before the ODD.",
      why: `Pending Customer Contact is the strongest leading signal (${fmtPct0(scopeSnap.pendingPct)}).`,
      href: `/watchtower?${q}`,
    },
    {
      id: "reschedule", title: "Reschedule Recovery", owner: "Customer Care", priority: d.anomaly ? "High" : "Medium", market,
      population: resched, populationLabel: "Reschedule-driven cancellations",
      impact: "Stop repeat reschedules ending in cancellation with one-click rebooking and agent follow-up on the second request.",
      why: "Repeated rescheduling is a major Post-ODD risk.",
      href: `/cancellations?tab=miss&${q}`,
    },
    {
      id: "monitor", title: "Closed-loop outcome tracking", owner: "Insights / BI", priority: "Medium", market: "All markets",
      population: null, populationLabel: "Tracking, not a population",
      impact: "Show whether Post-ODD share, No Access, Reschedule and Tech-on-Job cancels fall after launch.",
      why: "Answers the question 'is the action working?'.", href: `/cancellations?tab=timing&${q}`,
    },
    {
      id: "netwatch", title: "Keep network-readiness watch", owner: "Network Operations", priority: "Low", market: "All markets",
      population: null, populationLabel: "Monitoring only",
      impact: "Maintain current BSW / jeopardy monitoring; no diversion of capacity needed.",
      why: `BSW Delay Predicted ${fmtPct0(cur.bswPct)} and Install in Jeopardy ${fmtPct0(cur.jeopardyPct)} are not driving the change.`,
      href: `/watchtower?${q}`,
    },
  ];
}

export const RESCUE_FLOW: { label: string; kind: "step" | "decision" | "end" }[] = [
  { label: "ODD missed / rescheduled", kind: "step" },
  { label: "Check Customer Miss risk", kind: "step" },
  { label: "Pending customer contact?", kind: "decision" },
  { label: "Send automated SMS confirmation", kind: "step" },
  { label: "Offer one-click reschedule", kind: "step" },
  { label: "No response?", kind: "decision" },
  { label: "Create agent call task", kind: "step" },
  { label: "Repeated reschedule / no-access?", kind: "decision" },
  { label: "Escalate high-risk rescue", kind: "step" },
  { label: "Track final install / cancel outcome", kind: "end" },
];

// ------------------------------------------------------------------ state story
export interface StoryPoint {
  text: string;
  tone: "bad" | "neutral" | "good";
}

export interface StateStory {
  change: StoryPoint;
  timing: StoryPoint;
  who: StoryPoint;
  why: StoryPoint;
  seen: StoryPoint;
  verdict: "customer-readiness" | "operational" | "mixed" | "insufficient";
}

/** Plain-language read-outs for each section of the state drill-down, generated from the data. */
export function stateStory(model: DataModel, month: MonthKey, state: string): StateStory {
  const pm = prevMonth(model, month);
  const cur = getSnapshot(model, month, state);
  const prev = pm ? getSnapshot(model, pm, state) : null;
  const port = getSnapshot(model, month, null);
  const P = pm ? monthName(pm) : "prior month";
  const rel = (a: number | null, b: number | null | undefined) => (a !== null && b ? a / b - 1 : null);

  const cMoM = rel(cur.cancels, prev?.cancels), sMoM = rel(cur.sales, prev?.sales);
  let change: StoryPoint = { text: `${state} has no prior-month comparison in the workbook.`, tone: "neutral" };
  if (cMoM !== null && sMoM !== null) {
    const mult = sMoM > 0.001 ? cMoM / sMoM : null;
    change = {
      text:
        cMoM > sMoM + 0.05
          ? `${state} cancellations rose ${fmtSignedPct(cMoM).replace("+", "")} vs ${P} while sales grew only ${fmtSignedPct(sMoM).replace("+", "")}${mult && mult > 1.5 ? ` — cancellations increased materially faster than sales (≈${mult.toFixed(0)}×)` : ""}. Cancel rate moved from ${fmtPct(prev?.cancelRate ?? null)} to ${fmtPct(cur.cancelRate)}.`
          : `${state} cancellations moved ${fmtSignedPct(cMoM)} vs sales ${fmtSignedPct(sMoM)} — broadly in line with volume. Cancel rate ${fmtPct(cur.cancelRate)}.`,
      tone: cMoM > sMoM + 0.05 ? "bad" : "good",
    };
  }

  const shift = cur.postPct !== null && prev?.postPct != null ? cur.postPct - prev.postPct : null;
  const timing: StoryPoint =
    cur.postPct === null
      ? { text: "Timing split isn’t available for this selection.", tone: "neutral" }
      : {
          text: `${fmtPct0(cur.postPct)} of ${state}’s cancellations happen after the Original Due Date${shift !== null ? ` (${fmtPct0(prev!.postPct)} in ${P}, ${fmtPp(shift)})` : ""}, versus ${fmtPct0(port.postPct)} portfolio-wide${cur.postPct > (port.postPct ?? 1) + 0.03 ? " — a stronger late-stage skew than other markets" : ""}.`,
          tone: (shift ?? 0) > 0.05 ? "bad" : "neutral",
        };

  const who: StoryPoint =
    cur.custPct === null
      ? { text: "Classification isn’t available for this selection.", tone: "neutral" }
      : {
          text: `Customer Miss is ${fmtPct0(cur.custPct)} of cancellations (${fmtInt(cur.custMiss)} orders), Company Miss ${fmtPct0(cur.coPct)} and Faux ${fmtPct0(cur.fauxPct)}. ${cur.custPct > (port.custPct ?? 1) ? `That is above the portfolio’s ${fmtPct0(port.custPct)}.` : ""}`,
          tone: cur.custPct >= 0.6 ? "bad" : "neutral",
        };

  const rs = reasonStats(model, month, state);
  const hot = rs.filter((r) => r.lateStage && (r.mom ?? 0) > 0.25);
  const why: StoryPoint = hot.length
    ? { text: `${hot.map((r) => `${r.label} (${fmtSignedPct(r.mom)})`).join(", ")} ${hot.length > 1 ? "are" : "is"} growing fastest — customers who aren’t available, keep rescheduling, or cancel with the technician on site.`, tone: "bad" }
    : { text: rs[0] ? `${rs[0].label} is the largest reason (${fmtPct0(rs[0].share)}); no late-stage reason is surging.` : "No reason data for this selection.", tone: "neutral" };

  const p = cur.pendingPct, b = cur.bswPct, j = cur.jeopardyPct;
  let seen: StoryPoint = { text: "Watchtower signals for this state aren’t available in the workbook for this month.", tone: "neutral" };
  let verdict: StateStory["verdict"] = "insufficient";
  if (p !== null) {
    const tech = (b ?? 0) + (j ?? 0);
    verdict = p > tech ? "customer-readiness" : "operational";
    seen = {
      text:
        p > tech
          ? `Customer-contact warning signals are materially stronger than BSW predictive risk: Pending Customer Contact ${fmtPct0(p)}${prev?.pendingPct != null ? ` (${fmtPct0(prev.pendingPct)} in ${P})` : ""} versus Install in Jeopardy ${fmtPct0(j)} and BSW Delay Predicted ${fmtPct0(b)}. The issue looks like customer engagement / appointment readiness.`
          : `Technical risk signals (Install in Jeopardy ${fmtPct0(j)}, BSW ${fmtPct0(b)}) are at least as strong as customer-contact signals (${fmtPct0(p)}), so an operational cause can’t be ruled out.`,
      tone: p > tech ? "bad" : "neutral",
    };
  }
  return { change, timing, who, why, seen, verdict };
}
