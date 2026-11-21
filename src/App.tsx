import {useEffect,useState} from 'react'
import QR from 'qrcode'
import type {Model,Mail,Plain} from './lib/types'
import {CATS,FAMORD,ST,NICE,dayMs,quorumError,familyAccess,linkOk,checkIn,revoke,pause,goQuiet,decide,addContact,acceptInvite,removeContact,saveRules,log} from './lib/machine'
import {sb,pull,signInLink,ownerId,contactAction,suggest,type ContactReply} from './lib/supabase'
import {IDEAS,type Idea} from './lib/ideas'
import {t,usePrefs,setPrefs} from './lib/i18n'
import {getKey,open as openCt} from './lib/crypto'
import {looksSecret} from './lib/secrets'
import {useModel,act,tick,touch,setModel,seedDemo,newAccount,logout,login,deleteAccount,addEntry,useOpen} from './lib/store'

type View='home'|'dash'|'map'|'contacts'|'audit'|'inbox'|'verify'|'family'
const NAV:[View,string][]=[['home','Start'],['dash','My status'],['map','My map'],['contacts','My people'],['audit','Activity'],['inbox','Messages'],['family','Family view']]
const tm=(t:number)=>new Date(t).toLocaleTimeString()

export default function App(){
  const m=useModel();usePrefs()
  const[view,setView]=useState<View>('home'),[cat,setCat]=useState(0),[mid,setMid]=useState(0),[fam,setFam]=useState(0),[msg,setMsg]=useState('')
  useEffect(()=>{const t=setInterval(tick,1000),c=()=>touch();window.addEventListener('click',c);return()=>{clearInterval(t);window.removeEventListener('click',c)}},[])
  useEffect(()=>{if(!sb)return;const f=async(email:string)=>{const d=await pull();if(d)setModel({...d,loggedIn:true});else newAccount(email.split('@')[0],email)}
    const{data:l}=sb.auth.onAuthStateChange((_e,s)=>{if(s?.user.email)void f(s.user.email)});return()=>l.subscription.unsubscribe()},[])
  const say=(s:string|null)=>{if(s){setMsg(s);setTimeout(()=>setMsg(''),3500)}}
  const v=!m.seeded||!m.loggedIn?'home':view
  const cm=location.hash.match(/^#\/c\/([^/]+)\/(.+)$/);if(cm)return<><header><b>🗺️ If I Go Quiet</b><Prefs/></header><main><ContactPage owner={cm[1]} tok={cm[2]}/></main></>
  return<>
    <header><b>🗺️ If I Go Quiet</b><Prefs/>{m.seeded&&<span className={m.demo?'demo':'live'}>{m.demo?'Demo · made-up data':'Live account'}</span>}{m.seeded&&m.loggedIn&&!m.demo&&<button onClick={()=>{void sb?.auth.signOut();logout()}}>{t('Log out')}</button>}</header>
    <nav aria-label="Sections">{NAV.map(([k,l])=><button key={k} aria-current={k===v||(v==='verify'&&k==='inbox')} onClick={()=>setView(k)}>{t(l)}{k==='inbox'&&m.mail.length?` (${m.mail.length})`:''}</button>)}</nav>
    <main aria-live="polite">
      {m.seeded&&m.demo&&m.loggedIn&&['dash','map','contacts','audit','inbox'].includes(v)&&<NextStep m={m} go={setView}/>}
      {v==='home'&&<Home m={m} go={setView} say={say}/>}
      {v==='dash'&&<Dash m={m} say={say}/>}
      {v==='map'&&<MapEditor m={m} cat={cat} setCat={setCat} say={say}/>}
      {v==='contacts'&&<Contacts m={m} say={say}/>}
      {v==='audit'&&<div><h2>Activity history</h2><p className="mu">A record of everything that happens, so nothing is secret from you.</p><div className="card">{m.audit.map((a,i)=><p key={i}><span className="tag">{tm(a.at)}</span> <b>{a.type}</b> by {a.actor}<br/><span className="mu">{a.msg}</span></p>)}{!m.audit.length&&<p className="mu">No events yet.</p>}</div></div>}
      {v==='inbox'&&<Inbox m={m} open={(x:Mail)=>{setMid(x.id);if(x.t==='verify')setView('verify');else if(x.t==='release'){setFam(x.cid);if(familyAccess(m,x.cid))act(mm=>log(mm,mm.contacts.find(c=>c.id===x.cid)?.name??'contact','VIEW','Viewed the Family View; owner notified'));setView('family')}}} say={say}/>}
      {v==='verify'&&<Verify m={m} mid={mid} say={say}/>}
      {v==='family'&&<Family m={m} cid={fam}/>}
    </main>
    {msg&&<div id="t" role="status">{msg}</div>}
  </>
}

function Home({m,go,say}:{m:Model;go:(v:View)=>void;say:(s:string|null)=>void}){
  const[n,setN]=useState(''),[e,setE]=useState(''),[ph,setPh]=useState('')
  return<>
    <div className="card"><h1>{t('Help your family help you, if you ever can’t answer.')}</h1>
    <p className="lead">Write down where your important things are (not passwords). If you ever stop responding, the people you trust can see it, but only if enough of them agree.</p>
    <button className="p big" onClick={async()=>{await seedDemo();go('dash')}}>▶ {t('See how it works (2-minute demo)')}</button>
    <p className="mu">No sign-up needed. It uses made-up sample data.</p></div>
    <div className="how"><div><b>🗺️</b><h3>1. Write it down</h3><p>Where your bank, insurance and documents are, and who to call first.</p></div><div><b>👍</b><h3>2. Say “I’m okay”</h3><p>Tap once in a while. That’s all you have to do.</p></div><div><b>🤝</b><h3>3. Your people can help</h3><p>If you go quiet, we remind you first. Then your trusted people are asked, and 2 of 3 must agree.</p></div></div>
    <div className="card"><h3>🔒 Safe by design</h3><p>We never store passwords, PINs, OTPs or card numbers, only <i>where</i> things are. Everything is locked (encrypted) on your device, and one tap cancels at any time.</p></div>
    {sb&&!m.loggedIn&&<SignIn/>}
    {m.seeded&&!m.demo&&!m.loggedIn?<div className="card"><h3>Welcome back, {m.owner}</h3><button className="p" onClick={()=>{login();go('dash')}}>Log in with magic link (simulated)</button></div>
    :<div className="card"><h3>Sign up</h3><label>Name<input value={n} onChange={x=>setN(x.target.value)}/></label><label>Email<input type="email" value={e} onChange={x=>setE(x.target.value)}/></label>
    <label>Mobile for SMS and WhatsApp reminders (optional)<input value={ph} onChange={x=>setPh(x.target.value)} placeholder="+91 98765 43210"/></label>
    <button className="p" onClick={()=>{if(!n.trim()||!/^\S+@\S+\.\S+$/.test(e))return say('Enter your name and a valid email.');newAccount(n.trim(),e.trim(),ph.trim());go('dash')}}>{t('Create my map')}</button>
    <p className="tag">Live accounts run in real time (1 day = 1 day) and have no demo controls.</p></div>}
  </>
}

function Countdown({m}:{m:Model}){
  const[n,setN]=useState(Date.now())
  useEffect(()=>{const t=setInterval(()=>setN(Date.now()),1000);return()=>clearInterval(t)},[])
  const d=dayMs(m),due=m.last+m.interval*d,ge=due+m.grace*d,f=(x:number)=>Math.max(0,x/d).toFixed(1)
  return<p className="mu">{m.state==='ACTIVE'?(m.last>n?`Check-ins paused. Resume in ${f(m.last-n)} days`:`Next check-in due in ${f(due-n)} days`):m.state==='GRACE'?`Grace ends in ${f(ge-n)} days. Nothing is shared.`:m.state==='RELEASED'?'Map is open to confirming contacts.':'Waiting for contacts to confirm. Nothing is shared yet.'}</p>
}

function Dash({m,say}:{m:Model;say:(s:string|null)=>void}){
  const act1=m.state==='ACTIVE',n=m.contacts.length,accepted=m.contacts.filter(c=>c.accepted).length
  return<>
    <div className="card"><div className="row"><h2>{m.owner}</h2><span className={`pill s-${m.state}`}>{NICE[m.state]}</span></div>
    <div className="steps">{ST.map(s=><i key={s} className={s===m.state?'on':''}>{NICE[s]}</i>)}</div>
    <Countdown m={m}/><p>You last said you’re okay at <b>{tm(m.last)}</b>. We check in every {m.interval} days. If you don’t answer, we wait {m.grace} more days, then ask your trusted people. {m.quorum} of {n} must agree.</p>
    {accepted<m.quorum&&<p className="warn">Only {accepted} contact(s) accepted. You need {m.quorum} accepted contacts for a release to be possible.</p>}
    {m.state==='RELEASED'?<button className="p big" onClick={()=>{act(x=>revoke(x));say('Access revoked.')}}>{t('Revoke access and end release')}</button>
    :<button className="p big" onClick={()=>{act(x=>checkIn(x));say(act1?'Checked in. Timer reset.':'Cancelled. Back to Active.')}}>{t(act1?'I’m okay: check in':'Cancel the process: I’m okay')}</button>}
    {act1&&<p><button onClick={()=>{act(x=>pause(x,m.demo?3:7));say('Check-ins paused.')}}>Pause check-ins ({m.demo?3:7} days)</button></p>}</div>
    <div className="card"><h3>What’s in your map</h3>{CATS.map((c,i)=>{const k=m.entries.filter(e=>e.cat===i).length;return<span key={c} className="pill" style={{background:k?'var(--ok)':'var(--mu)',margin:2,display:'inline-block',color:'#fff'}}>{k?'✓':'○'} {c} ({k})</span>})}</div>
    <EmergencyCard m={m}/>
    {m.demo&&<div className="card"><h3>Try it out (demo only)</h3><p className="warn">Demo Mode makes days pass in seconds so you can watch the whole story. It uses made-up data and never affects real accounts.</p>
    <div className="row"><button className="d" disabled={!act1} onClick={()=>say(act(x=>goQuiet(x)))}>{t('Pretend I’m unreachable')}</button>
    <label>Speed <select value={m.spd} onChange={e=>act(x=>{x.spd=+e.target.value})} style={{width:'auto'}}>{[10,5,2].map(s=><option key={s} value={s}>1 day = {s} s</option>)}</select></label>
    <button onClick={async()=>{await seedDemo()}}>Reset sample</button></div></div>}
  </>
}

function MapEditor({m,cat,setCat,say}:{m:Model;cat:number;setCat:(n:number)=>void;say:(s:string|null)=>void}){
  const es=m.entries.filter(e=>e.cat===cat).sort((a,b)=>a.prio-b.prio),o=useOpen(es,m.key)
  const[f,setF]=useState({title:'',desc:'',where:'',contact:'',prio:es.length+1}),[err,setErr]=useState('')
  const submit=async()=>{
    if(!f.title.trim())return setErr('Add a title first.')
    const b=looksSecret(`${f.title}\n${f.desc}\n${f.where}\n${f.contact}`)
    if(b)return setErr(`Blocked: this looks like ${b}. Store where it is, not what it is.`)
    setErr('');await addEntry(cat,f.prio,{title:f.title.trim(),desc:f.desc.trim(),where:f.where.trim(),contact:f.contact.trim()});setF({title:'',desc:'',where:'',contact:'',prio:es.length+2});say('Encrypted and saved.')}
  const set=(k:string)=>(e:{target:{value:string}})=>setF({...f,[k]:k==='prio'?+e.target.value:e.target.value})
  return<>
    <h2>My map: where things are</h2><Ideas pick={(i:Idea)=>{setCat(i.cat);setF(x=>({...x,title:i.title,desc:i.hint}))}}/><div className="row" style={{justifyContent:'flex-start'}}>{CATS.map((c,i)=><button key={c} className={i===cat?'p':''} onClick={()=>setCat(i)}>{c}</button>)}</div>
    {es.map(e=>{const p=o[e.id];return<div className="card" key={e.id}><div className="row"><h3>{e.prio}. {p?.title??'…'}</h3><button className="d" onClick={()=>act(x=>{x.entries=x.entries.filter(y=>y.id!==e.id);log(x,x.owner,'ENTRY_DELETED','Entry deleted')})}>Delete</button></div>
    <p>{p?.desc}</p><p><b>Where:</b> {p?.where||'-'}{p?.contact&&<> · <b>Contact:</b> {p.contact}</>}</p><details><summary className="tag">Stored as ciphertext</summary><code>{e.ct.slice(0,120)}…</code></details></div>})}
    {!es.length&&<p className="mu">Nothing here yet. Add the first entry below.</p>}
    <div className="card"><h3>Add entry to {CATS[cat]}</h3><p className="warn">Record where things are, never secrets. Passwords, PINs, OTPs and card numbers are blocked.</p>
    <label>Title<input value={f.title} maxLength={80} onChange={set('title')}/></label><label>Description<textarea rows={2} value={f.desc} maxLength={200} onChange={set('desc')}/></label>
    <label>Where to find it<input value={f.where} maxLength={120} onChange={set('where')}/></label><label>Contact (optional)<input value={f.contact} maxLength={80} onChange={set('contact')}/></label>
    <label>Priority (1 = first)<input type="number" min={1} value={f.prio} onChange={set('prio')}/></label>
    {err&&<p className="er" role="alert">{err}</p>}<button className="p" onClick={submit}>Encrypt and save</button></div>
  </>
}

function Contacts({m,say}:{m:Model;say:(s:string|null)=>void}){
  const[c,setC]=useState({n:'',r:'',e:'',p:''}),[q,setQ]=useState(m.quorum),[iv,setIv]=useState(m.interval),[g,setG]=useState(m.grace)
  return<>
    <h2>My trusted people</h2>
    {m.contacts.map(x=><div className="card" key={x.id}><div className="row"><div><b>{x.name}</b> <span className="mu">{x.rel} · {x.email}{x.phone?' · '+x.phone:''}</span><br/><span className="tag">{x.accepted?'Accepted invitation':'Invited, not yet accepted'}</span></div>
    <div>{!x.accepted&&<button onClick={()=>act(y=>acceptInvite(y,x.id))}>Simulate accept</button>} <button className="d" onClick={()=>say(act(y=>removeContact(y,x.id)))}>Remove</button></div></div></div>)}
    <div className="card"><h3>Add contact ({m.contacts.length} of 5)</h3><label>Name<input value={c.n} onChange={e=>setC({...c,n:e.target.value})}/></label><label>Relationship<input value={c.r} onChange={e=>setC({...c,r:e.target.value})}/></label><label>Email<input type="email" value={c.e} onChange={e=>setC({...c,e:e.target.value})}/></label>
    <label>Mobile (optional, for SMS and WhatsApp)<input value={c.p} onChange={e=>setC({...c,p:e.target.value})} placeholder="+91 98765 43210"/></label><button className="p" disabled={m.contacts.length>=5} onClick={()=>{const r=act(y=>addContact(y,c.n,c.r,c.e,c.p));if(r)say(r);else setC({n:'',r:'',e:'',p:''})}}>Send invitation</button></div>
    <div className="card"><h3>Rules</h3><label>Check-in interval (days)<select value={iv} onChange={e=>setIv(+e.target.value)}>{[7,14,30].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Grace period (days)<select value={g} onChange={e=>setG(+e.target.value)}>{[1,2,3,5,7].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Quorum (contacts who must confirm)<input type="number" min={1} value={q} onChange={e=>setQ(+e.target.value)}/></label>
    {quorumError(q,m.contacts.length)&&<p className="er">{quorumError(q,m.contacts.length)}</p>}
    <button className="p" onClick={()=>{const r=act(y=>saveRules(y,iv,g,q));say(r??'Rules saved.')}}>Save rules</button></div>
    <div className="card"><h3>Delete account</h3><p className="mu">Removes your map, contacts and audit log from this browser.</p><button className="d" onClick={()=>{if(confirm('Delete everything?'))deleteAccount()}}>Delete account and all data</button></div>
  </>
}

const CH:Record<string,string>={invite:'Email',verify:'Email',release:'Email',reminder:'Email + SMS and WhatsApp (simulated)',notice:'Email'}
function Inbox({m,open,say}:{m:Model;open:(x:Mail)=>void;say:(s:string|null)=>void}){
  return<><h2>Messages</h2><p className="mu">These are the emails your people would receive. Tap the buttons to act as them. No email ever contains your map.</p>
  {m.mail.map(x=><div className="card" key={x.id}><span className="tag">To {x.to} · {tm(x.at)} · {CH[x.t]}</span><h3>{x.subj}</h3><p>{x.body}</p>
  {x.t==='invite'&&<button onClick={()=>act(y=>acceptInvite(y,x.cid))}>Accept invitation</button>}
  {x.t==='verify'&&<button className="p" onClick={()=>open(x)}>Open secure link</button>}
  {x.t==='release'&&<button className="p" onClick={()=>open(x)}>Open Family View</button>}
  {x.t==='reminder'&&<button className="p" onClick={()=>{act(y=>checkIn(y));say('Checked in from the email link.')}}>I’m okay (one tap)</button>}</div>)}
  {!m.mail.length&&<p className="mu">No emails yet. Press “Go quiet” on the dashboard.</p>}</>
}

function Verify({m,mid,say}:{m:Model;mid:number;say:(s:string|null)=>void}){
  const[ok,setOk]=useState(false),ml=m.mail.find(x=>x.id===mid),c=m.contacts.find(x=>x.id===ml?.cid)
  if(!ml||!c)return<p>Link not found.</p>
  const k=Object.keys(m.conf).length
  let body
  if(ml.exp<=Date.now())body=<p className="er"><b>This link has expired.</b> Access denied.</p>
  else if(c.id in m.conf)body=<p>Your confirmation is recorded. Thank you.</p>
  else if(!linkOk(m,ml,Date.now()))body=<p><b>This request is no longer active.</b> The owner is safe or the process was cancelled.</p>
  else body=<><p><b>{m.owner}</b> has missed their check-ins and hasn’t responded to reminders. Confirm only if you tried to reach them and could not.</p>
    <label style={{display:'flex',gap:8}}><input type="checkbox" style={{width:'auto'}} checked={ok} onChange={e=>setOk(e.target.checked)}/> I tried to reach {m.owner} and could not. I understand this is a serious action.</label>
    <button className="p big" disabled={!ok} onClick={()=>say(act(x=>decide(x,mid,'confirm')))}>{t('Confirm')}</button>
    <p><button className="d" onClick={()=>say(act(x=>decide(x,mid,'decline')))}>I can reach them. They’re fine.</button></p></>
  return<div className="card"><h2>Hello {c.name}</h2>{body}<p className="mu">Status: {k} of {m.quorum} confirmations. You can’t see any map content before release.</p></div>
}

function Family({m,cid}:{m:Model;cid:number}){
  const c=m.contacts.find(x=>x.id===cid),o=useOpen(m.entries,m.key)
  if(!c)return<div className="card"><h2>Family View is locked</h2><p>It opens only from the release email, and only after enough contacts confirm.</p></div>
  if(!familyAccess(m,cid))return<div className="card"><h2>Access denied</h2><p>The owner has returned, the release was revoked, or access expired.</p></div>
  return<div className="fam"><p className="warn">Read-only. Viewing as {c.name}. Access ends if {m.owner} returns.</p><button onClick={()=>window.print()}>Print or save as PDF</button>
  {FAMORD.map(ci=>{const es=m.entries.filter(e=>e.cat===ci).sort((a,b)=>a.prio-b.prio);return es.length?<section key={ci}><h2>{CATS[ci]}</h2>{es.map(e=>{const p=o[e.id];return<div className="card" key={e.id}><h3>{p?.title}</h3><p>{p?.desc}</p><p><b>Where:</b> {p?.where||'-'}{p?.contact&&<><br/><b>Contact:</b> {p.contact}</>}</p></div>})}</section>:null})}</div>
}

function NextStep({m,go}:{m:Model;go:(v:View)=>void}){
  const s=m.state,txt=s==='ACTIVE'?'👋 Try it: tap “I’m okay” to see a check-in. When you’re ready, press “Pretend I’m unreachable” to watch what happens next.'
    :s==='GRACE'?'⏳ We’re sending you reminders first. In real life, one tap on “I’m okay” would stop everything. For the demo, just wait a few seconds.'
    :s==='RELEASED'?'🎉 Enough people agreed, so the map opened for them. Open “Messages” and tap “Open Family View” to see what they see.'
    :'📬 Your trusted people have been asked. Open “Messages”, tap “Open secure link” for two different people, and confirm. (Or tap “I’m okay” to cancel.)'
  return<div className="guide"><b>What to do next</b><p>{txt}</p>{(s==='CONTACTS_NOTIFIED'||s==='CONFIRMING'||s==='RELEASED')&&<button className="p" onClick={()=>go('inbox')}>Go to Messages</button>}</div>
}

function Ideas({pick}:{pick:(i:Idea)=>void}){
  const[role,setRole]=useState(''),[list,setList]=useState<Idea[]>([]),[busy,setBusy]=useState(false),p=usePrefs()
  const ai=async()=>{setBusy(true);const x=await suggest(role,p.lang);setBusy(false);if(x.length)setList(x)}
  return<div className="card"><h3>Not sure what to write down?</h3><p className="mu">Pick what describes you. Only this choice is used, never your map.</p>
  <div className="row" style={{justifyContent:'flex-start'}}>{Object.keys(IDEAS).map(r=><button key={r} className={r===role?'p':''} onClick={()=>{setRole(r);setList(IDEAS[r])}}>{r}</button>)}</div>
  {list.map((i,k)=><div key={k} className="row" style={{margin:'8px 0'}}><span><b>{i.title}</b><br/><span className="tag">{i.hint}</span></span><button onClick={()=>pick(i)}>Use this</button></div>)}
  {role&&sb&&<button disabled={busy} onClick={()=>void ai()}>{busy?'Thinking…':'✨ Get more ideas from AI'}</button>}</div>
}

function Prefs(){const p=usePrefs();return<span className="row" style={{gap:6}}><button onClick={()=>setPrefs({lang:p.lang==='en'?'hi':'en'})}>{p.lang==='en'?'हिन्दी':'English'}</button><button aria-pressed={p.elder} onClick={()=>setPrefs({elder:!p.elder})}>{t('Large text')}</button></span>}

function SignIn(){
  const[e,setE]=useState(''),[s,setS]=useState('')
  return<div className="card"><h3>Log in with a magic link</h3><label>Email<input type="email" value={e} onChange={x=>setE(x.target.value)}/></label>
  <button className="p" onClick={async()=>{const r=await signInLink(e.trim());setS(r.error?r.error.message:'Check your email for the sign-in link.')}}>Email me a sign-in link</button>{s&&<p role="status">{s}</p>}</div>
}

function EmergencyCard({m}:{m:Model}){
  const[u,setU]=useState('')
  const txt=`If I Go Quiet: emergency card\nOwner: ${m.owner}\nTrusted contacts:\n`+m.contacts.map(c=>`${c.name} (${c.rel||'contact'}) ${c.email}`).join('\n')
  useEffect(()=>{void QR.toDataURL(txt,{width:180,margin:1}).then(setU)},[txt])
  return<div className="card"><h3>{t('Emergency card')}</h3><p className="mu">For a wallet or phone lock screen. It lists who to call, never any map content.</p>{u&&<img src={u} alt="Emergency QR code" width={180} height={180}/>}<p><button onClick={()=>window.print()}>Print card</button></p></div>
}

/** Standalone page for contacts, opened from an email link (#/c/<owner>/<token>). Needs Supabase; no account required. */
function ContactPage({owner,tok}:{owner:string;tok:string}){
  const[r,setR]=useState<ContactReply|null>(null),[ok,setOk]=useState(false),[o,setO]=useState<Record<number,Plain>>({})
  const call=async(d:string)=>setR(sb?await contactAction(owner,tok,d):{error:'This link needs the hosted app (Supabase not configured).'})
  useEffect(()=>{void call('info')},[])
  useEffect(()=>{if(!r?.view)return;void(async()=>{const k=await getKey(r.view!.key),x:Record<number,Plain>={};for(const e of r.view!.entries)try{x[e.id]=await openCt(k,e)}catch{/* skip */};setO(x)})()},[r])
  if(!r)return<p>Loading…</p>
  if(r.error)return<div className="card"><h2>Access denied</h2><p className="er">{r.error}</p></div>
  if(r.view)return<div className="fam"><p className="warn">Read-only Family View.</p>{r.view.entries.sort((a,b)=>a.prio-b.prio).map(e=><div className="card" key={e.id}><h3>{o[e.id]?.title}</h3><p>{o[e.id]?.desc}</p><p><b>Where:</b> {o[e.id]?.where||'-'}</p></div>)}</div>
  return<div className="card"><h2>{r.owner}</h2><p className="mu">Status: {r.confirmed} of {r.quorum} confirmations. No map content is shown before release.</p>
  {r.type==='invite'&&<button className="p" onClick={()=>void call('accept')}>Accept invitation</button>}
  {r.type==='release'&&<button className="p big" onClick={()=>void call('view')}>Open Family View</button>}
  {r.type==='verify'&&(r.done?<p>Your confirmation is recorded. Thank you.</p>:<><label style={{display:'flex',gap:8}}><input type="checkbox" style={{width:'auto'}} checked={ok} onChange={e=>setOk(e.target.checked)}/> I tried to reach {r.owner} and could not. I understand this is a serious action.</label>
  <button className="p big" disabled={!ok} onClick={()=>void call('confirm')}>{t('Confirm')}</button><p><button className="d" onClick={()=>void call('decline')}>{t('I can reach them. They’re fine.')}</button></p></>)}</div>
}
void ownerId
