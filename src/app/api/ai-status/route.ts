export const dynamic="force-dynamic";
export async function GET() {
 const enabled=process.env.GEMINI_ENABLED?.trim()==="true";
 const key=process.env.GEMINI_API_KEY?.trim();
 const model=process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
 if(!enabled||!key)return Response.json({enabled,keyPresent:Boolean(key),model,ready:false});
 try{
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},signal:AbortSignal.timeout(15000),body:JSON.stringify({contents:[{parts:[{text:"Return the JSON value null."}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:32,temperature:0}})});
  const body=await r.json();
  return Response.json({enabled,keyPresent:true,model,providerStatus:r.status,providerError:body.error?.status,ready:r.ok});
 }catch(e){return Response.json({enabled,keyPresent:true,model,ready:false,error:e instanceof Error?e.name:"error"});}
}
