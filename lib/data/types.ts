/**
 * Normalized data model. Everything the UI renders is derived from this shape,
 * which is produced from the Excel workbook by `excelLoader.ts` + `transformations.ts`.
 *
 * Conventions
 *  - Percentages are stored as fractions (0.187 = 18.7%).
 *  - Months are `YYYY-MM` keys ("2026-09").
 *  - `null` means "not present in the workbook" — never a silent zero.
 */

export type MonthKey = string;

export interface MonthlyOverviewRow {
  month: MonthKey;
  sales: number | null;
  salesMoM: number | null;
  installs: number | null;
  installRate: number | null;
  cancels: number | null;
  cancelsMoM: number | null;
  cancelRate: number | null;
  prePct: number | null;
  onPct: number | null;
  postPct: number | null;
  custPct: number | null;
  coPct: number | null;
  fauxPct: number | null;
  pendingPct: number | null;
  actionPct: number | null;
  jeopardyPct: number | null;
  bswPct: number | null;
  onTimePct: number | null;
}

export interface StateMonthlyRow {
  month: MonthKey;
  state: string;
  sales: number | null;
  installs: number | null;
  cancels: number | null;
  cancelRate: number | null;
  cancelsMoM: number | null;
  preCancels: number | null;
  prePct: number | null;
  onCancels: number | null;
  onPct: number | null;
  postCancels: number | null;
  postPct: number | null;
  custMiss: number | null;
  custPct: number | null;
  coMiss: number | null;
  coPct: number | null;
  faux: number | null;
  fauxPct: number | null;
  pendingPct: number | null;
  actionPct: number | null;
  jeopardyPct: number | null;
  bswPct: number | null;
  onTimePct: number | null;
}

/** "September State Drill" — one row per state for the drill month. */
export interface StateDrillRow {
  state: string;
  sales: number | null;
  installs: number | null;
  cancels: number | null;
  cancelRate: number | null;
  cancelGrowth: number | null;
  prePct: number | null;
  onPct: number | null;
  postPct: number | null;
  custPct: number | null;
  pendingPct: number | null;
  onTimePct: number | null;
}

export interface OddTimingRow {
  month: MonthKey;
  preCancels: number | null;
  prePct: number | null;
  onCancels: number | null;
  onPct: number | null;
  postCancels: number | null;
  postPct: number | null;
}

export interface ClassificationRow {
  month: MonthKey;
  custMiss: number | null;
  custPct: number | null;
  coMiss: number | null;
  coPct: number | null;
  faux: number | null;
  fauxPct: number | null;
}

export interface ReasonRow {
  month: MonthKey;
  state: string;
  reason: string;
  count: number | null;
  share: number | null;
  mom: number | null;
  flag: string | null;
  insight: string | null;
}

export interface WatchtowerRow {
  /** State name, or "Portfolio" for the roll-up row. */
  state: string;
  isPortfolio: boolean;
  noActionPct: number | null;
  pendingPct: number | null;
  actionPct: number | null;
  jeopardyPct: number | null;
  bswPct: number | null;
  interpretation: string | null;
}

export interface JourneyStep {
  step: number;
  /** ISO date (yyyy-mm-dd) or null when the cell wasn't a parseable date. */
  date: string | null;
  event: string;
  status: string;
  risk: string;
  action: string;
}

export interface KpiCardRow {
  label: string;
  value: number | null;
  prior: number | null;
  change: number | null;
  group: string;
  meaning: string;
}

export interface HotspotRow {
  metric: string;
  august: number | null;
  september: number | null;
  change: number | null;
  meaning: string;
}

export interface ExecQuestionRow {
  n: number;
  question: string;
  answer: string;
  evidence: string;
  nextStep: string;
  drill: string;
}

export interface DictionaryRow {
  field: string;
  definition: string;
  unit: string;
  source: string;
  note: string;
}

/** "Channel Monthly": one row per channel and month. */
export interface ChannelMonthlyRow {
  month: MonthKey;
  channel: string;
  sales: number | null;
  installs: number | null;
  cancels: number | null;
  cancelRate: number | null;
  preCancels: number | null;
  prePct: number | null;
  onCancels: number | null;
  onPct: number | null;
  postCancels: number | null;
  postPct: number | null;
  custMiss: number | null;
  custPct: number | null;
  coMiss: number | null;
  coPct: number | null;
  faux: number | null;
  fauxPct: number | null;
  pendingPct: number | null;
  actionPct: number | null;
  jeopardyPct: number | null;
  bswPct: number | null;
  onTimePct: number | null;
}

/** "September State x Channel": one row per state and channel for the drill month. */
export interface StateChannelRow {
  state: string;
  channel: string;
  sales: number | null;
  installs: number | null;
  cancels: number | null;
  cancelRate: number | null;
  cancelGrowth: number | null;
  postPct: number | null;
  custPct: number | null;
  pendingPct: number | null;
}

export type IssueLevel = "error" | "warn" | "info";

export interface DataIssue {
  level: IssueLevel;
  sheet: string;
  message: string;
}

export interface SheetStatus {
  name: string;
  required: boolean;
  found: boolean;
  rows: number;
}

export interface DataModel {
  ok: boolean;
  meta: {
    file: string;
    loadedAt: string;
    modifiedAt: string | null;
    sheets: SheetStatus[];
  };
  issues: DataIssue[];
  months: MonthKey[];
  latestMonth: MonthKey | null;
  states: string[];
  /** Month the single-month sheets (State Drill / Watchtower / Journey) describe. */
  drillMonth: MonthKey | null;
  watchMonth: MonthKey | null;
  /** State the "hotspot" block on Dashboard KPI describes (parsed from its title row). */
  hotspotState: string | null;
  workbookNotes: { dashboardKpi?: string; monthlyOverview?: string };
  kpiCards: KpiCardRow[];
  hotspotBlock: HotspotRow[];
  monthlyOverview: MonthlyOverviewRow[];
  stateMonthly: StateMonthlyRow[];
  stateDrill: StateDrillRow[];
  oddTiming: OddTimingRow[];
  classification: ClassificationRow[];
  customerMissReasons: ReasonRow[];
  watchtower: WatchtowerRow[];
  journey: JourneyStep[];
  executiveQuestions: ExecQuestionRow[];
  dictionary: DictionaryRow[];
  /** null = optional "Channel Monthly" sheet not present in the workbook. */
  channels: ChannelMonthlyRow[] | null;
  channelNames: string[];
  stateChannel: StateChannelRow[];
}
