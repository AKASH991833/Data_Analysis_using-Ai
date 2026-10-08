import { NextRequest, NextResponse } from "next/server";
import { validSession } from "@/lib/session";

// Single-user gate only, not user accounts or tenant isolation. Use TLS in production.
export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/api/auth") return NextResponse.next();
  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;
  if ((!username || !password) && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Configure APP_USERNAME and APP_PASSWORD before public deployment." }, { status: 503 });
  }
  if (username && password) {
    const header = req.headers.get("authorization") || "";
    let credentials = "";
    try { if (header.startsWith("Basic ")) credentials = atob(header.slice(6)); } catch {}
    if (credentials !== `${username}:${password}` && !(await validSession(req.cookies.get("nexus_session")?.value))) {
      if (!req.nextUrl.pathname.startsWith("/api/")) return NextResponse.redirect(new URL("/login",req.url));
      return NextResponse.json({error:"Sign in required"},{status:401});
    }
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin) return NextResponse.json({ error: "Cross-origin writes are not allowed." }, { status: 403 });
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
