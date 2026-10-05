/**
 * Guided "What happened" briefing. Scenes are chosen from the data: each one is emitted only when
 * the facts it needs exist, so a month without an exception (or a workbook without the agency and
 * prevention sheets) produces a shorter, still truthful story.
 */
import type { DataModel, MonthKey } from "../data/types";
import { stateRows } from "../data/metrics";
import { fmtInt, fmtPct, fmtPct0, fmtPp, fmtSignedPct, monthName, monthShort } from "../format";
import { storyFacts } from "./facts";
import { buildRecommendations } from "./narrative";
import { listJoin } from "./links";
import type { SceneLayout, SceneVisual, StoryModel, StoryScene } from "./types";
import { buildExecutiveNarrative } from "./narrative";

const SIGNAL_LABELS = [
  ["lowIntent", "Low intent in sales transcripts"],
  ["promo", "Promotion dependent orders"],
  ["competitor", "Competitor mentioned at sale"],
  ["failedConfirm", "Failed independent confirmation"],
] as const;
const SIGNAL_SHORT: Record<string, string> = {
  "Low intent in sales transcripts": "low intent",
  "Promotion dependent orders": "promotion dependent",
  "Competitor mentioned at sale": "competitor mentioned",
  "Failed independent confirmation": "failed independent confirmation",
};
/** Narration placement per scene: a deliberate mix so text moves around the visual. */
const LAYOUT: Record<string, SceneLayout> = {
  portfolio: "top", geography: "right", channels: "bottom", agencies: "right", "sales-prevention": "top", split: "bottom",
  timing: "left", journey: "top", "install-prevention": "right", "contact-prevention": "bottom", outlook: "left", recommendations: "top",
};

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const count = (n: number) => WORDS[n] ?? String(n);

export function buildStoryScenes(model: DataModel, month: MonthKey): StoryScene[] {
  const f = storyFacts(model, month);
  const M = monthName(month);
  const P = f.prev ? monthName(f.prev) : "the prior month";
  const scenes: StoryScene[] = [];
  const add = (s: Omit<StoryScene, "layout">) => scenes.push({ ...s, layout: LAYOUT[s.id] ?? "top" });
  const rows = stateRows(model, month);
  const h = f.focus;

  // The footprint first appears neutral; the focus state turns red when the story reaches it.
  const mapStates = (reveal: boolean): Extract<SceneVisual, { kind: "map" }>["states"] =>
    rows.map((r) => ({
      name: r.state, value: r.cancelsMoM, label: fmtSignedPct(r.cancelsMoM),
      severity: reveal && h?.state === r.state ? "critical" : reveal && (r.cancelsMoM ?? 0) > 0.1 ? "warning" : "normal",
    }));

  // 1. Portfolio
  add({
    id: "portfolio", mode: "observed", kicker: "Portfolio", duration: 9000,
    title: f.d.anomaly ? `${M} broke from a stable year` : `${M} stayed in line with trend`,
    body: f.d.anomaly
      ? `Through ${P} the cancel rate held near **${fmtPct(f.baselineRate)}**. In ${M} cancellations rose **${fmtSignedPct(f.d.cancelsMoM)}** on **${fmtSignedPct(f.d.salesMoM)}** sales, lifting the rate to **${fmtPct(f.port.cancelRate)}**.`
      : `Cancellations moved ${fmtSignedPct(f.d.cancelsMoM)} on ${fmtSignedPct(f.d.salesMoM)} sales, a cancel rate of **${fmtPct(f.port.cancelRate)}**. No state or channel is outside its normal range.`,
    visual: { kind: "map", zoom: null, states: mapStates(!h) },
  });
  if (!h) return scenes;

  // 2. Geography
  add({
    id: "geography", mode: "observed", kicker: "Geography", duration: 9000,
    title: `One state explains the increase`,
    body: `**${h.state}** cancellations rose **${fmtSignedPct(h.cancelsMoM)}**, **${fmtPct0(h.contribution)}** of the portfolio increase, at a **${fmtPct(h.cancelRate)}** cancel rate.${f.otherGrowth ? ` Every other state moved between ${fmtSignedPct(f.otherGrowth[0])} and ${fmtSignedPct(f.otherGrowth[1])}.` : ""}`,
    visual: { kind: "map", zoom: h.state, states: mapStates(true) },
  });

  // 3. Channels inside the focus state
  if (f.outlierChannels.length) {
    const names = f.outlierChannels.map((c) => c.channel);
    add({
      id: "channels", mode: "observed", kicker: `${h.state} channels`, duration: 9000,
      title: f.outlierChannels.length > 1 ? `${count(f.outlierChannels.length)} channels carry the deterioration` : `One channel carries the deterioration`,
      body: `Inside ${h.state}, ${listJoin(f.outlierChannels.map((c) => `**${c.channel}** (${fmtPct(c.rate)})`))} cancel at more than twice the rate of every other channel${f.normalChannelRate ? ` (${fmtPct0(f.normalChannelRate[0])} to ${fmtPct0(f.normalChannelRate[1])})` : ""}.`,
      visual: { kind: "channels", state: h.state, rows: f.focusChannels.map((c) => ({ channel: c.channel, rate: c.rate, sales: c.sales, outlier: names.includes(c.channel) })), normal: f.normalChannelRate },
    });
  }

  if (f.hasStory) {
    // 4. Agencies and representatives
    if (f.weakAgencies.length) {
      const gaps = f.weakAgencies.map((a) => a.gap ?? 0);
      const c = f.cohort;
      add({
        id: "agencies", mode: "observed", kicker: "Agency and representative", duration: 10000,
        title: `Selected agencies broke from their own history`,
        body:
          `${listJoin(f.weakAgencies.map((a) => a.agency))} run **${fmtPp(Math.min(...gaps))} to ${fmtPp(Math.max(...gaps))}** above their own January to ${P} rates.` +
          (c ? ` At ${c.agency}, new September representatives made **${fmtPct0(c.salesShare)}** of sales but **${fmtPct0(c.cancelShare)}** of cancellations (${fmtPct(c.rate)} cancel rate).` : ""),
        visual: {
          kind: "agencies",
          rows: model.story.agencies.map((a) => ({ agency: a.agency, channel: a.channel, baseline: a.baseline, rate: a.cancelRate, gap: a.gap, weak: f.weakAgencies.includes(a) })),
          cohort: c ? { agency: c.agency, cohort: c.cohort, salesShare: c.salesShare, cancelShare: c.cancelShare, rate: c.rate } : null,
        },
      });

      // 5. Preventive sales quality
      const sig = SIGNAL_LABELS.map(([k, label]) => ({ label, value: f.signals[k] }));
      if (sig.some((s) => s.value !== null)) {
        const action = model.story.exampleOrder.find((x) => /recommended action/i.test(x.label))?.value ?? f.interventions.sales?.action ?? "";
        add({
          id: "sales-prevention", mode: "preventive", kicker: "Preventive: sales quality", duration: 10000,
          title: `Verify risky orders before they become cancellations`,
          body: `Across these agencies' orders: ${listJoin(sig.filter((s) => s.value !== null).map((s) => `**${fmtPct0(s.value)}** ${SIGNAL_SHORT[s.label]}`))}. Scoring every order lets risky sales be verified before installation is scheduled.`,
          visual: { kind: "sales-signals", signals: sig, example: model.story.exampleOrder.filter((x) => !/recommended action/i.test(x.label)), action },
        });
      }
    }

    // 6. The two problems
    const dr = f.drivers;
    if (dr.sales && dr.contact) {
      add({
        id: "split", mode: "observed", kicker: "Primary cause", duration: 10000,
        title: `${h.state} has two problems, not one`,
        body: `Sales and agency quality explains **${fmtInt(dr.sales.cancels)}** cancellations (**${fmtPct0(dr.sales.share)}**). Customer contact and appointment readiness explains **${fmtInt(dr.contact.cancels)}** (**${fmtPct0(dr.contact.share)}**), the larger share.${dr.company ? ` Operational causes add ${fmtPct0(dr.company.share)}` : ""}${dr.faux ? ` and faux or other ${fmtPct0(dr.faux.share)}.` : "."}`,
        visual: {
          kind: "split", total: dr.total?.cancels ?? null, signal: f.focusSnap?.pendingPct ?? null,
          parts: (["sales", "contact", "company", "faux"] as const).filter((k) => dr[k]).map((k) => ({
            kind: k, label: k === "sales" ? "Sales and agency quality" : k === "contact" ? "Customer contact and appointment readiness" : k === "company" ? "Company and operational" : "Faux and other",
            cancels: dr[k]!.cancels, share: dr[k]!.share, emphasis: k === "sales" || k === "contact",
          })),
        },
      });
    }
  }

  // 7. Timing
  if (f.port.postPct !== null) {
    add({
      id: "timing", mode: "observed", kicker: "Lifecycle timing", duration: 9000,
      title: `Customers are lost late`,
      body: `**${fmtPct0(f.port.postPct)}** of ${M} cancellations happened after the Original Due Date (${fmtPct0(f.portPrev?.postPct)} in ${monthShort(f.prev ?? month)}), rising to **${fmtPct0(f.focusSnap?.postPct)}** in ${h.state}.${f.lateDrivers.length ? ` ${listJoin(f.lateDrivers.slice(0, 3).map((r) => r.label))} grew fastest.` : ""}`,
      visual: {
        kind: "timing", portfolio: f.port.postPct, focus: f.focusSnap?.postPct ?? null, focusName: h.state, prev: f.portPrev?.postPct ?? null,
        drivers: f.lateDrivers.slice(0, 3).map((r) => ({ label: r.label, count: r.count, mom: r.mom })),
      },
    });
  }

  // 8. Customer-contact journey
  const path = model.workbookNotes.journeyPath?.replace(/\.$/, "").split("→").map((x) => x.trim()).filter(Boolean) ?? [];
  if (path.length >= 4) {
    const pending = f.focusSnap?.pendingPct ?? null;
    const n = path.length;
    add({
      id: "journey", mode: "observed", kicker: "Customer-contact journey", duration: 13000,
      title: `How an unresolved appointment becomes a cancellation`,
      body: `The customer does not confirm, reschedules, then goes quiet until the technician finds no one home.${pending !== null ? ` **${fmtPct0(pending)}** of ${h.state} cancellations carried Pending Customer Contact: a signal visible before the loss.` : ""}`,
      visual: {
        kind: "journey",
        nodes: path.map((label, i) => ({
          label: label.charAt(0).toUpperCase() + label.slice(1),
          severity: i < Math.ceil(n * 0.25) ? "neutral" : i < n - 2 ? "warning" : "critical",
          badge: /pending/i.test(label) && pending !== null ? fmtPct0(pending) : undefined,
        })),
      },
    });
  }

  if (!f.hasStory) return scenes;
  const st = model.story;

  // 9. Installation readiness prevention
  const segs = st.segments.filter((s) => !s.isTotal);
  if (segs.length) {
    const total = st.segments.find((s) => s.isTotal)?.orders ?? segs.reduce((a, s) => a + (s.orders ?? 0), 0);
    add({
      id: "install-prevention", mode: "preventive", kicker: "Preventive: installation readiness", duration: 10000,
      title: `Fix installation readiness where it matters`,
      body: `**${fmtInt(total)}** ${h.state} delivery-risk orders split into ${count(segs.length).toLowerCase()} segments, each with its own action${f.interventions.install?.saves != null ? `. Potential saves: **${fmtInt(f.interventions.install.saves)}**.` : "."}`,
      visual: {
        kind: "install", total, saves: f.interventions.install?.saves ?? null,
        segments: segs.map((s) => ({ label: s.segment, orders: s.orders, action: s.action, signal: s.signal })),
        example: st.exampleInstall,
      },
    });
  }

  // 10. Customer-contact prevention
  const cr = f.contactRisk;
  if (cr.orders !== null) {
    add({
      id: "contact-prevention", mode: "preventive", kicker: "Preventive: customer contact", duration: 10000,
      title: `Rescue the customer-contact journey`,
      body: `**${fmtInt(cr.orders)}** ${h.state} orders carry contact risk; about **${fmtInt(cr.projected)}** would cancel without help. Cause-specific confirmation, rebooking and outreach can protect about **${fmtInt(cr.protectable)}**.`,
      visual: { kind: "contact", funnel: st.contactRisk.map((r) => ({ label: r.label, value: r.value })), rules: st.contactRules },
    });
  }

  // 11. Outlook
  const fc = f.forecast;
  if (fc.noAction !== null) {
    const FM = fc.month ? monthName(fc.month) : "Next month";
    add({
      id: "outlook", mode: "preventive", kicker: `${FM} outlook`, duration: 10000,
      title: `${FM}: act now or deteriorate further`,
      body: `Internal baseline **${fmtPct(fc.baseline)}**, ${M} **${fmtPct(fc.actual)}**. Without action ${FM} reaches **${fmtPct(fc.noAction)}**; with targeted intervention about **${fmtPct(fc.intervention)}**.`,
      visual: {
        kind: "outlook", saves: f.interventions.total?.saves ?? null,
        steps: [
          { label: "Internal baseline", rate: fc.baseline, mode: "observed" },
          { label: `${M} actual`, rate: fc.actual, mode: "observed" },
          { label: `${FM}: no action`, rate: fc.noAction, mode: "preventive" },
          { label: `${FM}: with intervention`, rate: fc.intervention, mode: "preventive" },
        ],
      },
    });
  }

  // 12. Recommendations
  const rec = buildRecommendations(model, month);
  if (rec.items.length) {
    add({
      id: "recommendations", mode: "preventive", kicker: "Recommended intervention", duration: 12000,
      title: `${count(rec.items.length)} interventions, one prevention target`,
      body: `${listJoin(rec.items.map((r) => `${r.label.toLowerCase()} (**${fmtInt(r.saves)}**)`))}${rec.dedup !== null ? ` protect about **${fmtInt(rec.dedup)}** orders, counted once per order.` : "."}`.replace(/^./, (c) => c.toUpperCase()),
      visual: { kind: "recommendations", items: rec.items, total: rec.dedup },
    });
  }
  return scenes;
}

export function buildStoryModel(model: DataModel, month: MonthKey): StoryModel {
  const rec = buildRecommendations(model, month);
  return { month, executive: buildExecutiveNarrative(model, month), scenes: buildStoryScenes(model, month), recommendations: rec.items, dedupSaves: rec.dedup };
}
