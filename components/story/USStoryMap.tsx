"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

interface GeoState {
  name: string;
  d: string;
  bbox: [number, number, number, number];
  c: [number, number];
}
interface Geo {
  width: number;
  height: number;
  states: GeoState[];
}

export interface MapStateValue {
  name: string;
  label: string;
  severity: "critical" | "warning" | "normal";
}

let geoCache: Geo | null = null;
/** Precomputed Albers USA paths (us-atlas, public domain), bundled locally so the map works offline and on GitHub Pages. */
function useGeo() {
  const [geo, setGeo] = useState<Geo | null>(geoCache);
  useEffect(() => {
    if (geoCache) return;
    let live = true;
    import("@/lib/story/usStates.json").then((m) => {
      geoCache = (m.default ?? m) as unknown as Geo;
      if (live) setGeo(geoCache);
    });
    return () => {
      live = false;
    };
  }, []);
  return geo;
}

const FILL = { critical: "#e5483b", warning: "#f28c28", normal: "#5b6478" };
const ease = [0.45, 0, 0.15, 1] as const;

/**
 * Footprint map for the story player. The "camera" is one transform on a wrapper (translate + scale),
 * so zooming stays on the compositor. Paths never change; only fills, opacity and the camera animate.
 */
export const USStoryMap = memo(function USStoryMap({
  states, zoom, showLabels = true, className,
}: { states: MapStateValue[]; zoom: string | null; showLabels?: boolean; className?: string }) {
  const geo = useGeo();
  const W = geo?.width ?? 975, H = geo?.height ?? 610;
  const byName = useMemo(() => new Map(states.map((s) => [s.name, s])), [states]);
  const target = zoom && geo ? geo.states.find((s) => s.name === zoom) : null;

  const camera = useMemo(() => {
    if (!target) return { x: "0%", y: "0%", scale: 1, s: 1 };
    const [x0, y0, x1, y1] = target.bbox;
    const s = Math.min(W / ((x1 - x0) * 3), H / ((y1 - y0) * 3), 4.2);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: `${(0.5 - (s * cx) / W) * 100}%`, y: `${(0.5 - (s * cy) / H) * 100}%`, scale: s, s };
  }, [target, W, H]);

  return (
    <div className={className} style={{ aspectRatio: `${W} / ${H}` }}>
      <div className="relative size-full">
        <motion.div
          className="absolute inset-0"
          style={{ transformOrigin: "0 0", willChange: "transform" }}
          initial={false}
          animate={{ x: camera.x, y: camera.y, scale: camera.scale }}
          transition={{ duration: 1.8, ease, delay: zoom ? 0.6 : 0 }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="size-full" role="img" aria-label={zoom ? `United States map focused on ${zoom}` : "United States footprint map"}>
            {geo?.states.map((g) => {
              const v = byName.get(g.name);
              const dimmed = !!zoom && v && g.name !== zoom;
              return (
                <path
                  key={g.name}
                  d={g.d}
                  fill={v ? FILL[v.severity] : "rgba(255,255,255,0.055)"}
                  stroke={v ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.14)"}
                  strokeWidth={(v ? 1 : 0.6) / camera.s}
                  style={{ transition: "fill 0.9s ease, opacity 0.9s ease", opacity: dimmed ? 0.35 : 1 }}
                />
              );
            })}
            {/* focus pulse */}
            {geo && zoom && target && (
              <motion.circle
                cx={target.c[0]}
                cy={target.c[1]}
                r={(target.bbox[2] - target.bbox[0]) * 0.32}
                fill="none"
                stroke="#ff7d6e"
                strokeWidth={2 / camera.s}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.6, 1.5], opacity: [0.9, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 2.2 }}
              />
            )}
            {/* labels for footprint states (portfolio view only; the focus view labels its state) */}
            {geo &&
              states.map((v) => {
                const g = geo.states.find((x) => x.name === v.name);
                if (!g) return null;
                const visible = showLabels && (!zoom || v.name === zoom);
                const fs = 18 / camera.s;
                return (
                  <motion.g
                    key={v.name}
                    initial={false}
                    animate={{ opacity: visible ? 1 : 0 }}
                    transition={{ duration: 0.5, delay: visible && zoom ? 2.3 : 0 }}
                    style={{ pointerEvents: "none" }}
                  >
                    <text x={g.c[0]} y={g.c[1] - fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={700} fill="#fff" stroke="rgba(10,15,28,0.65)" strokeWidth={fs * 0.28} paintOrder="stroke">
                      {v.label}
                    </text>
                    <text x={g.c[0]} y={g.c[1] + fs * 0.85} textAnchor="middle" fontSize={fs * 0.72} fontWeight={600} fill="rgba(255,255,255,0.85)" stroke="rgba(10,15,28,0.65)" strokeWidth={fs * 0.22} paintOrder="stroke">
                      {v.name}
                    </text>
                  </motion.g>
                );
              })}
          </svg>
        </motion.div>
      </div>
    </div>
  );
});
