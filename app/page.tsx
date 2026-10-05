import { ExecutiveStory } from "@/components/story/ExecutiveStory";
import { KPIGrid } from "@/components/kpi/KPIGrid";

export default function CommandCenterPage() {
  return (
    <div className="space-y-14">
      <ExecutiveStory />
      <KPIGrid />
    </div>
  );
}
