"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, MotionConfig, useMotionValue } from "motion/react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward, X, Zap, ArrowRight } from "lucide-react";
import { GenieMark } from "../ui/Marks";
import { cn, RichText } from "../ui/primitives";
import { USStoryMap } from "./USStoryMap";
import { SceneVisualView } from "./SceneVisual";
import type { StoryScene } from "@/lib/story/types";
import type { MonthKey } from "@/lib/data/types";
import { monthLabel, stateSlug } from "@/lib/format";

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * Full-screen guided briefing. Scenes come from `buildStoryScenes`; the map stays mounted for the
 * whole story so the camera moves continuously from the footprint into the focus state and stays
 * there (dimmed) behind the later evidence. Autoplay timing runs on requestAnimationFrame and
 * writes to a motion value, so the progress rail animates without re-rendering React.
 */
export function WhatHappenedPlayer({
  scenes, month, onClose, onTakeAction,
}: { scenes: StoryScene[]; month: MonthKey; onClose: () => void; onTakeAction: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState(0);
  const progress = useMotionValue(0);
  const elapsed = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const playBtn = useRef<HTMLButtonElement>(null);
  const scene = scenes[index];
  const last = index === scenes.length - 1;

  // Map state: the first map scene's states, and the zoom target once the story reaches it.
  const mapScenes = useMemo(() => scenes.map((s, i) => ({ s, i })).filter((x) => x.s.visual.kind === "map"), [scenes]);
  // The current map scene (or the last one before it) decides the fills, so the focus state turns red on cue.
  const activeMap = [...mapScenes].reverse().find((x) => x.i <= index) ?? mapScenes[0];
  const mapStates = activeMap?.s.visual.kind === "map" ? activeMap.s.visual.states : [];
  const zoomAt = mapScenes.find((x) => x.s.visual.kind === "map" && x.s.visual.zoom);
  const zoom = zoomAt && index >= zoomAt.i && zoomAt.s.visual.kind === "map" ? zoomAt.s.visual.zoom : null;
  const isMapScene = scene.visual.kind === "map";
  const mapOpacity = isMapScene ? 1 : scene.mode === "preventive" ? 0.07 : 0.16;

  // ---- timeline
  useEffect(() => {
    elapsed.current = 0;
    progress.set(0);
  }, [index, run, progress]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (t: number) => {
      elapsed.current += t - prev;
      prev = t;
      const p = Math.min(1, elapsed.current / scene.duration);
      progress.set(p);
      if (p >= 1) {
        if (index < scenes.length - 1) setIndex((i) => i + 1);
        else setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, index, run, scene.duration, scenes.length, progress]);

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(scenes.length - 1, i))), [scenes.length]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prevScene = useCallback(() => go(index - 1), [go, index]);
  const replay = useCallback(() => {
    setIndex(0);
    setRun((r) => r + 1);
    setPlaying(true);
  }, []);
  const toggle = useCallback(() => {
    if (last && progress.get() >= 1) return replay();
    setPlaying((p) => !p);
  }, [last, progress, replay]);

  // ---- keyboard, focus and scroll lock
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    playBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Escape") return onClose();
      if (e.key === "Tab" && root.current) {
        const f = [...root.current.querySelectorAll<HTMLElement>("button, a[href]")].filter((el) => !el.hasAttribute("disabled"));
        if (!f.length) return;
        const first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
        return;
      }
      if (tag === "BUTTON" && (e.key === " " || e.key === "Enter")) return;
      if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight" || e.key === "l") next();
      else if (e.key === "ArrowLeft" || e.key === "j") prevScene();
      else if (e.key === "Home" || e.key === "r") replay();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose, toggle, next, prevScene, replay]);

  const focusState = zoomAt && zoomAt.s.visual.kind === "map" ? zoomAt.s.visual.zoom : null;
  const evidenceHref = focusState ? `/states/${stateSlug(focusState)}?month=${month}` : `/cancellations?month=${month}`;
  const endActions = (
    <div className="flex flex-wrap gap-2.5">
      <button onClick={onTakeAction} className="bs-gradient inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-[#111] transition-transform hover:-translate-y-0.5">
        <Zap className="size-4" /> Take Action
      </button>
      <button onClick={() => { onClose(); router.push(evidenceHref); }} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-[14px] font-semibold text-white transition hover:border-white/60">
        See full evidence <ArrowRight className="size-4" />
      </button>
      <button onClick={replay} className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-white/70 transition hover:text-white">
        <RotateCcw className="size-4" /> Replay story
      </button>
    </div>
  );

  return createPortal(
    <MotionConfig reducedMotion="user">
      <motion.div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={`What happened, ${monthLabel(month)}`}
        className="dark fixed inset-0 z-[60] flex flex-col overflow-hidden text-white"
        style={{ background: "radial-gradient(1100px 600px at 80% -10%, rgba(255,199,44,0.10), transparent 60%), radial-gradient(900px 500px at 0% 110%, rgba(79,199,192,0.08), transparent 60%), #0a0f1c" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <GenieMark size={26} />
            <div>
              <div className="text-[14px] font-semibold">What happened</div>
              <div className="text-[11.5px] text-white/50">{monthLabel(month)} briefing</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-500", scene.mode === "observed" ? "bg-white/10 text-white/80" : "bg-[#4fc7c0]/20 text-[#7fe0d9]")}>
              {scene.mode === "observed" ? "Observed" : "Forward-looking"}
            </span>
            <span className="num text-[12.5px] text-white/50" aria-live="polite">{index + 1} / {scenes.length}</span>
            <button onClick={onClose} aria-label="Exit briefing (Escape)" className="grid size-9 place-items-center rounded-full border border-white/15 text-white/70 transition hover:border-white/50 hover:text-white"><X className="size-4" /></button>
          </div>
        </div>

        {/* body */}
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-5 pb-4 sm:px-8 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)] lg:gap-10 lg:overflow-hidden">
          <div className="flex flex-col justify-center lg:py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${scene.id}-${run}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease }}
              >
                <div className={cn("text-[12px] font-semibold uppercase tracking-[0.14em]", scene.mode === "observed" ? "text-[#ffc72c]" : "text-[#7fe0d9]")}>{scene.kicker}</div>
                <h2 className="mt-3 text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] sm:text-[38px]">{scene.title}</h2>
                <p className="mt-5 max-w-xl text-[16.5px] leading-[1.6] text-white/75 [&_strong]:text-white">
                  <RichText text={scene.body} />
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative min-h-[360px] lg:min-h-0" style={{ containerType: "size" }}>
            {/* persistent map layer */}
            <motion.div
              aria-hidden={!isMapScene}
              className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-hidden pt-1"
              style={{ maskImage: "radial-gradient(ellipse 75% 70% at 50% 42%, #000 60%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 42%, #000 60%, transparent 100%)" }}
              initial={false}
              animate={{ opacity: mapOpacity }}
              transition={{ duration: 0.8, ease }}
            >
              {/* Same size in every scene (no layout jumps): the camera is the only thing that moves. */}
              <div className="shrink-0" style={{ width: "min(100cqw, calc(76cqh * 975 / 610))" }}>
                <USStoryMap states={mapStates} zoom={zoom} showLabels={isMapScene} key={run} />
              </div>
            </motion.div>
            {/* scene visual layer */}
            <div className={cn("relative z-[1] flex h-full flex-col overflow-y-auto", isMapScene ? "justify-end" : "justify-center")}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${scene.id}-${run}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.45, ease }}
                  className="py-2"
                >
                  <SceneVisualView visual={scene.visual} actions={last ? endActions : undefined} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* progress rail and controls */}
        <div className="border-t border-white/10 px-5 pb-5 pt-4 sm:px-8">
          <div className="flex gap-1.5" role="tablist" aria-label="Story scenes">
            {scenes.map((s, i) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={i === index}
                aria-label={`Scene ${i + 1}: ${s.title}`}
                title={s.kicker}
                onClick={() => go(i)}
                className="group relative h-6 flex-1"
              >
                <span className={cn("absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 overflow-hidden rounded-full transition-colors", s.mode === "observed" ? "bg-white/12 group-hover:bg-white/25" : "bg-[#4fc7c0]/15 group-hover:bg-[#4fc7c0]/30")}>
                  {i < index && <span className={cn("absolute inset-0", s.mode === "observed" ? "bg-white/80" : "bg-[#4fc7c0]")} />}
                  {i === index && (
                    <motion.span className={cn("absolute inset-0 origin-left", s.mode === "observed" ? "bg-white" : "bg-[#4fc7c0]")} style={{ scaleX: progress }} />
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <CtrlButton label="Previous scene (Left arrow)" onClick={prevScene} disabled={index === 0}><SkipBack className="size-4" /></CtrlButton>
              <button
                ref={playBtn}
                onClick={toggle}
                aria-label={playing ? "Pause (Space)" : "Play (Space)"}
                className="grid size-12 place-items-center rounded-full bg-white text-[#0a0f1c] shadow-pop transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc72c]"
              >
                {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 translate-x-[1px] fill-current" />}
              </button>
              <CtrlButton label="Next scene (Right arrow)" onClick={next} disabled={last}><SkipForward className="size-4" /></CtrlButton>
              <CtrlButton label="Replay from the start" onClick={replay}><RotateCcw className="size-4" /></CtrlButton>
            </div>
            <div className="hidden text-[11.5px] text-white/40 sm:block">Space play or pause · Arrows move between scenes · Esc exits</div>
          </div>
        </div>
      </motion.div>
    </MotionConfig>,
    document.body,
  );
}

function CtrlButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-[#ffc72c]"
    >
      {children}
    </button>
  );
}
