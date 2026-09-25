# Brightspeed Cancellation Intelligence

An executive analytics app that walks from **"something is wrong"** → **where** → **why** → **could we have seen it coming?** → **what to do**.
Every number is read from an Excel workbook — there are no copies of the data in the code.

## Run it

```
dev.cmd            # Windows: uses the portable Node in .tools (no install needed)
# or, with Node 20+ installed:
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run test:data  # parses the workbook and prints a summary + validation issues
```

## Data source (source of truth)

`/data/Brightspeed_Scenario2_App_Data_Jan_Sep_2026.xlsx`

Replace or edit the file and **refresh the page** — the loader compares the file's modified-time on every request and re-parses when it changed. Set `BRIGHTSPEED_DATA_FILE` to point at a workbook elsewhere.

### Sheets and columns the app reads

| Sheet | Shape | Columns (header row is auto-detected below any title block) |
|---|---|---|
| Dashboard KPI | 2 tables | **KPI Card · September Value · August / Prior · Change · Card Group · Executive meaning**, then a hotspot block **Metric · August · September · Change · Why it matters** (its title row names the state) |
| Monthly Overview | 1 row / month | Month · Unique Sales · Sales MoM % · Installs · Install Rate · Cancellations · Cancels MoM % · Cancel Rate · Pre/On/Post-ODD % · Customer/Company Miss % · Faux % · Pending Customer Contact % · Action Needed Not Jeopardy % · Install in Jeopardy % · BSW Delay Predicted % · On-Time Install % |
| State Monthly | state × month | Month · State · Unique Sales · Installs · Cancellations · Cancel Rate · Cancels MoM % · Pre/On/Post-ODD Cancels & % · Customer Miss / Company Miss / Faux Cancels & % |
| September State Drill | state, one month | State · Unique Sales · Installs · Cancellations · Cancel Rate · Cancel Growth vs Aug · Pre/On/Post-ODD % · Customer Miss % · Pending Customer Contact % · On-Time Install % (month is read from the sheet title) |
| ODD Timing | 1 row / month | Month · Pre/On/Post-ODD Cancels & % |
| Cancel Classification | 1 row / month | Month · Customer Miss / Company Miss / Faux Cancels & % |
| Customer Miss Reasons | state × month × reason | Month · State · Reason · Count · Share of State Customer Miss · Month-over-Month Change · Scenario Flag · Insight |
| Watchtower Signals | state, one month + portfolio row | State · No Action Needed % · Pending Customer Contact % · Action Needed Not Jeopardy % · Install in Jeopardy % · BSW Delay Predicted % · Primary interpretation |
| Example Customer Journey | steps | Step · Date · Lifecycle Event · Watchtower / Status · Risk interpretation · Recommended action |
| Executive Questions | 5 rows | Executive question · Scenario 2 answer · Evidence · Recommended next step · Primary app drill |
| Data Dictionary | rows | Field / KPI · Definition · Unit / Format · Primary source sheet · Scenario note |
| *Channel Monthly* (optional, future) | channel × month | Month · Channel · Unique Sales · Installs · Cancellations — when present, every KPI's **Channels** tab populates automatically |

Handled: title/blank rows, Excel date serials, numbers stored as text (`"1,234"`, `"12%"`), whole-number percentages (`34` → `0.34`), missing optional columns (shown as "—", never as 0), header aliases.

### Validation (Settings → Data source, plus an in-app banner)
Missing sheets/columns are **errors**; cross-sheet mismatches are **warnings** (state totals vs portfolio, Pre+On+Post vs cancellations, Customer+Company+Faux vs cancellations, KPI cards vs Monthly Overview). Everything is also logged to the server console with a `[data]` prefix.

## Architecture

```
lib/data/
  types.ts            normalized model (fractions for %, YYYY-MM month keys, null = not in workbook)
  tableParser.ts      generic header-detecting sheet → typed rows (dates, %, strings-as-numbers)
  excelLoader.ts      server-side read + mtime cache            ← the only file that touches disk
  transformations.ts  per-sheet column specs → DataModel, cross-validation
  metrics.ts          KPI registry, snapshots (month × state), deltas, anomaly assessment, rankings
  narratives.ts       executive summary, diagnosis, insights, actions, state story (all rule-based on the data)
lib/ai/queryEngine.ts intent interpreter behind an `AnswerProvider` interface (swap in an LLM later)
components/           layout · kpi · charts · insights · drilldown · ai · ui
app/                  / · /insights · /cancellations · /journey · /states[/slug] · /watchtower · /actions · /settings
```

* The server layout loads the model (`force-dynamic`) and hands it to client components; all analytics are pure functions of `(model, month, state)`.
* **Status colours** (red/amber/green) and "anomaly" flags come from comparing the selected month's move with that series' own historical month-to-month noise — not from hard-coded thresholds — so they adapt to whatever the workbook contains.
* **Root cause** ("customer engagement / appointment readiness") is inferred by rule from the data: customer-side share, Pending Customer Contact rising faster than BSW/jeopardy, Post-ODD shift, Company Miss movement. If the data doesn't fit, the summary says the cause is *mixed* or *operational* instead.

## Known data limits (shown honestly in the UI)
* No channel dataset → Channels tab shows a data-pending state.
* Pending Customer Contact, On-Time Install and other Watchtower states exist per state only for the drill month; earlier months show "—". (The Dashboard KPI hotspot block supplies the prior-month Pending % for its state.)
* Classification and reasons aren't split by ODD bucket in the workbook, so the timing drill-down labels those panels as "all cancellations in the selection".
* Watchtower story percentages are shares at each stage, not a tracked per-order funnel.
* Action status changes are saved in the browser only (prototype).
