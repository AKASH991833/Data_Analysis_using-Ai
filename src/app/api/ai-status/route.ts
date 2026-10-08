export const dynamic="force-dynamic";
export async function GET() {
 const enabled=process.env.GEMINI_ENABLED?.trim()==="true";
 const key=process.env.GEMINI_API_KEY?.trim();
 const model=process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
 if(!enabled||!key)return Response.json({enabled,keyPresent:Boolean(key),model,ready:false});
 try{
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models",{headers:{"x-goog-api-key":key},signal:AbortSignal.timeout(15000)});
  const body=await r.json();
  return Response.json({enabled,keyPresent:true,model,providerStatus:r.status,models:body.models?.filter((m:{supportedGenerationMethods?:string[]})=>m.supportedGenerationMethods?.includes("generateContent")).map((m:{name:string})=>m.name),ready:r.ok});
 }catch(e){return Response.json({enabled,keyPresent:true,model,ready:false,error:e instanceof Error?e.name:"error"});}
}
