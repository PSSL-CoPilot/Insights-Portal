"use client";

import { Fragment, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, ShieldCheck, TrendingDown, Zap } from "lucide-react";
import { cn } from "../ui/primitives";
import { ChannelIcon } from "./ChannelIcon";
import type { SceneVisual } from "@/lib/story/types";
import { fmtInt, fmtPct, fmtPct0, fmtPp, fmtSignedPct } from "@/lib/format";

const ease = [0.2, 0.8, 0.2, 1] as const;
const RED = "#ff6b5e";
const AMBER = "#f5a524";
const TEAL = "#4fc7c0";
const MUTED = "rgba(255,255,255,0.28)";

function Panel({ title, children, className, tone = "observed" }: { title?: string; children: ReactNode; className?: string; tone?: "observed" | "preventive" }) {
  return (
    <div className={cn("rounded-[20px] border p-5 sm:p-6", tone === "preventive" ? "border-[#4fc7c0]/25 bg-[#4fc7c0]/[0.05]" : "border-white/10 bg-white/[0.04]", className)}>
      {title && <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{title}</div>}
      {children}
    </div>
  );
}

/** Horizontal bar that grows with a transform (scaleX), never a width animation. */
function Bar({ value, max, color, delay = 0, height = 10, className }: { value: number | null; max: number; color: string; delay?: number; height?: number; className?: string }) {
  const w = value === null || max <= 0 ? 0 : Math.min(1, value / max);
  return (
    <div className={cn("relative w-full overflow-hidden rounded-full bg-white/[0.07]", className)} style={{ height }}>
      <motion.div
        className="absolute inset-y-0 left-0 w-full rounded-full"
        style={{ background: color, transformOrigin: "0 50%" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: w }}
        transition={{ duration: 0.9, ease, delay }}
      />
    </div>
  );
}

const rise = (i: number, base = 0.15) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease, delay: base + i * 0.09 },
});

export function SceneVisualView({ visual, actions }: { visual: SceneVisual; actions?: ReactNode }) {
  switch (visual.kind) {
    case "map":
      return visual.zoom ? null : <MapLegend states={visual.states} />;
    case "channels": {
      const max = Math.max(...visual.rows.map((r) => r.rate ?? 0)) * 1.08;
      return (
        <Panel title={`${visual.state} cancel rate by channel`}>
          <div className="space-y-3">
            {visual.rows.map((r, i) => (
              <motion.div key={r.channel} {...rise(i)} className="grid grid-cols-[150px_1fr_64px] items-center gap-3">
                <div className={cn("flex items-center gap-2 text-[14px]", r.outlier ? "font-semibold text-white" : "text-white/65")}>
                  <span className={cn("grid size-7 place-items-center rounded-lg", r.outlier ? "bg-[#ff6b5e]/20 text-[#ff8f85]" : "bg-white/[0.06] text-white/60")}><ChannelIcon channel={r.channel} className="size-3.5" /></span>
                  {r.channel}
                </div>
                <Bar value={r.rate} max={max} color={r.outlier ? RED : MUTED} delay={0.3 + i * 0.08} height={r.outlier ? 14 : 9} />
                <div className={cn("num text-right text-[15px] font-semibold", r.outlier ? "text-[#ff8f85]" : "text-white/70")}>{fmtPct(r.rate)}</div>
              </motion.div>
            ))}
          </div>
          {visual.normal && <div className="mt-4 text-[12.5px] text-white/50">Other channels: {fmtPct0(visual.normal[0])} to {fmtPct0(visual.normal[1])}</div>}
        </Panel>
      );
    }
    case "agencies": {
      const max = Math.max(...visual.rows.map((r) => r.rate ?? 0)) * 1.08;
      const c = visual.cohort;
      return (
        <div className="space-y-4">
          <Panel title="Agency cancel rate vs its own history">
            <div className="space-y-2.5">
              {visual.rows.map((r, i) => (
                <motion.div key={r.agency} {...rise(i, 0.1)} className="grid grid-cols-[170px_1fr_92px] items-center gap-3">
                  <div className={cn("flex items-center gap-2 truncate text-[13px]", r.weak ? "font-semibold text-white" : "text-white/55")}>
                    <ChannelIcon channel={r.channel} className="size-3.5 shrink-0 opacity-70" />{r.agency}
                  </div>
                  <div className="relative">
                    <Bar value={r.rate} max={max} color={r.weak ? RED : MUTED} delay={0.25 + i * 0.06} height={r.weak ? 12 : 8} />
                    {r.baseline !== null && (
                      <motion.span
                        aria-hidden
                        className="absolute -top-1 h-[calc(100%+8px)] w-[2px] rounded bg-white"
                        style={{ left: `${(r.baseline / max) * 100}%` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.9 }}
                        transition={{ delay: 0.9 + i * 0.05 }}
                      />
                    )}
                  </div>
                  <div className="num text-right text-[13px]">
                    <span className={r.weak ? "font-semibold text-white" : "text-white/60"}>{fmtPct0(r.rate)}</span>{" "}
                    {r.gap !== null && <span className={cn("text-[11px] font-bold", r.weak ? "text-[#ff8f85]" : "text-white/40")}>{fmtPp(r.gap)}</span>}
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11.5px] text-white/45"><span className="h-3 w-[2px] rounded bg-white" /> Own January to August history</div>
          </Panel>
          {c && (
            <Panel title={`${c.agency}: ${c.cohort}`}>
              <div className="space-y-3">
                {[
                  { label: "Share of agency sales", v: c.salesShare, color: "rgba(255,255,255,0.55)" },
                  { label: "Share of agency cancellations", v: c.cancelShare, color: RED },
                ].map((x, i) => (
                  <div key={x.label} className="grid grid-cols-[170px_1fr_52px] items-center gap-3">
                    <div className="text-[13px] text-white/70">{x.label}</div>
                    <Bar value={x.v} max={1} color={x.color} delay={1.1 + i * 0.25} height={14} />
                    <div className="num text-right text-[16px] font-semibold">{fmtPct0(x.v)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[12.5px] text-white/55">Cancel rate {fmtPct(c.rate)}</div>
            </Panel>
          )}
        </div>
      );
    }
    case "sales-signals":
      return (
        <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
          <Panel title="Sales quality signals" tone="preventive">
            <div className="space-y-4">
              {visual.signals.map((s, i) => (
                <motion.div key={s.label} {...rise(i)}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                    <span className="text-white/75">{s.label}</span>
                    <span className="num text-[17px] font-semibold text-white">{fmtPct0(s.value)}</span>
                  </div>
                  <Bar value={s.value} max={0.6} color={AMBER} delay={0.3 + i * 0.1} />
                </motion.div>
              ))}
            </div>
          </Panel>
          <Panel title="Example order score" tone="preventive">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
              {visual.example.map((e, i) => (
                <motion.div key={e.label} {...rise(i, 0.4)} className="contents">
                  <dt className="text-white/55">{e.label}</dt>
                  <dd className={cn("text-right font-semibold", /critical|low|high|yes/i.test(e.value) ? "text-[#ffb36b]" : "text-white")}>{e.value}</dd>
                </motion.div>
              ))}
            </dl>
            <motion.div {...rise(0, 1.3)} className="mt-5 flex items-center gap-2 rounded-xl bg-[#4fc7c0] px-3.5 py-2.5 text-[13.5px] font-semibold text-[#06201f]">
              <ShieldCheck className="size-4" /> {visual.action || "Verify before installation"}
            </motion.div>
          </Panel>
        </div>
      );
    case "split": {
      const color = (k: string) => (k === "contact" ? RED : k === "sales" ? AMBER : k === "company" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)");
      return (
        <Panel title={`Primary cause of ${fmtInt(visual.total)} cancellations, one per order`}>
          <div className="flex h-16 w-full overflow-hidden rounded-2xl">
            {visual.parts.map((p, i) => (
              <motion.div
                key={p.kind}
                className="h-full"
                style={{ width: `${(p.share ?? 0) * 100}%`, background: color(p.kind), transformOrigin: "0 50%" }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease, delay: 0.3 + i * 0.35 }}
              />
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {visual.parts.map((p, i) => (
              <motion.div key={p.kind} {...rise(i, 0.5)} className={cn("rounded-xl p-3.5", p.emphasis ? "bg-white/[0.07]" : "bg-white/[0.03]")}>
                <div className="flex items-center gap-2 text-[12.5px] text-white/70"><span className="size-2.5 rounded-full" style={{ background: color(p.kind) }} />{p.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={cn("num font-semibold", p.emphasis ? "text-[28px]" : "text-[20px] text-white/80")}>{fmtInt(p.cancels)}</span>
                  <span className="num text-[15px] text-white/60">{fmtPct0(p.share)}</span>
                </div>
              </motion.div>
            ))}
          </div>
          {visual.signal !== null && (
            <motion.div {...rise(0, 2)} className="mt-4 rounded-xl border border-dashed border-white/20 p-3.5">
              <div className="mb-2 flex items-baseline justify-between text-[12.5px]">
                <span className="text-white/65">Pending Customer Contact <em>signal</em> (a status, not a cause)</span>
                <span className="num text-[16px] font-semibold">{fmtPct0(visual.signal)}</span>
              </div>
              <Bar value={visual.signal} max={1} color="rgba(255,255,255,0.35)" delay={2.1} height={6} />
            </motion.div>
          )}
        </Panel>
      );
    }
    case "timing":
      return (
        <div className="space-y-4">
          <Panel title="Share of cancellations after the Original Due Date">
            <div className="space-y-5">
              {[
                { label: "Prior month, portfolio", v: visual.prev, color: MUTED },
                { label: "Portfolio", v: visual.portfolio, color: AMBER },
                ...(visual.focusName ? [{ label: visual.focusName, v: visual.focus, color: RED }] : []),
              ].map((x, i) => (
                <motion.div key={x.label} {...rise(i)}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[13.5px] text-white/75">{x.label}</span>
                    <span className="num text-[26px] font-semibold">{fmtPct0(x.v)}</span>
                  </div>
                  <Bar value={x.v} max={1} color={x.color} delay={0.3 + i * 0.2} height={12} />
                </motion.div>
              ))}
            </div>
          </Panel>
          {visual.drivers.length > 0 && (
            <Panel title="Fastest growing late stage reasons">
              <div className="space-y-2">
                {visual.drivers.map((d, i) => (
                  <motion.div key={d.label} {...rise(i, 0.9)} className="flex items-center justify-between gap-3 text-[13.5px]">
                    <span className="text-white/80">{d.label}</span>
                    <span className="flex items-center gap-3"><span className="num text-white/60">{fmtInt(d.count)}</span><span className="num rounded-full bg-[#ff6b5e]/20 px-2 py-0.5 text-[12px] font-bold text-[#ff8f85]">{fmtSignedPct(d.mom)}</span></span>
                  </motion.div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      );
    case "journey":
      return <JourneyFlow nodes={visual.nodes} />;
    case "install":
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {visual.segments.map((s, i) => (
              <motion.div key={s.label} {...rise(i)} className="rounded-[18px] border border-[#4fc7c0]/20 bg-[#4fc7c0]/[0.05] p-4">
                <div className="num text-[28px] font-semibold leading-none">{fmtInt(s.orders)}</div>
                <div className="mt-1.5 text-[12.5px] leading-snug text-white/70">{s.label}</div>
                <div className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#7fe0d9]"><ArrowRight className="size-3.5" />{s.action}</div>
              </motion.div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            {visual.example.length > 0 && (
              <Panel title="Example order" tone="preventive" className="!p-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
                  {visual.example.map((e) => (
                    <Fragment key={e.label}><dt className="text-white/55">{e.label}</dt><dd className={cn("text-right font-semibold", /recommended/i.test(e.label) && "text-[#7fe0d9]")}>{e.value}</dd></Fragment>
                  ))}
                </dl>
              </Panel>
            )}
            {visual.saves !== null && (
              <motion.div {...rise(0, 0.9)} className="flex flex-col justify-center rounded-[18px] bg-[#4fc7c0] px-6 py-4 text-[#06201f]">
                <div className="num text-[34px] font-semibold leading-none">{fmtInt(visual.saves)}</div>
                <div className="mt-1 text-[12.5px] font-semibold">potential saves</div>
              </motion.div>
            )}
          </div>
        </div>
      );
    case "contact": {
      const max = Math.max(...visual.funnel.map((f) => f.value ?? 0));
      return (
        <div className="space-y-4">
          <Panel title="Contact risk population" tone="preventive">
            <div className="space-y-4">
              {visual.funnel.map((f, i) => (
                <motion.div key={f.label} {...rise(i)}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]"><span className="text-white/75">{f.label}</span><span className="num text-[22px] font-semibold">{fmtInt(f.value)}</span></div>
                  <Bar value={f.value} max={max} color={i === visual.funnel.length - 1 ? TEAL : i === 1 ? RED : "rgba(255,255,255,0.4)"} delay={0.3 + i * 0.3} height={12} />
                </motion.div>
              ))}
            </div>
          </Panel>
          <Panel title="Rules that trigger the rescue" tone="preventive">
            <ul className="space-y-2">
              {visual.rules.map((r, i) => (
                <motion.li key={r.label} {...rise(i, 1.1)} className="grid grid-cols-[18px_1fr] gap-2 text-[13px]">
                  <Check className="mt-0.5 size-4 text-[#7fe0d9]" />
                  <span><span className="text-white/60">{r.label}:</span> <span className="font-semibold text-white">{r.value}</span></span>
                </motion.li>
              ))}
            </ul>
          </Panel>
        </div>
      );
    }
    case "outlook": {
      const max = Math.max(...visual.steps.map((s) => s.rate ?? 0)) * 1.15;
      const color = (i: number, mode: string) => (mode === "observed" ? (i === 0 ? "rgba(255,255,255,0.4)" : RED) : i === visual.steps.length - 1 ? TEAL : "#f08a80");
      return (
        <Panel title="Portfolio cancel rate">
          <div className="flex h-[260px] items-end gap-3 sm:gap-5">
            {visual.steps.map((s, i) => (
              <div key={s.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <motion.div {...rise(i, 0.4 + i * 0.35)} className="num text-[20px] font-semibold sm:text-[24px]">{fmtPct(s.rate)}</motion.div>
                <motion.div
                  className={cn("w-full rounded-t-xl", s.mode === "preventive" && i < visual.steps.length - 1 && "border-2 border-dashed border-[#f08a80] !bg-[#f08a80]/25")}
                  style={{ height: `${((s.rate ?? 0) / max) * 100}%`, background: color(i, s.mode), transformOrigin: "50% 100%" }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.8, ease, delay: 0.3 + i * 0.35 }}
                />
                <div className={cn("text-center text-[11.5px] leading-tight", s.mode === "preventive" ? "text-[#7fe0d9]" : "text-white/60")}>{s.label}</div>
              </div>
            ))}
          </div>
          {visual.saves !== null && (
            <motion.div {...rise(0, 1.9)} className="mt-4 flex items-center gap-2 rounded-xl bg-[#4fc7c0]/15 px-3.5 py-2.5 text-[13px] text-[#a6efe9]">
              <TrendingDown className="size-4" /> About <strong className="num text-white">{fmtInt(visual.saves)}</strong> orders protected by targeted intervention
            </motion.div>
          )}
        </Panel>
      );
    }
    case "recommendations":
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {visual.items.map((r, i) => (
              <motion.div key={r.id} {...rise(i, 0.2)} className="flex flex-col rounded-[18px] border border-[#4fc7c0]/25 bg-[#4fc7c0]/[0.06] p-4">
                <div className="text-[12.5px] font-semibold text-[#7fe0d9]">{r.label}</div>
                <div className="num mt-2 text-[34px] font-semibold leading-none">{fmtInt(r.saves)}</div>
                <div className="mt-1 text-[11.5px] text-white/50">potential saves</div>
                <div className="mt-3 text-[12.5px] leading-snug text-white/75">{r.action}</div>
              </motion.div>
            ))}
          </div>
          {visual.total !== null && (
            <motion.div {...rise(0, 0.8)} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#4fc7c0] px-5 py-4 text-[#06201f]">
              <div className="flex items-center gap-3"><ShieldCheck className="size-6" /><div><div className="num text-[30px] font-semibold leading-none">{fmtInt(visual.total)}</div><div className="text-[12.5px] font-semibold">orders potentially protected, counted once per order</div></div></div>
            </motion.div>
          )}
          {actions && <motion.div {...rise(0, 1.1)}>{actions}</motion.div>}
        </div>
      );
  }
}

function MapLegend({ states }: { states: Extract<SceneVisual, { kind: "map" }>["states"] }) {
  const rows = [...states].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((s, i) => (
        <motion.div key={s.name} {...rise(i, 0.5)} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px]", s.severity === "critical" ? "border-[#ff6b5e]/50 bg-[#ff6b5e]/15" : "border-white/10 bg-white/[0.05]")}>
          <span className="text-white/75">{s.name}</span>
          <span className={cn("num font-semibold", s.severity === "critical" ? "text-[#ff8f85]" : "text-white")}>{s.label}</span>
        </motion.div>
      ))}
      <div className="w-full pt-1 text-[11.5px] text-white/45">Cancellation change vs prior month</div>
    </div>
  );
}

const SEV = {
  neutral: { ring: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.08)", text: "text-white/85" },
  warning: { ring: AMBER, bg: "rgba(245,165,36,0.16)", text: "text-[#ffd18a]" },
  critical: { ring: RED, bg: "rgba(255,107,94,0.18)", text: "text-[#ffaaa2]" },
} as const;

/** Lifecycle chain that lights up step by step, moving from neutral to warning to critical. */
function JourneyFlow({ nodes }: { nodes: Extract<SceneVisual, { kind: "journey" }>["nodes"] }) {
  const step = 0.9;
  return (
    <Panel title="Representative order journey">
      <ol className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
        {nodes.map((n, i) => {
          const s = SEV[n.severity];
          return (
            <motion.li
              key={n.label}
              className="relative"
              initial={{ opacity: 0.18, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.3 + i * step }}
            >
              <div className="relative rounded-2xl border p-3.5" style={{ borderColor: s.ring, background: s.bg }}>
                <div className="flex items-center justify-between">
                  <span className="num grid size-6 place-items-center rounded-full text-[11px] font-bold text-[#0a0f1c]" style={{ background: s.ring }}>{i + 1}</span>
                  {n.badge && (
                    <motion.span
                      className="num rounded-full bg-[#ff6b5e] px-2 py-0.5 text-[12px] font-bold text-white"
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.25, 1] }}
                      transition={{ duration: 0.6, delay: 0.6 + i * step }}
                    >
                      {n.badge}
                    </motion.span>
                  )}
                </div>
                <div className={cn("mt-2 text-[13.5px] font-semibold leading-snug", s.text)}>{n.label}</div>
              </div>
              {i < nodes.length - 1 && (
                <motion.span
                  aria-hidden
                  className="absolute -right-3 top-1/2 hidden h-[2px] w-3 sm:block"
                  style={{ background: SEV[nodes[i + 1].severity].ring, transformOrigin: "0 50%" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: (i + 1) % 4 === 0 ? 0 : 1 }}
                  transition={{ duration: 0.4, delay: 0.75 + i * step }}
                />
              )}
            </motion.li>
          );
        })}
      </ol>
      <motion.div className="mt-5 flex items-center gap-2 text-[12.5px] text-white/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + nodes.length * step }}>
        <Zap className="size-3.5 text-[#7fe0d9]" /> Every step before the cancellation is visible in Watchtower, so each can trigger a preventive action.
      </motion.div>
    </Panel>
  );
}

