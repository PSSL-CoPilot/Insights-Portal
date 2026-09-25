"use client";

import Link from "next/link";
import { useApp } from "../AppContext";
import { StateDrilldown } from "./StateDrilldown";
import { EmptyState } from "../ui/primitives";
import { slugToState } from "@/lib/format";

export function StateRoute({ slug }: { slug: string }) {
  const { model } = useApp();
  const state = slugToState(slug, model.states);
  if (!state) {
    return (
      <EmptyState title="State not found">
        “{slug}” isn’t in the workbook’s State Monthly sheet. Known states: {model.states.join(", ")}. <Link href="/states" className="font-semibold underline">Back to states</Link>
      </EmptyState>
    );
  }
  return <StateDrilldown state={state} />;
}
