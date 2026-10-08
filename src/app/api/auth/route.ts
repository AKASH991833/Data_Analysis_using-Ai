import {NextRequest,NextResponse} from "next/server";
import {sessionToken} from "@/lib/session";
export async function POST(req:NextRequest) {
 if(req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({error:"Invalid origin"},{status:403});
 const data=await req.formData();
 if(!process.env.APP_USERNAME || !process.env.APP_PASSWORD || data.get("username")!==process.env.APP_USERNAME || data.get("password")!==process.env.APP_PASSWORD) {
  await new Promise(r=>setTimeout(r,1000));
  return NextResponse.redirect(new URL("/login?error=1",req.url),303);
 }
 const expires=Date.now()+12*60*60*1000;
 const res=NextResponse.redirect(new URL("/",req.url),303);
 res.cookies.set("nexus_session",await sessionToken(process.env.APP_USERNAME,expires),{httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:12*60*60});
 res.headers.set("Cache-Control","no-store");
 return res;
}
