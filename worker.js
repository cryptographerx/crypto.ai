// Cloudflare Worker. Add GEMINI_API_KEY as a SECRET in Worker settings.
// Change this origin only if your published site URL changes.
const ALLOWED_ORIGIN = 'https://cryptographerx.github.io';
const MODEL = 'gemini-2.5-flash';
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = {'Access-Control-Allow-Origin': ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json','Vary':'Origin'};
    const answer = (status, body) => new Response(JSON.stringify(body), {status, headers});
    if (origin !== ALLOWED_ORIGIN) return answer(403,{error:'Origin not allowed'});
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'POST') return answer(405,{error:'POST only'});
    if (!env.GEMINI_API_KEY) return answer(500,{error:'Server API key not configured'});
    const size = Number(request.headers.get('Content-Length') || 0);
    if (size > 50000) return answer(413,{error:'Message too large'});
    let body;try{body=await request.json()}catch{return answer(400,{error:'Invalid JSON'})}
    if (!Array.isArray(body.messages) || body.messages.length<1 || body.messages.length>12 || body.messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>4000)) return answer(400,{error:'Invalid messages'});
    const contents=body.messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
    try{
      const upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({contents,generationConfig:{maxOutputTokens:1200}})});
      if(!upstream.ok){console.error('AI provider status:',upstream.status);return answer(upstream.status===429?429:502,{error:upstream.status===429?'AI provider rate limit reached':'AI provider error; check your key, model, and billing'})}
      const data=await upstream.json();const reply=data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
      if(!reply)return answer(502,{error:'The model returned no text'});
      return answer(200,{reply});
    }catch(e){console.error(e);return answer(502,{error:'Unable to contact AI provider'})}
  }
};
