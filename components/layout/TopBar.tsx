"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, Moon, Sun } from "lucide-react";
import { useApp } from "../AppContext";
import { AskAnything } from "../ai/AskAnything";
import { NAV, BrandMark } from "./Sidebar";
import { monthLabel, stateSlug } from "@/lib/format";
import { cn } from "../ui/primitives";

function Select({ value, onChange, children, label, className }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label: string; className?: string }) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-[13px] font-semibold text-ink shadow-card outline-none transition hover:border-ink focus:border-ink focus:ring-4 focus:ring-brand/30"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
    </label>
  );
}

/** Light / dark switch. The choice is kept in this browser; the initial class is set by a script in the document head. */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("bs.theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}
      className="grid size-10 place-items-center rounded-full border border-line bg-card text-mute shadow-card transition hover:border-ink hover:text-ink">
      {dark ? <Sun className="size-[17px] text-brand" /> : <Moon className="size-[17px]" />}
    </button>
  );
}

export function TopBar() {
  const path = usePathname();
  const router = useRouter();
  const { model, month, setMonth, state, setState } = useApp();
  const nav = NAV.find((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href)));
  const title = path.startsWith("/settings") ? "Settings and Data Source" : nav?.title ?? "Command Center";

  // On the State Wise Plan, the state filter and the open state page are the same selection.
  const onState = (v: string) => {
    setState(v || null);
    if (path.startsWith("/states")) router.push(v ? `/states/${stateSlug(v)}?month=${month}` : `/states?month=${month}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3 sm:px-8 lg:h-[76px] lg:flex-nowrap lg:py-0">
        <div className="flex items-center gap-3 lg:min-w-[190px]">
          <span className="lg:hidden"><BrandMark size={32} /></span>
          <h1 className="whitespace-nowrap text-[20px] font-semibold tracking-tight">{title}</h1>
        </div>

        <div className="order-3 flex w-full justify-center lg:order-none lg:flex-1">
          <AskAnything />
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <Select label="Month" value={month} onChange={setMonth} className="w-[196px]">
            {[...model.months].reverse().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
          <Select label="State" value={state && !state.startsWith("ch:") ? state : ""} onChange={onState} className="hidden w-[176px] sm:block">
            <option value="">All states</option>
            {model.states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <ThemeToggle />
          <button aria-label="Notifications" className="relative hidden size-10 place-items-center rounded-full border border-line bg-card text-mute shadow-card transition hover:border-ink hover:text-ink sm:grid">
            <Bell className="size-[17px]" />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full border-2 border-card bg-bad" />
          </button>
          <div className="bs-gradient hidden size-10 place-items-center rounded-full text-[13px] font-bold text-[#111] sm:grid" title="Executive view">
            EX
          </div>
        </div>
      </div>
    </header>
  );
}
