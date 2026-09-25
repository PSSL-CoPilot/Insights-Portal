"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChevronsLeft, ChevronsRight, CircleSlash, Database, LayoutDashboard, ListChecks, MapPin, Network, Route } from "lucide-react";
import type { ComponentType } from "react";
import { InsightsGlyph } from "../ui/Marks";
import { useApp } from "../AppContext";
import { cn } from "../ui/primitives";

export const NAV: { href: string; label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }>; title: string }[] = [
  { href: "/", label: "Command Center", icon: LayoutDashboard, title: "Command Center" },
  { href: "/cancellations", label: "Cancellations", icon: CircleSlash, title: "Cancellations" },
  { href: "/states", label: "State Wise Plan", icon: MapPin, title: "State Wise Plan" },
  { href: "/channels", label: "Channel Wise Plan", icon: Network, title: "Channel Wise Plan" },
  { href: "/insights", label: "Insights", icon: InsightsGlyph, title: "Insights" },
  { href: "/journey", label: "Sales to Install Journey", icon: Route, title: "Sales to Install Journey" },
  { href: "/watchtower", label: "Watchtower", icon: Activity, title: "Watchtower" },
  { href: "/actions", label: "Actions", icon: ListChecks, title: "Actions" },
];

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="11" fill="#111" stroke="#2a2a28" />
      <path d="M11 27.5 18.5 12.5h4.2L15.2 27.5z" fill="#FFC72C" />
      <path d="M19.2 27.5 26.7 12.5h4.2L23.4 27.5z" fill="#FFC72C" opacity=".55" />
    </svg>
  );
}

export function Sidebar() {
  const path = usePathname();
  const { sidebarCollapsed: c, toggleSidebar } = useApp();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-card transition-[width] duration-300 lg:flex",
        c ? "w-[76px]" : "w-[252px]",
      )}
    >
      <div className={cn("flex h-[76px] items-center gap-3 px-5", c && "justify-center px-0")}>
        <BrandMark />
        {!c && (
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">Brightspeed</div>
            <div className="text-[11px] font-medium text-mute">Cancellation Intelligence</div>
          </div>
        )}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {NAV.map((n) => {
          const on = active(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              title={c ? n.label : undefined}
              className={cn(
                "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition",
                on ? "bg-panel text-white shadow-sm" : "text-mute hover:bg-subtle hover:text-ink",
                c && "justify-center px-0",
              )}
            >
              <n.icon className={cn("size-[18px] shrink-0", on && "text-brand")} strokeWidth={2} />
              {!c && <span className="truncate">{n.label}</span>}
              {on && !c && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-line p-3">
        <Link
          href="/settings"
          title={c ? "Settings / Data Source" : undefined}
          className={cn(
            "flex h-11 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition",
            path.startsWith("/settings") ? "bg-panel text-white" : "text-mute hover:bg-subtle hover:text-ink",
            c && "justify-center px-0",
          )}
        >
          <Database className="size-[18px] shrink-0" />
          {!c && "Settings / Data Source"}
        </Link>
        <button
          onClick={toggleSidebar}
          className={cn("flex h-10 w-full items-center gap-3 rounded-xl px-3 text-xs font-medium text-soft transition hover:bg-subtle hover:text-ink", c && "justify-center px-0")}
          aria-label={c ? "Expand sidebar" : "Collapse sidebar"}
        >
          {c ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}
