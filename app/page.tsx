import { ExecutiveSummary } from "@/components/insights/ExecutiveSummary";
import { KPIGrid } from "@/components/kpi/KPIGrid";

export default function CommandCenterPage() {
  return (
    <div className="space-y-14">
      <ExecutiveSummary />
      <KPIGrid />
    </div>
  );
}
