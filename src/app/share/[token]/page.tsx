import { SharedDashboard } from "@/components/SharedDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shared dashboard | NexusAI", robots: { index: false, follow: false } };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedDashboard token={token} />;
}
