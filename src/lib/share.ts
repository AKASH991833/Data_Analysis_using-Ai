import { randomBytes } from "crypto";
import { pool } from "@/db";

// Share links are stored in their own table (created on first use) so a link only
// ever points at one dashboard's dataset and can be revoked by deleting the row.
let ready: Promise<void> | null = null;
export function ensureShareTable() {
  ready ??= (async () => {
    await pool.query("CREATE TABLE IF NOT EXISTS dashboard_shares (token VARCHAR(64) NOT NULL PRIMARY KEY, dashboard_id VARCHAR(36) NOT NULL, dataset_id VARCHAR(36) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_share_dashboard (dashboard_id))");
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export type ShareRow = { token: string; dashboard_id: string; dataset_id: string; created_at: string };

export async function getShareForDashboard(dashboardId: string): Promise<ShareRow | null> {
  await ensureShareTable();
  const [rows] = await pool.query("SELECT token, dashboard_id, dataset_id, created_at FROM dashboard_shares WHERE dashboard_id = ? ORDER BY created_at DESC LIMIT 1", [dashboardId]);
  return (rows as ShareRow[])[0] ?? null;
}

export async function createShare(dashboardId: string, datasetId: string): Promise<ShareRow> {
  const existing = await getShareForDashboard(dashboardId);
  if (existing) return existing;
  const token = randomBytes(24).toString("base64url");
  await pool.query("INSERT INTO dashboard_shares (token, dashboard_id, dataset_id) VALUES (?, ?, ?)", [token, dashboardId, datasetId]);
  return (await getShareForDashboard(dashboardId))!;
}

export async function revokeShares(dashboardId: string) {
  await ensureShareTable();
  await pool.query("DELETE FROM dashboard_shares WHERE dashboard_id = ?", [dashboardId]);
}

export async function shareByToken(token: string): Promise<ShareRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  await ensureShareTable();
  const [rows] = await pool.query("SELECT token, dashboard_id, dataset_id, created_at FROM dashboard_shares WHERE token = ? LIMIT 1", [token]);
  return (rows as ShareRow[])[0] ?? null;
}
