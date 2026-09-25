"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { DataModel, MonthKey } from "@/lib/data/types";
import { slugToState } from "@/lib/format";

export interface KpiModalState {
  id: string;
  tab?: string;
  /** State to focus the deep dive on (defaults to the global state filter). */
  state?: string | null;
}

interface AppCtx {
  model: DataModel;
  /** Selected month (defaults to the latest month in the workbook). */
  month: MonthKey;
  setMonth: (m: MonthKey) => void;
  /** Selected state, or null for "All states". */
  state: string | null;
  setState: (s: string | null) => void;
  kpiModal: KpiModalState | null;
  openKpi: (id: string, tab?: string, state?: string | null) => void;
  closeKpi: () => void;
  genieOpen: boolean;
  genieSeed: { q: string; n: number } | null;
  openGenie: (question?: string) => void;
  closeGenie: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside <AppProviders>");
  return c;
}

/** Applies ?month= / ?state= / ?kpi= from the URL so deep links from insights & answers land in the right context. */
function UrlSync({ apply }: { apply: (p: URLSearchParams) => void }) {
  const sp = useSearchParams();
  const key = sp.toString();
  useEffect(() => {
    apply(new URLSearchParams(key));
  }, [key, apply]);
  return null;
}

export function AppProviders({ model, children }: { model: DataModel; children: ReactNode }) {
  const latest = model.latestMonth ?? model.months[model.months.length - 1] ?? "";
  const [month, setMonthRaw] = useState<MonthKey>(latest);
  const [state, setState] = useState<string | null>(null);
  const [kpiModal, setKpiModal] = useState<KpiModalState | null>(null);
  const [genieOpen, setGenieOpen] = useState(false);
  const [genieSeed, setGenieSeed] = useState<{ q: string; n: number } | null>(null);
  const [sidebarCollapsed, setCollapsed] = useState(false);

  // If the workbook changed underneath us (e.g. a new latest month), reset invalid selections.
  useEffect(() => {
    if (!model.months.includes(month)) setMonthRaw(latest);
    if (state && !model.states.includes(state)) setState(null);
  }, [model, month, state, latest]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("bs.sidebar") === "1");
    } catch {}
  }, []);

  const setMonth = useCallback((m: MonthKey) => setMonthRaw(m), []);
  const openKpi = useCallback((id: string, tab?: string, st?: string | null) => setKpiModal({ id, tab, state: st }), []);
  const closeKpi = useCallback(() => setKpiModal(null), []);
  const openGenie = useCallback((q?: string) => {
    setGenieOpen(true);
    if (q) setGenieSeed((s) => ({ q, n: (s?.n ?? 0) + 1 }));
  }, []);
  const closeGenie = useCallback(() => setGenieOpen(false), []);
  const toggleSidebar = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("bs.sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  }, []);

  const applyUrl = useCallback(
    (p: URLSearchParams) => {
      const m = p.get("month");
      if (m && model.months.includes(m)) setMonthRaw(m);
      const st = p.get("state");
      if (st) setState(slugToState(st, model.states) ?? null);
      const k = p.get("kpi");
      if (k) setKpiModal({ id: k, tab: p.get("kpitab") ?? undefined });
    },
    [model],
  );

  const value = useMemo<AppCtx>(
    () => ({ model, month, setMonth, state, setState, kpiModal, openKpi, closeKpi, genieOpen, genieSeed, openGenie, closeGenie, sidebarCollapsed, toggleSidebar }),
    [model, month, setMonth, state, kpiModal, openKpi, closeKpi, genieOpen, genieSeed, openGenie, closeGenie, sidebarCollapsed, toggleSidebar],
  );

  return (
    <Ctx.Provider value={value}>
      <Suspense fallback={null}>
        <UrlSync apply={applyUrl} />
      </Suspense>
      {children}
    </Ctx.Provider>
  );
}
