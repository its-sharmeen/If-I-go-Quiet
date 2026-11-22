// Scheduled job (FR-E1): evaluates every live account's timers and sends real email via Resend. Call every minute with pg_cron.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import {evaluate} from '../_shared/machine.ts'
const APP=Deno.env.get('APP_URL')!
const BREVO=Deno.env.get('BREVO_API_KEY')
/** Sends through Brevo if BREVO_API_KEY is set (works for any recipient with a verified sender), otherwise Resend. */
async function email(x:any,owner:string){
  const link=x.t==='reminder'?`\n\nTap to say you’re okay: ${APP}/#/c/${owner}/${x.tok}`:x.cid?`\n\nOpen: ${APP}/#/c/${owner}/${x.tok}`:`\n\nOpen the app: ${APP}`,text=x.body+link
  const r=BREVO?await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':BREVO,'Content-Type':'application/json'},body:JSON.stringify({sender:{name:'If I Go Quiet',email:Deno.env.get('MAIL_FROM')},to:[{email:x.to}],subject:x.subj,textContent:text})})
    :await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${Deno.env.get('RESEND_API_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify({from:Deno.env.get('MAIL_FROM'),to:x.to,subject:x.subj,text})})
  console.log(BREVO?'brevo':'resend',r.status,x.to,await r.text())}
async function twilio(to:string,body:string,whatsapp:boolean){
  const sid=Deno.env.get('TWILIO_ACCOUNT_SID'),tok=Deno.env.get('TWILIO_AUTH_TOKEN'),from=Deno.env.get(whatsapp?'TWILIO_WHATSAPP_FROM':'TWILIO_FROM')
  if(!sid||!tok||!from)return
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+btoa(`${sid}:${tok}`),'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({To:whatsapp?`whatsapp:${to}`:to,From:from,Body:body})})}
/** FR-J3: SMS + WhatsApp nudges for reminders and verification requests. Never contains map content. */
async function nudge(x:any,m:any,owner:string){
  if(x.t!=='reminder'&&x.t!=='verify')return
  const phone=x.cid?m.contacts.find((c:any)=>c.id===x.cid)?.phone:m.ownerPhone;if(!phone)return
  const text=`${x.subj} ${x.cid?`${APP}/#/c/${owner}/${x.tok}`:APP}`
  await twilio(phone,text,false);await twilio(phone,text,true)}
Deno.serve(async()=>{
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const{data}=await sb.from('snapshots').select('owner_id,data');let sent=0
  for(const r of data??[]){const m=r.data;if(m.demo||!m.seeded)continue
    evaluate(m)
    for(const x of m.mail.filter((x:any)=>!x.sent)){x.sent=true;await email(x,r.owner_id);await nudge(x,m,r.owner_id);sent++;await new Promise(f=>setTimeout(f,600))}
    await sb.from('snapshots').update({data:m}).eq('owner_id',r.owner_id)}
  return new Response(JSON.stringify({sent}))})
