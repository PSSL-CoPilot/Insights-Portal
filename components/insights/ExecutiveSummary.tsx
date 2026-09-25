"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowRight, MapPin, Sparkles } from "lucide-react";
import { useApp } from "../AppContext";
import { diagnose, executiveSummary } from "@/lib/data/narratives";
import { getSnapshot, series } from "@/lib/data/metrics";
import { fmtCompact, fmtPct, fmtPct0, fmtSignedPct, monthLabel, monthName, stateSlug } from "@/lib/format";
import { Badge, Card, LinkButton, RichText } from "../ui/primitives";
import { Sparkline } from "../ui/Sparkline";

export function ExecutiveSummary() {
  const { model, month } = useApp();
  const sum = useMemo(() => executiveSummary(model, month), [model, month]);
  const d = useMemo(() => diagnose(model, month), [model, month]);
  const cur = getSnapshot(model, month, null);
  const cancelSeries = series(model, "cancels", null).filter((p) => p.month <= month).map((p) => p.value);
  const salesSeries = series(model, "sales", null).filter((p) => p.month <= month).map((p) => p.value);
  const q = `month=${month}`;
  const hot = d.anomaly ? d.hotspot?.state : null;

  const scrollToKpis = () => document.getElementById("kpis")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section aria-labelledby="exec-summary">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative grid gap-0 lg:grid-cols-[1.7fr_1fr]">
          <div className="p-6 sm:p-9">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-full bg-ink text-brand"><Sparkles className="size-3.5" /></span>
              <span className="eyebrow">Executive summary</span>
              <Badge>{monthLabel(month)}</Badge>
              {d.anomaly ? <Badge tone="bad">Anomaly detected</Badge> : d.prev ? <Badge tone="good">In line with trend</Badge> : null}
            </div>
            <h2 id="exec-summary" className="mt-4 max-w-2xl text-[30px] font-semibold leading-[1.15] tracking-tight sm:text-[34px]">
              {sum.headline}
            </h2>
            <div className="mt-5 max-w-3xl space-y-3.5 text-[15.5px] leading-[1.65] text-ink-2">
              {sum.paragraphs.map((p, i) => (
                <p key={`${month}-${i}`} className="animate-rise" style={{ animationDelay: `${120 + i * 110}ms` }}>
                  <RichText text={p} />
                </p>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={scrollToKpis}
                className="group inline-flex h-14 items-center gap-3 rounded-full bg-ink pl-7 pr-3 text-[16px] font-semibold text-white shadow-pop transition hover:-translate-y-0.5 hover:bg-ink-2"
              >
                Explore
                <span className="grid size-9 place-items-center rounded-full bg-brand text-ink transition group-hover:translate-y-0.5">
                  <ArrowDown className="size-4" />
                </span>
              </button>
              <span className="hidden text-xs text-mute sm:block">Start with the KPI command center below</span>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {hot && (
                <LinkButton href={`/states/${stateSlug(hot)}?${q}`} size="sm">
                  <MapPin className="size-3.5 text-bad" /> Explore {hot}
                </LinkButton>
              )}
              <LinkButton href={`/cancellations?tab=timing&bucket=post&${q}`} size="sm">View Post-ODD Analysis</LinkButton>
              <LinkButton href={`/cancellations?tab=miss&${q}`} size="sm">Review Customer Miss</LinkButton>
              <LinkButton href={`/actions?${q}#rescue`} size="sm">View Rescue Opportunities</LinkButton>
            </div>
          </div>

          {/* hero numbers */}
          <div className="relative border-t border-line bg-ink p-6 text-white sm:p-9 lg:border-l lg:border-t-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">{monthName(month)} vs prior month</div>
            {d.prev ? (
              <div className="mt-5 space-y-7">
                <div>
                  <div className="text-[13px] text-white/60">Cancellations</div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="num text-[56px] font-semibold leading-none" style={{ color: d.anomaly ? "#ff7d81" : "#fff" }}>{fmtSignedPct(d.cancelsMoM)}</div>
                      <div className="mt-2 text-[13px] text-white/60">{fmtCompact(cur.cancels)} orders · cancel rate {fmtPct(cur.cancelRate)}</div>
                    </div>
                    <Sparkline values={cancelSeries} color={d.anomaly ? "#ff7d81" : "#FFC72C"} width={110} height={48} />
                  </div>
                </div>
                <div className="h-px bg-white/10" />
                <div>
                  <div className="text-[13px] text-white/60">Unique Sales</div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="num text-[40px] font-semibold leading-none">{fmtSignedPct(d.salesMoM)}</div>
                      <div className="mt-2 text-[13px] text-white/60">{fmtCompact(cur.sales)} sales</div>
                    </div>
                    <Sparkline values={salesSeries} color="#b9b6f2" width={110} height={40} />
                  </div>
                </div>
                {d.anomaly && (
                  <div className="rounded-2xl bg-white/[0.07] px-4 py-3 text-[13px] leading-snug text-white/80">
                    Cancellations are growing <strong className="text-brand">{((d.cancelsMoM ?? 0) / Math.max(d.salesMoM ?? 0.0001, 0.0001)).toFixed(0)}×</strong> faster than sales.
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/60">First month in the workbook — no prior month to compare against.</p>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
