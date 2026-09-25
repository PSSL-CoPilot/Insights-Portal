"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useApp } from "../AppContext";
import { StateDrilldown } from "./StateDrilldown";
import { EmptyState } from "../ui/primitives";
import { slugToState } from "@/lib/format";
import { chScope } from "@/lib/data/metrics";

/** Resolves a state or channel slug and keeps the global state filter in step with the open state plan. */
export function PlanRoute({ kind, slug }: { kind: "state" | "channel"; slug: string }) {
  const { model, setState } = useApp();
  const name = slugToState(slug, kind === "state" ? model.states : model.channelNames);
  useEffect(() => {
    if (kind === "state" && name) setState(name);
  }, [kind, name, setState]);
  if (!name) {
    const base = kind === "state" ? "/states" : "/channels";
    return (
      <EmptyState title={`${kind === "state" ? "State" : "Channel"} not found`}>
        “{slug}” is not in the workbook. <Link href={base} className="font-semibold underline">Back to the plan overview</Link>
      </EmptyState>
    );
  }
  return <StateDrilldown scope={kind === "state" ? name : chScope(name)} />;
}
