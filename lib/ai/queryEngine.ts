/**
 * Dataset-grounded "Insights Genie". A deterministic intent interpreter that answers from the
 * workbook-backed model. `AnswerProvider` is the seam for swapping in a real LLM later: implement the
 * same interface (feeding it `buildContext()` as grounding facts) and pass it to <GenieProvider>.
 */
import type { DataModel, MonthKey } from "../data/types";
import {
  getSnapshot, kpiById, kpiDelta, KPI_DEFS, monthsUpTo, nk, prevMonth, reasonStats, series, stateRows, watchSignals, REASON_LABELS,
} from "../data/metrics";
import { buildActions, diagnose, executiveSummary } from "../data/narratives";
import { fmtInt, fmtPct, fmtPct0, fmtPp, fmtSignedPct, monthName, monthShort, stateSlug } from "../format";

export interface GenieContext {
  model: DataModel;
  month: MonthKey;
  state: string | null;
}

export interface GenieKpi {
  label: string;
  value: string;
  delta?: string;
  tone?: "bad" | "good" | "neutral";
}

export interface GenieAnswer {
  intent: string;
  /** Text with `**bold**` markers. Paragraphs are separated by blank lines. */
  text: string;
  kpis: GenieKpi[];
  cta?: { label: string; href: string };
  followUps?: string[];
}

export interface AnswerProvider {
  answer(question: string, ctx: GenieContext): GenieAnswer | Promise<GenieAnswer>;
}

export const SUGGESTED_QUESTIONS = [
  "Why did cancellations increase in September?",
  "Which state is driving the increase?",
  "Why is North Carolina performing poorly?",
  "Are cancellations mostly Pre or Post ODD?",
  "What is driving Customer Miss?",
  "Could we have predicted these cancellations?",
  "What should Brightspeed do next?",
];

/** Suggestions with the month name following the selected month. */
export function suggestedQuestions(model: DataModel, month: MonthKey): string[] {
  const hot = diagnose(model, month).hotspot?.state ?? "North Carolina";
  return [
    `Why did cancellations increase in ${monthName(month)}?`,
    "Which state is driving the increase?",
    `Why is ${hot} performing poorly?`,
    "Are cancellations mostly Pre or Post ODD?",
    "What is driving Customer Miss?",
    "Could we have predicted these cancellations?",
    "What should Brightspeed do next?",
  ];
}

const has = (q: string, re: RegExp) => re.test(q);

function findState(model: DataModel, q: string): string | null {
  const n = nk(q);
  return model.states.find((s) => n.includes(nk(s))) ?? null;
}

const kp = (label: string, value: string, delta?: string, tone?: GenieKpi["tone"]): GenieKpi => ({ label, value, delta, tone });

function kpiLookup(q: string) {
  const n = nk(q);
  const aliases: [RegExp, string][] = [
    [/\bsales\b/, "sales"], [/install/, "installs"], [/cancel rate/, "cancelRate"], [/on.?time/, "onTime"],
    [/faux/, "faux"], [/company miss/, "co"], [/true cancel/, "true"], [/jeopardy/, "jeopardy"], [/bsw/, "bsw"],
    [/buyer/, "r-buyers"], [/no access|not home/, "r-noaccess"], [/tech on job|on site/, "r-tech"], [/reschedul/, "r-resched"],
  ];
  for (const [re, id] of aliases) if (re.test(q.toLowerCase())) return kpiById(id);
  return KPI_DEFS.find((k) => n.includes(nk(k.label)));
}

export const ruleBasedProvider: AnswerProvider = {
  answer(question, ctx) {
    const { model } = ctx;
    const month = ctx.month;
    const M = monthName(month);
    const q = question.toLowerCase().trim();
    const st = findState(model, question) ?? null;
    /** Explicit mention wins; otherwise the global state filter scopes state-aware answers. */
    const scopeSt = st ?? ctx.state;
    const d = diagnose(model, month);
    const cur = getSnapshot(model, month, null);
    const pm = prevMonth(model, month);
    const q2 = `month=${month}`;

    if (!q) return help(model, month);

    // ---- what should we do / actions
    if (has(q, /what should|do next|recommend|next step|action|is the action working|rescue|fix/)) {
      const acts = buildActions(model, month);
      const top = acts[0];
      return {
        intent: "actions",
        text:
          `The highest-priority action is **${top.title}** (${top.owner}, ${top.priority.toLowerCase()} priority) in **${top.market}**. ${top.impact}\n\n` +
          `Flow: automated SMS confirmation → one-click reschedule → agent call task → escalate repeated reschedule / no-access → track the final install-or-cancel outcome. ` +
          `To know whether it is working, watch Post-ODD share, No Access, Reschedule and Tech-on-Job cancels fall month over month.`,
        kpis: [
          kp("Affected population", fmtInt(top.population), top.populationLabel),
          kp("Post-ODD share", fmtPct0(cur.postPct), pm ? fmtPp((cur.postPct ?? 0) - (getSnapshot(model, pm, null).postPct ?? 0)) : undefined, "bad"),
        ],
        cta: { label: "View rescue opportunities", href: `/actions?${q2}#rescue` },
        followUps: ["Could we have predicted these cancellations?", "What is driving Customer Miss?"],
      };
    }

    // ---- watchtower / predictability
    if (has(q, /watchtower|signal|predict|see it coming|saw it coming|early warning|foresee|leading|prevent|avoid|could we/)) {
      const scope = scopeSt;
      const sig = watchSignals(model, month, scope);
      const ranked = sig.filter((s) => s.actionable && s.pct !== null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
      const top = ranked[0];
      if (!top) return { intent: "watchtower", text: `Watchtower signal data is not available for ${scope ?? "the portfolio"} in ${M}.`, kpis: [], cta: { label: "Open Watchtower", href: `/watchtower?${q2}` } };
      const flagged = sig.filter((s) => s.actionable).reduce((a, s) => a + (s.pct ?? 0), 0);
      const pending = sig.find((s) => s.id === "pending")!, bsw = sig.find((s) => s.id === "bsw")!, jeo = sig.find((s) => s.id === "jeopardy")!;
      return {
        intent: "watchtower",
        text:
          `**${top.label}** is the most important warning signal for ${scope ?? "the portfolio"} in ${M}: **${fmtPct0(top.pct)}** of cancellations carried it before they happened` +
          `${top.count !== null ? ` (≈${fmtInt(top.count)} orders)` : ""}. Overall, **${fmtPct0(flagged)}** of cancellations had some Watchtower warning.\n\n` +
          `Technical risk is far smaller — Install in Jeopardy ${fmtPct0(jeo.pct)} and BSW Delay Predicted ${fmtPct0(bsw.pct)} — so the early warning points to customer engagement rather than network readiness. ` +
          `Pending Customer Contact is a practical rescue trigger.`,
        kpis: [kp("Pending Customer Contact", fmtPct0(pending.pct), pending.count !== null ? `≈${fmtInt(pending.count)} orders` : undefined, "bad"), kp("Install in Jeopardy", fmtPct0(jeo.pct)), kp("BSW Delay Predicted", fmtPct0(bsw.pct))],
        cta: { label: "Open Watchtower", href: `/watchtower?${q2}${scope ? `&state=${stateSlug(scope)}` : ""}` },
        followUps: ["What should Brightspeed do next?"],
      };
    }

    // ---- specific state
    if (st && !has(q, /customer miss|no access|reschedul|buyer|tech on job|post.?odd|pre.?odd/)) {
      const row = stateRows(model, month).find((r) => r.state === st)!;
      const dr = row;
      const late = reasonStats(model, month, st).filter((r) => r.lateStage && (r.mom ?? 0) > 0.25);
      return {
        intent: "state",
        text:
          `**${st}** in ${M}: ${fmtInt(row.cancels)} cancellations on ${fmtInt(row.sales)} sales — a **${fmtPct(row.cancelRate)}** cancel rate, ${row.cancelsMoM !== null ? `${fmtSignedPct(row.cancelsMoM)} cancellations vs ${monthShort(pm ?? month)}` : "with no prior-month comparison"}` +
          `${row.contribution !== null && row.contribution > 0.05 ? `, contributing ${fmtPct0(row.contribution)} of the portfolio increase` : ""}.\n\n` +
          `${dr.postPct !== null ? `Post-ODD is **${fmtPct0(dr.postPct)}** of its cancellations` : ""}${dr.custPct !== null ? ` and Customer Miss **${fmtPct0(dr.custPct)}**` : ""}${dr.pendingPct !== null ? `; Pending Customer Contact is **${fmtPct0(dr.pendingPct)}**` : ""}. ` +
          (late.length ? `Fastest-growing reasons: ${late.map((r) => `${r.label} (${fmtSignedPct(r.mom)})`).join(", ")}.` : ""),
        kpis: [kp("Cancellations", fmtInt(row.cancels), fmtSignedPct(row.cancelsMoM), (row.cancelsMoM ?? 0) > 0.15 ? "bad" : "neutral"), kp("Cancel rate", fmtPct(row.cancelRate)), kp("Post-ODD", fmtPct0(dr.postPct)), kp("Pending contact", fmtPct0(dr.pendingPct))],
        cta: { label: `Drill into ${st}`, href: `/states/${stateSlug(st)}?${q2}` },
        followUps: [`What is driving Customer Miss in ${st}?`, "What should Brightspeed do next?"],
      };
    }

    // ---- which state / hotspot
    if (has(q, /which state|what state|hotspot|worst|highest.*(cancel|state)|most affected|market|where/) && !has(q, /lifecycle/)) {
      const rows = [...stateRows(model, month)].sort((a, b) => (b.cancelsMoM ?? -1) - (a.cancelsMoM ?? -1));
      const byVol = [...rows].sort((a, b) => (b.cancels ?? 0) - (a.cancels ?? 0))[0];
      const top = rows[0];
      return {
        intent: "top-state",
        text:
          `**${top.state}** is the largest driver of the ${M} change: cancellations ${fmtSignedPct(top.cancelsMoM)} vs ${monthShort(pm ?? month)} (${fmtInt(top.cancels)} orders, ${fmtPct(top.cancelRate)} cancel rate)` +
          `${top.contribution !== null ? `, ${fmtPct0(top.contribution)} of the portfolio increase` : ""}. ` +
          `${byVol.state === top.state ? "It also has the highest cancellation volume." : `${byVol.state} has the highest raw volume (${fmtInt(byVol.cancels)}).`}\n\n` +
          `Ranking by growth: ${rows.map((r) => `${r.state} ${fmtSignedPct(r.cancelsMoM)}`).join(" · ")}.`,
        kpis: [kp(`${top.state} cancels`, fmtInt(top.cancels), fmtSignedPct(top.cancelsMoM), "bad"), kp("Post-ODD", fmtPct0(top.postPct)), kp("Pending contact", fmtPct0(top.pendingPct))],
        cta: { label: `Drill into ${top.state}`, href: `/states/${stateSlug(top.state)}?${q2}` },
        followUps: [`Why is ${top.state} performing poorly?`],
      };
    }

    // ---- ODD timing
    if (has(q, /\bodd\b|timing|pre or post|before.*due|after.*due/)) {
      const scope = scopeSt;
      const s = getSnapshot(model, month, scope);
      const p = pm ? getSnapshot(model, pm, scope) : null;
      const dom = [["Pre-ODD", s.prePct], ["On-ODD", s.onPct], ["Post-ODD", s.postPct]].sort((a, b) => (b[1] as number) - (a[1] as number))[0];
      const trend = series(model, "postPct", scope).filter((x) => x.value !== null && x.month <= month).map((x) => `${monthShort(x.month)} ${fmtPct0(x.value)}`);
      return {
        intent: "timing",
        text:
          `In ${M}, **${dom[0]}** is the dominant bucket for ${scope ?? "the portfolio"}: Pre-ODD ${fmtPct0(s.prePct)}, On-ODD ${fmtPct0(s.onPct)}, Post-ODD ${fmtPct0(s.postPct)}` +
          `${p ? ` (Post-ODD was ${fmtPct0(p.postPct)} in ${monthShort(pm!)})` : ""}.\n\nPost-ODD trend: ${trend.join(" → ")}.` +
          `${s.postCancels !== null && p?.postCancels ? `\n\nPost-ODD cancellations: ${fmtInt(p.postCancels)} → ${fmtInt(s.postCancels)} (${fmtSignedPct(s.postCancels / p.postCancels - 1)}).` : ""}`,
        kpis: [kp("Pre-ODD", fmtPct0(s.prePct)), kp("On-ODD", fmtPct0(s.onPct)), kp("Post-ODD", fmtPct0(s.postPct), p ? fmtPp((s.postPct ?? 0) - (p.postPct ?? 0)) : undefined, dom[0] === "Post-ODD" ? "bad" : "neutral")],
        cta: { label: "View timing analysis", href: `/cancellations?tab=timing&bucket=post&${q2}` },
        followUps: ["What is driving Customer Miss?"],
      };
    }

    // ---- customer miss / reasons
    if (has(q, /customer miss|no access|not home|reschedul|buyer|tech on job|why are customers|reasons?|driving customer/)) {
      const rs = reasonStats(model, month, scopeSt);
      const s = getSnapshot(model, month, scopeSt);
      const total = rs.reduce((a, r) => a + (r.count ?? 0), 0);
      const fast = [...rs].filter((r) => r.mom !== null).sort((a, b) => (b.mom ?? 0) - (a.mom ?? 0)).slice(0, 3);
      const asked = has(q, /how many/);
      return {
        intent: "customer-miss",
        text:
          `${asked ? `There were **${fmtInt(s.custMiss)}** Customer Miss cancellations` : `**Customer Miss** accounts for **${fmtPct0(s.custPct)}** of cancellations (${fmtInt(s.custMiss)})`} ${scopeSt ? `in ${scopeSt}` : "portfolio-wide"} in ${M}.\n\n` +
          `Largest reasons: ${rs.slice(0, 3).map((r) => `${r.label} ${fmtInt(r.count)}`).join(", ")}. Fastest-growing: ${fast.map((r) => `${r.label} ${fmtSignedPct(r.mom)}`).join(", ")} — ` +
          `${fast.some((r) => r.lateStage) ? "a late-stage appointment-readiness pattern (customers unavailable, rescheduling, or cancelling with the technician on site)." : "no clear late-stage pattern."}` +
          `${total ? ` Reasons total ${fmtInt(total)}.` : ""}`,
        kpis: fast.map((r) => kp(r.label, fmtInt(r.count), fmtSignedPct(r.mom), r.lateStage && (r.mom ?? 0) > 0.25 ? "bad" : "neutral")),
        cta: { label: "Review Customer Miss", href: `/cancellations?tab=miss&${q2}${scopeSt ? `&state=${stateSlug(scopeSt)}` : ""}` },
        followUps: ["Could we have predicted these cancellations?"],
      };
    }

    // ---- why increase / summary
    if (has(q, /why|increase|rise|rose|spike|driv|cause|explain|what happened|summary|overview|happening/) && has(q, /cancel|increase|happen|summary|overview|spike/)) {
      const sum = executiveSummary(model, month);
      return {
        intent: "why",
        text: sum.paragraphs.slice(0, 4).join("\n\n"),
        kpis: [
          kp("Cancellations", fmtInt(cur.cancels), fmtSignedPct(d.cancelsMoM), d.anomaly ? "bad" : "neutral"),
          kp("Unique Sales", fmtInt(cur.sales), fmtSignedPct(d.salesMoM)),
          kp("Cancel rate", fmtPct(cur.cancelRate), pm ? fmtPp((cur.cancelRate ?? 0) - (getSnapshot(model, pm, null).cancelRate ?? 0), 1) : undefined, d.anomaly ? "bad" : "neutral"),
        ],
        cta: { label: "Explore the cancellation story", href: `/?${q2}#kpis` },
        followUps: ["Which state is driving the increase?", "Are cancellations mostly Pre or Post ODD?"],
      };
    }

    // ---- channels
    if (has(q, /channel|d2d|digital|inbound|indirect|obtm|partner/)) {
      return {
        intent: "channels",
        text: model.channels
          ? `Channel data is available in the workbook — open any KPI and choose the Channels tab.`
          : `The workbook has no **Channel Monthly** sheet yet, so channel-level cancellations aren't available. Add a sheet named "Channel Monthly" (Month, Channel, Unique Sales, Installs, Cancellations) and the Channels tab will populate automatically.`,
        kpis: [], cta: { label: "Open Cancellations deep dive", href: `/?${q2}#kpis` },
      };
    }

    // ---- single KPI lookup
    const k = kpiLookup(question);
    if (k) {
      const s = getSnapshot(model, month, scopeSt);
      const v = s[k.key] ?? null;
      const dl = kpiDelta(model, k, month, scopeSt);
      const fmt = (x: number | null) => (k.unit === "pct" ? fmtPct(x) : fmtInt(x));
      return {
        intent: "kpi",
        text: `**${k.label}** for ${scopeSt ?? "the portfolio"} in ${M} is **${fmt(v)}**${dl ? ` (${dl.kind === "pp" ? fmtPp(dl.value) : fmtSignedPct(dl.value)} vs ${monthShort(pm!)}, ${fmt(dl.previous)} prior)` : ""}. ${k.blurb}`,
        kpis: [kp(k.label, fmt(v), dl ? (dl.kind === "pp" ? fmtPp(dl.value) : fmtSignedPct(dl.value)) : undefined)],
        cta: { label: "Open KPI deep dive", href: `/?${q2}&kpi=${k.id}` },
      };
    }

    // ---- fall back to the workbook's Executive Questions sheet
    const words = new Set(q.split(/\W+/).filter((w) => w.length > 3));
    let best: { score: number; row: DataModel["executiveQuestions"][number] } | null = null;
    for (const row of model.executiveQuestions) {
      const rw = row.question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const score = rw.filter((w) => words.has(w)).length;
      if (score > 0 && (!best || score > best.score)) best = { score, row };
    }
    if (best) {
      return {
        intent: "exec-question",
        text: `${best.row.answer}\n\n**Evidence:** ${best.row.evidence}\n\n**Next step:** ${best.row.nextStep}`,
        kpis: [], cta: { label: "Explore in the dashboard", href: `/?${q2}#kpis` },
      };
    }
    return help(model, month);
  },
};

function help(model: DataModel, month: MonthKey): GenieAnswer {
  return {
    intent: "help",
    text: "I answer from the workbook data. Try asking about **why cancellations changed**, **which state** is driving it, **Pre vs Post ODD** timing, **Customer Miss** reasons, **Watchtower** warning signals, a specific KPI (e.g. “what is the cancel rate?”), or **what to do next**.",
    kpis: [], followUps: suggestedQuestions(model, month).slice(0, 4),
  };
}

/** Grounding facts an LLM-backed provider could receive alongside the user's question. */
export function buildContext(ctx: GenieContext) {
  const { model, month, state } = ctx;
  return {
    month, state, latestMonth: model.latestMonth,
    diagnosis: diagnose(model, month),
    snapshot: getSnapshot(model, month, state),
    months: monthsUpTo(model, month),
  };
}
