import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dashboards } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createShare, getShareForDashboard, revokeShares } from "@/lib/share";

// Owner-only (protected by the login proxy): create, read or revoke the public link.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const share = await getShareForDashboard(id);
    return NextResponse.json({ shared: !!share, token: share?.token ?? null, createdAt: share?.created_at ?? null });
  } catch { return NextResponse.json({ error: "Failed to read share status" }, { status: 500 }); }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [dash] = await db.select().from(dashboards).where(eq(dashboards.id, id)).limit(1);
    if (!dash || !dash.datasetId) return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    const share = await createShare(id, dash.datasetId);
    return NextResponse.json({ shared: true, token: share.token, createdAt: share.created_at });
  } catch { return NextResponse.json({ error: "Failed to create share link" }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await revokeShares(id);
    return NextResponse.json({ shared: false });
  } catch { return NextResponse.json({ error: "Failed to revoke share link" }, { status: 500 }); }
}
