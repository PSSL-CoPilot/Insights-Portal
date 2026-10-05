/** Entity links used inside narrative text as `[[label|href]]` markup (rendered by RichText). */
import type { MonthKey } from "../data/types";
import { chScope, isChannel, scopeName } from "../data/metrics";
import { stateSlug } from "../format";

export const link = (label: string, href: string) => `[[${label}|${href}]]`;

export const hrefs = {
  state: (state: string, month: MonthKey) => `/states/${stateSlug(state)}?month=${month}`,
  channel: (channel: string, month: MonthKey) => `/channels/${stateSlug(channel)}?month=${month}`,
  scope: (scope: string, month: MonthKey) => (isChannel(scope) ? hrefs.channel(scopeName(scope), month) : hrefs.state(scope, month)),
  postOdd: (month: MonthKey, state?: string | null) => `/cancellations?tab=timing&bucket=post&month=${month}${state ? `&state=${stateSlug(state)}` : ""}`,
  watchtower: (month: MonthKey, state?: string | null) => `/watchtower?month=${month}${state ? `&state=${stateSlug(state)}` : ""}`,
  actions: (month: MonthKey) => `/actions?month=${month}`,
};

export const stateLink = (state: string, month: MonthKey) => link(state, hrefs.state(state, month));
export const channelLink = (channel: string, month: MonthKey) => link(channel, hrefs.channel(channel, month));
export const scopeLink = (scope: string, month: MonthKey) => link(scopeName(scope), hrefs.scope(scope, month));
export { chScope };

/** "A", "A and B", "A, B and C". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
