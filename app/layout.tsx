import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { loadDataModel, workbookPath } from "@/lib/data/excelLoader";
import { AppProviders } from "@/components/AppContext";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Brightspeed Cancellation Intelligence",
  description: "From “something is wrong” to “here is what to do” — an executive command center for cancellations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const model = loadDataModel();

  if (!model.ok && model.months.length === 0) {
    return (
      <html lang="en">
        <body>
          <div className="mx-auto max-w-2xl p-10">
            <div className="rounded-[18px] border border-bad/30 bg-white p-8 shadow-card">
              <div className="eyebrow mb-2 !text-bad">Data source error</div>
              <h1 className="text-2xl font-semibold">The workbook could not be loaded</h1>
              <p className="mt-2 text-sm text-mute">
                Expected: <code className="rounded bg-[#f0f0eb] px-1.5 py-0.5">{workbookPath()}</code>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {model.issues.map((i, k) => (
                  <li key={k} className="rounded-xl bg-bad-soft px-4 py-2.5 text-bad">
                    <strong>[{i.sheet}]</strong> {i.message}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-mute">
                Place <strong>Brightspeed_Scenario2_App_Data_Jan_Sep_2026.xlsx</strong> in the <code>/data</code> folder (or set <code>BRIGHTSPEED_DATA_FILE</code>) and refresh.
              </p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <AppProviders model={model}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
