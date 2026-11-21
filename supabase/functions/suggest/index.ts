// Optional AI helper. Receives ONLY a person type (e.g. "Student"), never any map content. Key stays in an edge-function secret.
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const j=(o:unknown)=>new Response(JSON.stringify(o),{headers:{...cors,'Content-Type':'application/json'}})
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  const{role,lang}=await req.json()
  if(typeof role!=='string'||!/^[A-Za-z ]{1,30}$/.test(role))return j({error:'bad role'})
  try{
    const r=await fetch((Deno.env.get('AI_BASE_URL')??'https://api.prod.adaptionlabs.ai/api/v1')+'/chat/completions',{method:'POST',
      headers:{Authorization:`Bearer ${Deno.env.get('ADAPTION_API_KEY')}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:Deno.env.get('AI_MODEL')??'deepseek-v4-flash',max_tokens:600,messages:[
        {role:'system',content:'You help someone prepare a family emergency map: a list of WHERE things are and WHO to call. Never ask for or include passwords, PINs, OTPs or card numbers. Reply with JSON only: {"items":[{"cat":0,"title":"...","hint":"..."}]} with exactly 6 items. cat is 0 Money & Insurance, 1 Documents, 2 Digital Life, 3 People to Call, 4 Last Wishes. Calm, plain language.'},
        {role:'user',content:`Person type: ${role}. Write in ${lang==='hi'?'Hindi':'English'}.`}]})})
    const txt=(await r.json()).choices?.[0]?.message?.content??''
    const items=JSON.parse(txt.replace(/```json|```/g,'').trim()).items
    return j({items:(items as any[]).slice(0,6).map(i=>({cat:Math.min(4,Math.max(0,+i.cat||0)),title:String(i.title).slice(0,80),hint:String(i.hint).slice(0,120)}))})
  }catch{return j({error:'AI is unavailable right now.'})}})
