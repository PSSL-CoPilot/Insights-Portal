"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowDown, ArrowRight, Play, Zap } from "lucide-react";
import { GenieMark } from "../ui/Marks";
import { useApp } from "../AppContext";
import { Badge, Card } from "../ui/primitives";
import { Sparkline } from "../ui/Sparkline";
import { NarrativeList } from "./NarrativeList";
import { ActionsDrawer } from "./ActionsDrawer";
import { buildExecutiveNarrative } from "@/lib/story/narrative";
import { buildStoryScenes } from "@/lib/story/scenes";
import { storyFacts } from "@/lib/story/facts";
import { series } from "@/lib/data/metrics";
import { fmtCompact, fmtPct, fmtSignedPct, monthLabel, monthName } from "@/lib/format";

// The player (and its map geometry) loads only when someone presses Play.
const WhatHappenedPlayer = dynamic(() => import("./WhatHappenedPlayer").then((m) => m.WhatHappenedPlayer), { ssr: false });

/** Command Center executive story: insight first, evidence on demand, then action. */
export function ExecutiveStory() {
  const { model, month } = useApp();
  const story = useMemo(() => buildExecutiveNarrative(model, month), [model, month]);
  const scenes = useMemo(() => buildStoryScenes(model, month), [model, month]);
  const f = storyFacts(model, month);
  const [playing, setPlaying] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const closePlayer = useCallback(() => setPlaying(false), []);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const takeAction = useCallback(() => {
    setPlaying(false);
    setDrawer(true);
  }, []);

  const cancelSeries = series(model, "cancels", null).filter((p) => p.month <= month).map((p) => p.value);
  const salesSeries = series(model, "sales", null).filter((p) => p.month <= month).map((p) => p.value);
  const up = (f.d.cancelsMoM ?? 0) > 0;

  return (
    <section aria-labelledby="exec-summary">
      <Card className="relative overflow-clip">
        <div className="glow pointer-events-none absolute -right-32 -top-32 size-[28rem] opacity-50" />
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,27%)]">
          <div className="p-6 sm:p-8 xl:px-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <GenieMark size={28} />
                <span className="eyebrow">{story.eyebrow}</span>
                <Badge>{monthLabel(month)}</Badge>
                {story.status && <Badge tone={story.status.tone === "bad" ? "bad" : "good"}>{story.status.label}</Badge>}
              </div>
              {scenes.length > 1 && (
                <button
                  onClick={() => setPlaying(true)}
                  className="group inline-flex h-10 items-center gap-2.5 rounded-full bg-panel pl-1.5 pr-4 text-[13.5px] font-semibold text-white shadow-pop transition-transform duration-300 hover:-translate-y-0.5"
                  aria-haspopup="dialog"
                >
                  <span className="bs-gradient grid size-7 place-items-center rounded-full text-[#111]"><Play className="size-3.5 translate-x-[1px] fill-current" /></span>
                  Play What Happened
                </button>
              )}
            </div>

            <h2 id="exec-summary" className="mt-4 max-w-4xl text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[34px]">{story.headline}</h2>

            <NarrativeList points={story.points} resetKey={month} className="mt-6" />

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
              <button
                onClick={() => setDrawer(true)}
                className="bs-gradient group inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-[#111] shadow-pop transition-transform duration-300 hover:-translate-y-0.5"
                aria-haspopup="dialog"
              >
                <Zap className="size-4" /> Take Action
              </button>
              <Link href={`/actions?month=${month}`} className="group inline-flex h-12 items-center gap-2 rounded-full border border-line bg-card px-5 text-[14px] font-semibold transition hover:border-ink">
                Open full Action Center <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <button onClick={() => document.getElementById("kpis")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="inline-flex h-12 items-center gap-1.5 px-2 text-[13px] font-semibold text-mute transition hover:text-ink">
                KPI command center <ArrowDown className="size-3.5" />
              </button>
            </div>
          </div>

          {/* headline numbers */}
          <div className="relative border-t border-line bg-panel p-6 text-white sm:p-8 lg:border-l lg:border-t-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">{monthName(month)} vs prior month</div>
            {f.prev ? (
              <div className="mt-5 space-y-6 lg:sticky lg:top-24">
                <div>
                  <div className="text-[13px] text-white/60">Cancellations</div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="num text-[52px] font-semibold leading-none" style={{ color: up ? "#ff7d6e" : "#4ade80" }}>{fmtSignedPct(f.d.cancelsMoM)}</div>
                      <div className="mt-2 text-[13px] text-white/60">{fmtCompact(f.port.cancels)} orders · cancel rate {fmtPct(f.port.cancelRate)}</div>
                    </div>
                    <Sparkline values={cancelSeries} color={up ? "#ff7d6e" : "#4ade80"} width={100} height={46} />
                  </div>
                </div>
                <div className="h-px bg-white/10" />
                <div>
                  <div className="text-[13px] text-white/60">Unique Sales</div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="num text-[38px] font-semibold leading-none" style={{ color: (f.d.salesMoM ?? 0) >= 0 ? "#4ade80" : "#ff7d6e" }}>{fmtSignedPct(f.d.salesMoM)}</div>
                      <div className="mt-2 text-[13px] text-white/60">{fmtCompact(f.port.sales)} sales</div>
                    </div>
                    <Sparkline values={salesSeries} color={(f.d.salesMoM ?? 0) >= 0 ? "#4ade80" : "#ff7d6e"} width={100} height={38} />
                  </div>
                </div>
                {f.forecast.noAction !== null && (
                  <>
                    <div className="h-px bg-white/10" />
                    <div>
                      <div className="flex items-center gap-2 text-[13px] text-white/60">
                        <span className="rounded-full bg-[#4fc7c0]/20 px-2 py-[1px] text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#7fe0d9]">Forward-looking</span>
                        {f.forecast.month ? monthName(f.forecast.month) : "Next month"}
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="num text-[26px] font-semibold leading-none text-[#ff9b90]">{fmtPct(f.forecast.noAction)}</span>
                        <ArrowRight className="size-4 text-white/40" />
                        <span className="num text-[26px] font-semibold leading-none text-[#7fe0d9]">{fmtPct(f.forecast.intervention)}</span>
                      </div>
                      <div className="mt-1.5 text-[12px] text-white/55">No action vs targeted intervention</div>
                    </div>
                  </>
                )}
                {f.d.anomaly && (f.d.salesMoM ?? 0) > 0 && (
                  <div className="rounded-2xl bg-white/[0.07] px-4 py-3 text-[13px] leading-snug text-white/80">
                    Cancellations are growing <strong className="bs-gradient-text">{((f.d.cancelsMoM ?? 0) / (f.d.salesMoM ?? 1)).toFixed(0)}×</strong> faster than sales.
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/60">First month in the dataset: no prior month is available for comparison.</p>
            )}
          </div>
        </div>
      </Card>

      <ActionsDrawer open={drawer} onClose={closeDrawer} />
      {playing && <WhatHappenedPlayer scenes={scenes} month={month} onClose={closePlayer} onTakeAction={takeAction} />}
    </section>
  );
}
