export const dynamic = "force-dynamic";

// A standalone page (not a React route) so it does not render the console chrome.
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aakash sign in</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;font:15px system-ui,sans-serif;color:#0f172a}
form{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;width:320px;display:grid;gap:14px}
h1{margin:0;font-size:18px} label{font-size:13px;color:#475569}
input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
button{padding:10px;border:0;border-radius:8px;background:#0f172a;color:#fff;font:inherit;cursor:pointer}
button:disabled{opacity:.6} #msg{min-height:18px;font-size:13px;color:#b91c1c}
</style></head><body>
<form id="f"><h1>Aakash Console</h1>
<div><label for="p">Password</label><input id="p" type="password" autocomplete="current-password" autofocus required></div>
<button id="b" type="submit">Sign in</button><div id="msg" role="alert"></div></form>
<script>
document.getElementById("f").addEventListener("submit",async e=>{
  e.preventDefault();const b=document.getElementById("b"),m=document.getElementById("msg");
  b.disabled=true;m.textContent="";
  try{const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:document.getElementById("p").value})});
    if(r.ok){location.href="/";return}
    const d=await r.json().catch(()=>({}));m.textContent=(d.error&&d.error.message)||"Sign in failed."}
  catch{m.textContent="Network error."}
  b.disabled=false});
</script></body></html>`;

export function GET() {
  return new Response(PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
    },
  });
}
