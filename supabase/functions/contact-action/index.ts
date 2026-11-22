// Contacts need no account (FR-A3): they act through an unguessable, expiring per-email token.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import {evaluate,decide,acceptInvite,checkIn,familyAccess,log} from '../_shared/machine.ts'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const j=(o:unknown)=>new Response(JSON.stringify(o),{headers:{...cors,'Content-Type':'application/json'}})
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  const{owner,tok,decision}=await req.json(),sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]??'unknown',since=new Date(Date.now()-60000).toISOString()
  const{count}=await sb.from('attempts').select('*',{count:'exact',head:true}).eq('ip',ip).gte('at',since)
  if((count??0)>=20)return j({error:'Too many attempts. Please wait a minute and try again.'})
  await sb.from('attempts').insert({ip})
  const{data}=await sb.from('snapshots').select('data').eq('owner_id',owner).maybeSingle()
  if(!data)return j({error:'Link not found.'})
  const m=data.data;evaluate(m);const ml=m.mail.find((x:any)=>x.tok===tok)
  if(!ml||(!ml.cid&&ml.t!=='reminder'))return j({error:'Link not found.'})
  let err:string|null=null,out:unknown=null
  if(decision==='confirm'||decision==='decline')err=decide(m,ml.id,decision)
  else if(decision==='accept')acceptInvite(m,ml.cid)
  else if(decision==='checkin'){
    if(ml.t!=='reminder')return j({error:'Link not found.'})
    if(m.state==='RELEASED')return j({error:'The map was already opened. Please open the app to revoke access.'})
    checkIn(m);out={type:'checkedin'}}
  else if(decision==='view'){
    if(ml.t!=='release'||ml.exp<=Date.now()||!familyAccess(m,ml.cid))return j({error:'Access denied.'})
    log(m,m.contacts.find((c:any)=>c.id===ml.cid)?.name??'contact','VIEW','Viewed the Family View');out={view:{key:m.key,entries:m.entries}}}
  await sb.from('snapshots').update({data:m}).eq('owner_id',owner)
  return j(err?{error:err}:out??{type:ml.t,owner:m.owner,state:m.state,confirmed:Object.keys(m.conf).length,quorum:m.quorum,done:ml.cid in m.conf})})
