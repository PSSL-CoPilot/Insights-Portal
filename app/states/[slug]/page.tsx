import { StateRoute } from "@/components/drilldown/StateRoute";

export default async function StateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StateRoute slug={slug} />;
}
