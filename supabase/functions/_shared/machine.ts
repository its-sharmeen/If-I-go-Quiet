import type {Model,St,MailType,Contact} from './types.ts'
/** Release state machine + rules. Pure functions over Model (mutate the passed model). In production this runs server-side. */
export const CATS=['Money & Insurance','Documents','Digital Life','People to Call','Last Wishes']
export const FAMORD=[3,0,1,2,4]
export const ST:St[]=['ACTIVE','GRACE','CONTACTS_NOTIFIED','CONFIRMING','RELEASED']
export const NICE:Record<St,string>={ACTIVE:'All good',GRACE:'Checking on you',CONTACTS_NOTIFIED:'Asking family',CONFIRMING:'Family confirming',RELEASED:'Map opened'}
export const dayMs=(m:Model)=>m.spd*1000
export const fresh=():Model=>({seeded:false,demo:true,loggedIn:false,spd:10,interval:7,grace:3,quorum:2,state:'ACTIVE',last:Date.now(),rem:0,ep:0,uid:1,owner:'',ownerEmail:'',relExp:0,contacts:[],entries:[],conf:{},audit:[],mail:[],key:null})
export const log=(m:Model,actor:string,type:string,msg:string,now=Date.now())=>{m.audit.push({at:now,actor,type,msg})}
function go(m:Model,to:St,now:number){log(m,'system','STATE_CHANGE',`${m.state} → ${to}`,now);m.state=to}
export function sendMail(m:Model,c:Contact,t:MailType,subj:string,body:string,now:number,days=30){
  m.mail.unshift({id:m.uid++,cid:c.id,to:c.email,t,subj,body,ep:m.ep,exp:now+days*dayMs(m),at:now,tok:crypto.randomUUID()});log(m,'system','EMAIL_SENT',`${t} email to ${c.name}`,now)}
function notifyOwner(m:Model,t:MailType,subj:string,body:string,now:number){m.mail.unshift({id:m.uid++,cid:0,to:m.ownerEmail,t,subj,body,ep:m.ep,exp:0,at:now,tok:crypto.randomUUID()})}
export const quorumError=(q:number,n:number)=>!Number.isInteger(q)||q<1?'Quorum must be at least 1.':q>n?`Quorum can’t exceed the ${n} contacts.`:null
export const linkOk=(m:Model,ml:{exp:number;ep:number},now:number)=>ml.exp>now&&ml.ep===m.ep&&(m.state==='CONTACTS_NOTIFIED'||m.state==='CONFIRMING')
export const familyAccess=(m:Model,cid:number,now=Date.now())=>m.state==='RELEASED'&&cid in m.conf&&now<m.relExp
const reask=(m:Model,now:number)=>m.contacts.filter(c=>c.accepted).forEach(c=>sendMail(m,c,'verify',`Please confirm: can you reach ${m.owner}?`,`${m.owner} has missed check-ins. If you could not reach them, confirm. No map content is ever in an email.`,now,14))
/** FR-E1: computed from timestamps, so late or repeated runs never skip or repeat a transition (NFR-4). */
export function evaluate(m:Model,now=Date.now()):Model{
  if(!m.seeded)return m
  const d=dayMs(m),due=m.last+m.interval*d,ge=due+m.grace*d
  if(m.state==='CONFIRMING')for(const k of Object.keys(m.conf))if(m.conf[+k]<=now){delete m.conf[+k];log(m,'system','CONFIRMATION_EXPIRED','A confirmation expired and must be re-requested',now)}
  if(m.state==='CONFIRMING'&&!Object.keys(m.conf).length){m.ep++;go(m,'CONTACTS_NOTIFIED',now);reask(m,now)}
  if(m.state==='ACTIVE'&&now>due){log(m,'system','CHECKIN_MISSED','Check-in overdue',now);go(m,'GRACE',now)}
  if(m.state==='GRACE'){
    const k=Math.min(m.grace,Math.floor((now-due)/d))
    while(m.rem<k){m.rem++;notifyOwner(m,'reminder',`Reminder ${m.rem}: are you okay?`,'Tap once to check in. Also sent by SMS and WhatsApp (simulated).',now);log(m,'system','REMINDER_SENT',`Reminder ${m.rem} to owner`,now)}
    if(now>ge){go(m,'CONTACTS_NOTIFIED',now);reask(m,now)}
  }
  return m
}
export function checkIn(m:Model,now=Date.now()){
  if(m.state==='RELEASED')return
  const was=m.state;m.last=now;m.rem=0;m.conf={}
  if(was!=='ACTIVE'){m.ep++;go(m,'ACTIVE',now)}
  log(m,m.owner,was==='ACTIVE'?'CHECKIN':'CANCELLED',was==='ACTIVE'?'Owner checked in':`Owner cancelled from ${was}; no access granted`,now)
}
export function revoke(m:Model,now=Date.now()){m.last=now;m.rem=0;m.conf={};m.ep++;m.relExp=0;go(m,'ACTIVE',now);log(m,m.owner,'REVOKE','Owner revoked access and ended the release',now)}
export function pause(m:Model,days:number,now=Date.now()){m.last=now+days*dayMs(m);log(m,m.owner,'PAUSED',`Check-ins paused for ${days} days`,now)}
export function goQuiet(m:Model,now=Date.now()):string|null{
  if(!m.demo)return'Demo controls are only available in Demo Mode.'
  m.last=now-m.interval*dayMs(m)-50;log(m,'demo','GO_QUIET','Demo: simulated missed check-ins',now);evaluate(m,now);return null}
/** FR-F1/F2/E4/E5: confirm or decline from a contact's secure link. Returns an error message or null. */
export function decide(m:Model,mailId:number,dec:'confirm'|'decline',now=Date.now()):string|null{
  const ml=m.mail.find(x=>x.id===mailId),c=ml&&m.contacts.find(x=>x.id===ml.cid)
  if(!ml||!c||ml.t!=='verify')return'Link not found.'
  if(!linkOk(m,ml,now))return'This link has expired or is no longer active.'
  if(c.id in m.conf)return'Your confirmation is already recorded.'
  if(dec==='decline'){
    log(m,c.name,'DECLINE','Declined: can reach the owner. Release halted',now)
    notifyOwner(m,'notice',`${c.name} says they can reach you`,'The release process was halted. Please check in.',now)
    m.last=now;m.rem=0;m.conf={};m.ep++;go(m,'ACTIVE',now);return null}
  m.conf[c.id]=now+10*dayMs(m)
  log(m,c.name,'CONFIRMATION',`Confirmed via email link (${Object.keys(m.conf).length} of ${m.quorum})`,now)
  notifyOwner(m,'notice',`${c.name} confirmed`,`${Object.keys(m.conf).length} of ${m.quorum} confirmations so far.`,now)
  if(m.state==='CONTACTS_NOTIFIED')go(m,'CONFIRMING',now)
  if(Object.keys(m.conf).length>=m.quorum){
    go(m,'RELEASED',now);m.relExp=now+7*dayMs(m);log(m,'system','RELEASE',`Quorum ${m.quorum} of ${m.contacts.length} reached`,now)
    m.contacts.filter(x=>x.id in m.conf).forEach(x=>sendMail(m,x,'release','The emergency map is now open to you','Open the Family View with this secure link.',now,7))}
  return null}
export function addContact(m:Model,name:string,rel:string,email:string,phone='',now=Date.now()):string|null{
  if(phone.trim()&&!/^\+[0-9 ]{8,16}$/.test(phone.trim()))return'Phone must start with + and country code, e.g. +91 98765 43210.'
  if(!name.trim()||!/^\S+@\S+\.\S+$/.test(email))return'Enter a name and a valid email.'
  if(m.contacts.length>=5)return'You can add up to 5 contacts.'
  const c:Contact={id:m.uid++,name:name.trim(),rel:rel.trim(),email:email.trim(),phone:phone.trim()||undefined,accepted:false};m.contacts.push(c)
  sendMail(m,c,'invite',`You’ve been named a trusted contact by ${m.owner}`,'Accept to count toward the confirmation quorum.',now);return null}
export function acceptInvite(m:Model,cid:number){const c=m.contacts.find(x=>x.id===cid);if(c){c.accepted=true;log(m,c.name,'INVITE_ACCEPTED','Accepted the invitation')}}
export function removeContact(m:Model,cid:number):string|null{
  if(m.contacts.length<=1)return'Keep at least one contact.'
  m.contacts=m.contacts.filter(c=>c.id!==cid);delete m.conf[cid];log(m,m.owner,'CONTACT_REMOVED','Contact removed')
  if(m.quorum>m.contacts.length){m.quorum=m.contacts.length;log(m,'system','QUORUM_REVALIDATED',`Quorum lowered to ${m.quorum}`)}return null}
export function saveRules(m:Model,interval:number,grace:number,q:number):string|null{
  const e=quorumError(q,m.contacts.length);if(e)return e
  m.interval=interval;m.grace=grace;m.quorum=q;log(m,m.owner,'RULES_CHANGED',`Interval ${interval}d, grace ${grace}d, quorum ${q}`);return null}
