const encoder = new TextEncoder();
export async function sessionToken(username: string, expires: number) {
 const key = await crypto.subtle.importKey("raw", encoder.encode(process.env.APP_PASSWORD || ""), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
 const value = `${username}:${expires}`;
 const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
 const sig = Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,"0")).join("");
 return `${expires}.${sig}`;
}
export async function validSession(token: string | undefined) {
 if(!token || !process.env.APP_USERNAME || !process.env.APP_PASSWORD) return false;
 const expires = Number(token.split(".")[0]);
 if(!Number.isFinite(expires) || expires < Date.now() || expires > Date.now()+86400000) return false;
 const expected = await sessionToken(process.env.APP_USERNAME, expires);
 if(expected.length !== token.length) return false;
 let different = 0; for(let i=0;i<expected.length;i++) different |= expected.charCodeAt(i)^token.charCodeAt(i);
 return different === 0;
}
