/**
 * Narrative builders: the Command Center executive story, the "What is happening?" read-outs for
 * the plan overview and for each state or channel plan, and the recommended intervention layers.
 * Sentences are templates; every figure comes from `storyFacts` or the metrics layer.
 */
import type { DataModel, InterventionRow, MonthKey } from "../data/types";
import { getSnapshot, isChannel, prevMonth, scopeName, stateRows, type Snapshot } from "../data/metrics";
import { fmtInt, fmtPct, fmtPct0, fmtPp, fmtSignedPct, monthName } from "../format";
import { storyFacts, type StoryFacts } from "./facts";
import { channelLink, hrefs, link, listJoin, scopeLink, stateLink } from "./links";
import type { NarrativePoint, Recommendation, StorySection } from "./types";

const abs = (s: string) => s.replace(/^[+−]/, "");
/** "between 16% and 18%", or "near 15%" when both ends round to the same value. */
const between = (r: [number, number] | null) => (!r ? "" : fmtPct0(r[0]) === fmtPct0(r[1]) ? `near ${fmtPct0(r[0])}` : `between ${fmtPct0(r[0])} and ${fmtPct0(r[1])}`);
const growthRange = (r: [number, number] | null) => (!r ? "" : `${fmtSignedPct(r[0])} and ${fmtSignedPct(r[1])}`);
const rel = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? a / b - 1 : null);

/** Display names for the prevention layers (the workbook keeps its internal programme names). */
export const INTERVENTION_LABEL: Record<InterventionRow["kind"], string> = {
  sales: "Sales quality verification",
  install: "Installation readiness",
  contact: "Customer-contact rescue",
  total: "Deduplicated total",
  other: "Recommended intervention",
};
const INTERVENTION_ACTION: Partial<Record<InterventionRow["kind"], string>> = { sales: "sales-quality", install: "install", contact: "confirm" };

// ------------------------------------------------------------------ shared point builders
function portfolioPoint(f: StoryFacts): NarrativePoint {
  const M = monthName(f.month);
  const { d, port, portPrev } = f;
  if (!f.prev || d.cancelsMoM === null) {
    return { id: "portfolio", mode: "observed", label: "Portfolio", tone: "neutral", text: `${M} is the first month in the dataset, so a month over month comparison is not available.` };
  }
  if (!d.anomaly) {
    return {
      id: "portfolio", mode: "observed", label: "Portfolio", tone: "good",
      text: `**${M} performance is in line with trend.** Cancellations moved ${fmtSignedPct(d.cancelsMoM)} against ${fmtSignedPct(d.salesMoM)} sales, with a cancel rate of **${fmtPct(port.cancelRate)}** (${fmtPct(portPrev?.cancelRate)} prior), within normal monthly variation.`,
      evidence: { kind: "trend", scope: null, title: "Cancel rate by month", interpretation: `The cancel rate stayed inside its usual range in ${M}; no exception is present.` },
    };
  }
  const salesWord = (d.salesMoM ?? 0) >= 0 ? `Unique Sales grew only **${abs(fmtSignedPct(d.salesMoM))}**` : `Unique Sales fell **${abs(fmtSignedPct(d.salesMoM))}**`;
  return {
    id: "portfolio", mode: "observed", label: "Portfolio", tone: "bad",
    text:
      `**${M} cancellations rose ${abs(fmtSignedPct(d.cancelsMoM))}** to ${fmtInt(port.cancels)} while ${salesWord}. ` +
      `The cancel rate moved from ${fmtPct(portPrev?.cancelRate)} to **${fmtPct(port.cancelRate)}**` +
      (f.baselineRate !== null ? `, against an internal baseline of ${fmtPct(f.baselineRate)}` : "") +
      (f.multiple !== null ? `: about **${Math.round(f.multiple)}×** the normal monthly movement.` : "."),
    evidence: {
      kind: "trend", scope: null, title: "Cancel rate by month",
      interpretation: `The rate held near ${fmtPct(f.baselineRate)} through ${f.prev ? monthName(f.prev) : "the prior month"}, then broke out in ${M}; sales growth of ${fmtSignedPct(d.salesMoM)} does not explain the move.`,
    },
  };
}

function geographyPoint(f: StoryFacts): NarrativePoint | null {
  const h = f.focus;
  if (!h) return null;
  const n = f.model.states.length - 1;
  return {
    id: "geography", mode: "observed", label: "Geography", tone: "bad",
    text:
      `${stateLink(h.state, f.month)} explains **${fmtPct0(h.contribution)}** of the increase: cancellations **${fmtSignedPct(h.cancelsMoM)}** at a **${fmtPct(h.cancelRate)}** cancel rate.` +
      (f.otherGrowth ? ` The other ${n} states moved between ${growthRange(f.otherGrowth)}.` : ""),
    evidence: {
      kind: "ranking", dim: "state", metric: "cancels", highlight: [h.state], title: `Cancellations by state, ${monthName(f.month)}`,
      interpretation: `${h.state} is the only state outside its normal range; every other state's cancel rate sits ${between(f.otherRate)}.`,
    },
  };
}

function channelPoint(f: StoryFacts): NarrativePoint | null {
  const M = monthName(f.month);
  if (f.focus && f.outlierChannels.length) {
    const links = f.outlierChannels.map((c) => channelLink(c.channel, f.month));
    const rates = f.outlierChannels.map((c) => `**${fmtPct(c.rate)}**`);
    return {
      id: "channel", mode: "observed", label: "Channel", tone: "bad",
      text:
        `Inside ${f.focus.state}, ${listJoin(links)} carry the deterioration at ${listJoin(rates)} cancel rates` +
        (f.normalChannelRate ? `, while its other channels stay ${between(f.normalChannelRate)}.` : "."),
      evidence: {
        kind: "scope-channels", state: f.focus.state, highlight: f.outlierChannels.map((c) => c.channel), title: `${f.focus.state} cancel rate by channel, ${M}`,
        interpretation: `${listJoin(f.outlierChannels.map((c) => c.channel))} run at more than twice the rate of every other ${f.focus.state} channel.`,
      },
    };
  }
  const top = f.portfolioChannels.filter((c) => (c.contribution ?? 0) > 0.25);
  if (!f.d.anomaly || !top.length) return null;
  return {
    id: "channel", mode: "observed", label: "Channel", tone: "bad",
    text: `By channel, ${listJoin(top.map((c) => channelLink(c.channel, f.month)))} account for ${listJoin(top.map((c) => `**${fmtPct0(c.contribution)}**`))} of the increase.`,
    evidence: {
      kind: "ranking", dim: "channel", metric: "cancels", highlight: top.map((c) => c.channel), title: `Cancellations by channel, ${M}`,
      interpretation: `${listJoin(top.map((c) => c.channel))} contribute most of the cancellation growth; the remaining channels moved little.`,
    },
  };
}

function salesQualityPoint(f: StoryFacts): NarrativePoint | null {
  const dr = f.drivers.sales;
  if (!f.hasStory || !f.focus || !dr || !f.weakAgencies.length) return null;
  const gaps = f.weakAgencies.map((a) => a.gap ?? 0);
  const c = f.cohort;
  return {
    id: "sales-quality", mode: "observed", label: "Sales quality analysis", tone: "bad",
    text:
      `**${fmtInt(dr.cancels)}** ${f.focus.state} cancellations (**${fmtPct0(dr.share)}**) trace to sales and agency quality. ` +
      `${listJoin(f.weakAgencies.map((a) => a.agency))} run ${fmtPp(Math.min(...gaps))} to ${fmtPp(Math.max(...gaps))} above their own history` +
      (c ? `; at ${c.agency}, new September representatives made ${fmtPct0(c.salesShare)} of sales but **${fmtPct0(c.cancelShare)}** of cancellations.` : "."),
    evidence: {
      kind: "agencies", highlight: f.weakAgencies.map((a) => a.agency), title: `${f.focus.state} agencies: ${monthName(f.month)} vs own history`,
      interpretation: `Only the agencies named above broke from their own baseline; the other ${f.steadyAgencies.length} sources stayed within ${fmtPp(Math.max(...f.steadyAgencies.map((a) => a.gap ?? 0)))} of history, so this is a partner and representative problem, not a market one.`,
    },
  };
}

function contactPoint(f: StoryFacts): NarrativePoint | null {
  const dr = f.drivers.contact;
  if (!f.hasStory || !f.focus || !dr) return null;
  const sales = f.drivers.sales;
  const larger = !sales || (dr.cancels ?? 0) >= (sales.cancels ?? 0);
  const pending = f.focusSnap?.pendingPct ?? null;
  return {
    id: "contact", mode: "observed", label: "Customer-contact risk", tone: "bad",
    text:
      `The ${larger ? "larger" : "second"} cause is customer contact and appointment readiness: **${fmtInt(dr.cancels)}** cancellations (**${fmtPct0(dr.share)}**) by primary attribution.` +
      (pending !== null
        ? ` Separately, **${fmtPct0(pending)}** of ${f.focus.state} cancellations carried a ${link("Pending Customer Contact", hrefs.watchtower(f.month, f.focus.state))} signal; the signal and the attribution are different measures.`
        : ""),
    evidence: {
      kind: "drivers", title: `${f.focus.state} primary driver attribution, ${monthName(f.month)}`,
      interpretation:
        `Each order carries one primary cause, so the shares add to 100%; Pending Customer Contact is a status many orders carry alongside another cause.` +
        (f.reclassMoved ? ` Journey root-cause analysis also moves ${fmtInt(f.reclassMoved)} cancellations from Customer Miss to Company Miss.` : ""),
    },
  };
}

function timingPoint(f: StoryFacts): NarrativePoint | null {
  const { port, portPrev } = f;
  if (port.postPct === null || !f.prev) return null;
  const shift = portPrev?.postPct != null ? port.postPct - portPrev.postPct : null;
  if (!f.d.anomaly && (shift ?? 0) < 0.03) {
    return {
      id: "timing", mode: "observed", label: "Lifecycle timing", tone: "neutral",
      text: `${link("Post ODD", hrefs.postOdd(f.month))} cancellations are ${fmtPct0(port.postPct)} of the total, broadly unchanged from ${fmtPct0(portPrev?.postPct)}.`,
      evidence: { kind: "timing", scope: null, title: "Cancellation timing by month", interpretation: "The lifecycle mix is stable; no late stage shift is present." },
    };
  }
  const late = f.lateDrivers.slice(0, 3).map((r) => `${r.label} (${fmtSignedPct(r.mom)})`);
  const fp = f.focusSnap?.postPct ?? null;
  return {
    id: "timing", mode: "observed", label: "Lifecycle timing", tone: "bad",
    text:
      `Most of the loss comes late: ${link("Post ODD", hrefs.postOdd(f.month))} cancellations reached **${fmtPct0(port.postPct)}** of the total (from ${fmtPct0(portPrev?.postPct)})` +
      (f.focus && fp !== null ? ` and **${fmtPct0(fp)}** in ${f.focus.state}` : "") +
      (late.length ? `, led by ${listJoin(late)}.` : "."),
    evidence: {
      kind: "timing", scope: f.focus?.state ?? null, title: `${f.focus ? `${f.focus.state} c` : "C"}ancellation timing by month`,
      interpretation: "Customers are increasingly lost after the committed installation date: an appointment journey failure rather than an early change of mind.",
    },
  };
}

function rootCausePoint(f: StoryFacts): NarrativePoint | null {
  if (f.hasStory || !f.d.anomaly) return null;
  const t =
    f.d.rootCause === "customer-readiness"
      ? `Customer contact signals rose while installation risk stayed low, pointing to a **customer engagement and appointment readiness** issue.`
      : f.d.rootCause === "operational"
        ? `Company side and installation readiness signals are rising, indicating an **operational readiness** issue.`
        : `Customer side and operational signals both moved; the cause is **mixed**.`;
  return {
    id: "root-cause", mode: "observed", label: "Journey root-cause analysis", tone: "bad", text: t,
    evidence: { kind: "watch", scope: f.focus?.state ?? null, title: "Watchtower signals on cancelled orders", interpretation: "The relative size of customer and installation signals separates the two kinds of cause." },
  };
}

function outlookPoint(f: StoryFacts): NarrativePoint | null {
  const fc = f.forecast;
  if (!f.hasStory || fc.noAction === null) return null;
  const total = f.interventions.total?.saves ?? null;
  const fs = f.forecastFocus;
  return {
    id: "outlook", mode: "preventive", label: "October risk outlook", tone: "warn",
    text:
      `Without action, ${fc.month ? monthName(fc.month) : "next month"} is projected at **${fmtPct(fc.noAction)}**` +
      (fs ? ` (${fs.state} **${fmtPct(fs.rate)}**)` : "") +
      `. Targeted intervention brings it to about **${fmtPct(fc.intervention)}**` +
      (total !== null ? `, protecting about **${fmtInt(total)}** orders once overlaps between the three layers are removed.` : "."),
    evidence: {
      kind: "forecast", title: "Cancel rate: actual, outlook and intervention",
      interpretation: `Acting now turns a further rise into the first recovery step, back toward the ${fmtPct(fc.baseline)} internal baseline.`,
    },
  };
}

// ------------------------------------------------------------------ Command Center
export function buildExecutiveNarrative(model: DataModel, month: MonthKey): StorySection {
  const f = storyFacts(model, month);
  const M = monthName(month);
  const { d } = f;
  let headline: string;
  if (!f.prev || d.cancelsMoM === null) headline = `${M}: baseline month`;
  else if (!d.anomaly) headline = `${M} performance is in line with trend.`;
  else if ((d.salesMoM ?? 0) <= 0) headline = `${M} cancellations rose sharply while sales declined.`;
  else if ((d.salesMoM ?? 0) < (d.cancelsMoM ?? 0) / 3) headline = `${M} cancellations deteriorated materially despite only modest sales growth.`;
  else headline = `${M} cancellations rose faster than sales.`;

  const points = [
    portfolioPoint(f), geographyPoint(f), channelPoint(f), salesQualityPoint(f), contactPoint(f), rootCausePoint(f), timingPoint(f), outlookPoint(f),
  ].filter((p): p is NarrativePoint => !!p);

  return {
    id: "executive",
    eyebrow: "Executive Summary",
    headline,
    status: !f.prev ? null : d.anomaly ? { label: "Exception detected", tone: "bad" } : { label: "In line with trend", tone: "good" },
    points,
  };
}

// ------------------------------------------------------------------ recommendations
export function buildRecommendations(model: DataModel, month: MonthKey): { items: Recommendation[]; dedup: number | null } {
  const f = storyFacts(model, month);
  const items = (["sales", "install", "contact"] as const)
    .map((k) => f.interventions[k])
    .filter((x): x is InterventionRow => !!x)
    .map((r) => ({
      id: r.kind, label: INTERVENTION_LABEL[r.kind], saves: r.saves, share: r.share, action: r.action, population: r.population,
      actionId: INTERVENTION_ACTION[r.kind] ?? null,
    }));
  return { items, dedup: f.interventions.total?.saves ?? null };
}

// ------------------------------------------------------------------ "What is happening?" for a state or channel plan
function changePoint(model: DataModel, month: MonthKey, scope: string, cur: Snapshot, prev: Snapshot | null): NarrativePoint {
  const name = scopeName(scope);
  const pm = prevMonth(model, month);
  const cMoM = rel(cur.cancels, prev?.cancels), sMoM = rel(cur.sales, prev?.sales);
  if (cMoM === null || sMoM === null) {
    return { id: "change", mode: "observed", label: "What changed", tone: "neutral", text: `${name} has no prior month comparison available.` };
  }
  const bad = cMoM > 0.05 && cMoM > sMoM + 0.05;
  return {
    id: "change", mode: "observed", label: "What changed", tone: bad ? "bad" : "good",
    text: bad
      ? `${name} cancellations rose **${abs(fmtSignedPct(cMoM))}** versus ${pm ? monthName(pm) : "the prior month"} while sales moved ${fmtSignedPct(sMoM)}; the cancel rate moved from ${fmtPct(prev?.cancelRate)} to **${fmtPct(cur.cancelRate)}**.`
      : `${name} cancellations moved ${fmtSignedPct(cMoM)} against sales of ${fmtSignedPct(sMoM)}, in line with volume, at a **${fmtPct(cur.cancelRate)}** cancel rate.`,
    evidence: { kind: "trend", scope, title: `${name} cancel rate by month`, interpretation: bad ? `${name} broke from its usual range in ${monthName(month)}.` : `${name} stayed within its usual range.` },
  };
}

function scopeTimingPoint(month: MonthKey, scope: string, cur: Snapshot, prev: Snapshot | null, port: Snapshot): NarrativePoint | null {
  if (cur.postPct === null) return null;
  const name = scopeName(scope);
  const state = isChannel(scope) ? null : scope;
  const late = cur.postPct > (port.postPct ?? 1) + 0.03 || cur.postPct - (prev?.postPct ?? cur.postPct) > 0.05;
  const pending = cur.pendingPct;
  return {
    id: "timing", mode: "observed", label: "Lifecycle timing", tone: late ? "bad" : "neutral",
    text:
      `**${fmtPct0(cur.postPct)}** of ${name} cancellations occur ${link("after the Original Due Date", hrefs.postOdd(month, state))}` +
      (prev?.postPct != null ? ` (${fmtPct0(prev.postPct)} prior)` : "") +
      `, against ${fmtPct0(port.postPct)} for the portfolio` +
      (pending !== null ? `; ${link("Pending Customer Contact", hrefs.watchtower(month, state))} sits at **${fmtPct0(pending)}**${prev?.pendingPct != null ? ` (from ${fmtPct0(prev.pendingPct)})` : ""}.` : "."),
    evidence: { kind: "timing", scope, title: `${name} cancellation timing`, interpretation: late ? "Customers here are lost late, after the committed date: an appointment journey problem." : "The timing mix is close to the portfolio; no late stage concentration." },
  };
}

export function buildScopeNarrative(model: DataModel, month: MonthKey, scope: string): NarrativePoint[] {
  const f = storyFacts(model, month);
  const name = scopeName(scope);
  const pm = prevMonth(model, month);
  const cur = getSnapshot(model, month, scope);
  const prev = pm ? getSnapshot(model, pm, scope) : null;
  const port = getSnapshot(model, month, null);
  const out: NarrativePoint[] = [changePoint(model, month, scope, cur, prev)];
  const st = model.story;

  if (!isChannel(scope)) {
    // Channels inside this state
    const rows = month === model.drillMonth ? model.stateChannel.filter((r) => r.state === scope).sort((a, b) => (b.cancelRate ?? 0) - (a.cancelRate ?? 0)) : [];
    if (rows.length) {
      const isFocus = f.focus?.state === scope;
      const outl = isFocus ? f.outlierChannels.map((c) => c.channel) : [];
      const rest = rows.filter((r) => !outl.includes(r.channel)).map((r) => r.cancelRate);
      const restRange = rest.length ? ([Math.min(...(rest as number[])), Math.max(...(rest as number[]))] as [number, number]) : null;
      out.push({
        id: "channels", mode: "observed", label: "Channel", tone: outl.length ? "bad" : "neutral",
        text: outl.length
          ? `${listJoin(outl.map((c) => channelLink(c, month)))} run at ${listJoin(outl.map((c) => `**${fmtPct(rows.find((r) => r.channel === c)?.cancelRate ?? null)}**`))}, while the other channels run ${between(restRange)}.`
          : `Channel cancel rates sit ${between(restRange)}; no channel stands out.`,
        evidence: { kind: "scope-channels", state: scope, highlight: outl, title: `${name} cancel rate by channel`, interpretation: outl.length ? `The problem is concentrated in ${listJoin(outl)}.` : "Every channel is close to the others." },
      });
    }
    if (f.hasStory && f.focus?.state === scope) {
      const s = f.drivers.sales, c = f.drivers.contact, co = f.drivers.company;
      if (s && c) {
        out.push({
          id: "drivers", mode: "observed", label: "Journey root-cause analysis", tone: "bad",
          text: `Two causes: sales and agency quality (**${fmtInt(s.cancels)}**, ${fmtPct0(s.share)}) and the larger customer contact and appointment readiness problem (**${fmtInt(c.cancels)}**, ${fmtPct0(c.share)})` + (co ? `; operational causes add ${fmtPct0(co.share)}.` : "."),
          evidence: { kind: "drivers", title: `${name} primary driver attribution`, interpretation: "One primary cause per order; the two largest causes need different owners and different fixes." },
        });
      }
    }
  } else {
    // States inside this channel
    const ch = name;
    const rows = month === model.drillMonth ? model.stateChannel.filter((r) => r.channel === ch).sort((a, b) => (b.cancelRate ?? 0) - (a.cancelRate ?? 0)) : [];
    if (rows.length) {
      const top = rows[0];
      const rest = rows.slice(1).map((r) => r.cancelRate).filter((x): x is number => x !== null);
      const stands = rest.length && (top.cancelRate ?? 0) - Math.max(...rest) > 0.08;
      out.push({
        id: "states", mode: "observed", label: "Geography", tone: stands ? "bad" : "neutral",
        text: stands
          ? `The increase sits in ${stateLink(top.state, month)} at **${fmtPct(top.cancelRate)}**; elsewhere ${ch} runs ${between([Math.min(...rest), Math.max(...rest)])}.`
          : `${ch} cancel rates range ${between([Math.min(...rows.map((r) => r.cancelRate ?? 0)), Math.max(...rows.map((r) => r.cancelRate ?? 0))])} across states; no state stands out.`,
        evidence: { kind: "channel-states", channel: ch, highlight: stands ? [top.state] : [], title: `${ch} cancel rate by state`, interpretation: stands ? `${ch} is healthy outside ${top.state}; the channel problem is local.` : `${ch} behaves consistently across the footprint.` },
      });
    }
    if (f.hasStory && f.focus) {
      const ag = st.agencies.filter((a) => a.channel === ch);
      const weak = ag.filter((a) => f.weakAgencies.includes(a));
      if (ag.length) {
        out.push({
          id: "agencies", mode: "observed", label: "Sales quality analysis", tone: weak.length ? "bad" : "neutral",
          text: weak.length
            ? `In ${f.focus.state}, ${listJoin(weak.map((a) => `${a.agency} moved from its own ${fmtPct(a.baseline)} history to **${fmtPct(a.cancelRate)}**`))}.`
            : `In ${f.focus.state}, ${listJoin(ag.map((a) => `${a.agency} stayed near its own history (${fmtPct(a.cancelRate)} vs ${fmtPct(a.baseline)})`))}.`,
          evidence: { kind: "agencies", highlight: weak.map((a) => a.agency), title: `${f.focus.state} agencies vs own history`, interpretation: weak.length ? "The deterioration follows specific partners, not the channel as a whole." : "Agencies in this channel are performing to their own history." },
        });
      }
    }
  }

  const tp = scopeTimingPoint(month, scope, cur, prev, port);
  if (tp) out.push(tp);

  // Forward-looking outlook for this scope
  if (f.hasStory && f.forecast.month) {
    const FM = monthName(f.forecast.month);
    if (!isChannel(scope)) {
      const r = st.forecastStates.find((x) => x.state === scope);
      if (r) {
        const worse = (r.rate ?? 0) - (r.prevRate ?? 0) > 0.02;
        out.push({
          id: "outlook", mode: "preventive", label: `${FM} risk outlook`, tone: worse ? "warn" : "good",
          text: worse
            ? `Without action, ${FM} is projected at **${fmtPct(r.rate)}** on ${fmtInt(r.sales)} sales (${monthName(month)} ${fmtPct(r.prevRate)}). See the ${link("recommended interventions", hrefs.actions(month))}.`
            : `${FM} is projected at **${fmtPct(r.rate)}**, in line with ${monthName(month)} (${fmtPct(r.prevRate)}); no intervention is required here.`,
          evidence: { kind: "forecast-scope", scope, title: `${name}: ${monthName(month)} actual vs ${FM} outlook`, interpretation: worse ? `Without intervention ${name} deteriorates further in ${FM}.` : `${name} is expected to stay near its normal level.` },
        });
      }
    } else if (f.focus) {
      const r = st.forecastChannels.find((x) => !x.isTotal && x.channel === name);
      if (r) {
        const worse = (r.delta ?? 0) > 0.03;
        out.push({
          id: "outlook", mode: "preventive", label: `${FM} risk outlook`, tone: worse ? "warn" : "good",
          text: `In ${f.focus.state}, ${FM} ${name} is projected at **${fmtPct(r.rate)}** without action (${monthName(month)} ${fmtPct(r.prevRate)}, internal baseline ${fmtPct(r.baseline)}).`,
          evidence: { kind: "forecast-scope", scope, title: `${f.focus.state} ${name}: ${FM} outlook`, interpretation: worse ? "The channel keeps deteriorating unless risky orders are verified before installation." : "The channel stays close to its internal baseline." },
        });
      }
    }
  }
  return out.slice(0, 5);
}

// ------------------------------------------------------------------ "What is happening?" for the plan overview
export function buildPlanNarrative(model: DataModel, month: MonthKey): NarrativePoint[] {
  const f = storyFacts(model, month);
  const M = monthName(month);
  const out: NarrativePoint[] = [];
  const rows = stateRows(model, month);
  if (!f.focus) {
    out.push({
      id: "geography", mode: "observed", label: "Geography", tone: "good",
      text: `No state is outside its normal range in ${M}: cancellation growth ranges between ${growthRange([Math.min(...rows.map((r) => r.cancelsMoM ?? 0)), Math.max(...rows.map((r) => r.cancelsMoM ?? 0))])}.`,
      evidence: { kind: "ranking", dim: "state", metric: "cancelRate", highlight: [], title: `Cancel rate by state, ${M}`, interpretation: "States sit close together; no plan is required beyond routine monitoring." },
    });
    return out;
  }
  const g = geographyPoint(f);
  if (g) out.push({ ...g, text: g.text.replace(" explains ", " is the only state outside its normal range and explains ") });
  const top = f.portfolioChannels.filter((c) => (c.contribution ?? 0) > 0.25);
  if (top.length) {
    out.push({
      id: "channels", mode: "observed", label: "Channel", tone: "bad",
      text: `By channel, ${listJoin(top.map((c) => channelLink(c.channel, month)))} account for ${listJoin(top.map((c) => `**${fmtPct0(c.contribution)}**`))} of the portfolio increase.`,
      evidence: { kind: "ranking", dim: "channel", metric: "cancels", highlight: top.map((c) => c.channel), title: `Cancellations by channel, ${M}`, interpretation: `${listJoin(top.map((c) => c.channel))} drive the increase; the other channels moved little.` },
    });
  }
  if (f.outlierChannels.length) {
    const names = f.outlierChannels.map((c) => c.channel);
    const elsewhere = model.stateChannel.filter((r) => names.includes(r.channel) && r.state !== f.focus!.state).map((r) => r.cancelRate).filter((x): x is number => x !== null);
    out.push({
      id: "intersection", mode: "observed", label: "Where they meet", tone: "bad",
      text:
        `The deterioration sits where the two meet: ${f.focus.state} ${listJoin(names)} at ${listJoin(f.outlierChannels.map((c) => `**${fmtPct(c.rate)}**`))}` +
        (elsewhere.length ? `, while the same channels in other states run ${between([Math.min(...elsewhere), Math.max(...elsewhere)])}.` : "."),
      evidence: { kind: "scope-channels", state: f.focus.state, highlight: names, title: `${f.focus.state} cancel rate by channel`, interpretation: "A plan for these channels in this state addresses most of the exception." },
    });
  }
  if (f.hasStory && f.forecastFocus && f.forecast.month) {
    out.push({
      id: "outlook", mode: "preventive", label: `${monthName(f.forecast.month)} risk outlook`, tone: "warn",
      text: `Without action, ${monthName(f.forecast.month)} ${f.focus.state} is projected at **${fmtPct(f.forecastFocus.rate)}**` + (f.forecastOthers ? ` while every other state stays ${between(f.forecastOthers)}.` : "."),
      evidence: { kind: "forecast-scope", scope: f.focus.state, title: `${monthName(f.forecast.month)} outlook by state`, interpretation: `The outlook confirms ${f.focus.state} as the place to act; the rest of the footprint stays near normal.` },
    });
  }
  return out;
}
