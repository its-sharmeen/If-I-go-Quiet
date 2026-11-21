import {useEffect,useState,useSyncExternalStore} from 'react'
import type {Model,Plain,Entry} from './types'
import {fresh,evaluate,log} from './machine'
import {sb,push} from './supabase'
import {getKey,exportKey,seal,open,resetKey} from './crypto'
/** Local persistence layer. To use Supabase, replace load()/emit() with table reads/writes (see README + supabase/schema.sql). */
const KEY='iigq-v2'
const load=():Model=>{try{const j=localStorage.getItem(KEY);return j?JSON.parse(j):fresh()}catch{/* ignore corrupted storage */return fresh()}}
let M:Model=load(),lastActive=Date.now();const subs=new Set<()=>void>()
const emit=()=>{try{localStorage.setItem(KEY,JSON.stringify(M))}catch{/* ignore storage quota errors */}subs.forEach(f=>f());if(sb&&!M.demo&&M.loggedIn)void push(M)}
export const setModel=(m:Model)=>{M=m;emit()}
export const useModel=()=>useSyncExternalStore(f=>{subs.add(f);return()=>{subs.delete(f)}},()=>M)
/** Runs fn on a copy; commits unless it returns an error string. */
export function act(fn:(m:Model)=>string|null|void):string|null{
  const c=structuredClone(M),r=fn(c);if(typeof r==='string')return r
  M=c;emit();return null}
export function tick(){
  const c=structuredClone(M),n=c.audit.length;evaluate(c)
  if(!c.demo&&c.loggedIn&&Date.now()-lastActive>10*60*1000){c.loggedIn=false;log(c,'system','SESSION_EXPIRED','Logged out after inactivity')}
  if(c.audit.length!==n){M=c;emit()}}
export const touch=()=>{lastActive=Date.now()}
export async function seedDemo(){
  resetKey();const m=fresh();m.seeded=true;m.demo=true;m.loggedIn=true;m.owner='Aarav Mehta';m.ownerEmail='aarav@example.com'
  ;[['Meera Mehta','Mother','meera@example.com'],['Kabir Mehta','Brother','kabir@example.com'],['Isha Rao','Close friend','isha@example.com']].forEach(c=>m.contacts.push({id:m.uid++,name:c[0],rel:c[1],email:c[2],accepted:true}))
  const E:[number,string,string,string,string][]=[[3,'Call first: Dr. Anita Rao','Family doctor; knows my medical history','Number on the fridge note','Dr. Anita Rao'],[3,'Call second: HR at my employer','Tell them; ask about group insurance','HR portal, Helpdesk page','Neha (HR)'],[0,'Salary account (HDFC)','Main account, about 3 months of expenses','Passbook in grey file; alerts go to my email','Branch manager, Kothrud'],[0,'Term life policy','Insurer plus last 4 digits of policy no: 4821','Blue folder, top drawer of study desk','Ravi Kulkarni (agent)'],[1,'Passport and Aadhaar','Originals only','Fireproof box, bottom shelf of wardrobe',''],[1,'Rental agreement','Lease valid to March 2027','Photo in Drive under Home','Landlord Mr. Shah'],[2,'Email and cloud accounts','Bank alerts go to my main email; recovery is set to Kabir','Recovery contact: Kabir',''],[4,'Last wishes','Keep it simple. Tell my college friends.','Printed sheet with Isha','Isha Rao']]
  const k=await getKey(null);m.key=await exportKey(k)
  for(let i=0;i<E.length;i++){const e=E[i];m.entries.push({id:m.uid++,cat:e[0],prio:i+1,...await seal(k,{title:e[1],desc:e[2],where:e[3],contact:e[4]})})}
  log(m,'demo','DEMO_SEEDED',`Sample owner loaded: 3 contacts, 2-of-3 quorum, ${E.length} encrypted entries`);M=m;emit()}
export function newAccount(name:string,email:string,phone=''){resetKey();const m=fresh();m.seeded=true;m.demo=false;m.loggedIn=true;m.spd=86400;m.owner=name;m.ownerEmail=email;m.ownerPhone=phone||undefined;m.quorum=1;log(m,name,'SIGNUP','Account created');M=m;emit()}
export const logout=()=>act(m=>{m.loggedIn=false;log(m,m.owner,'LOGOUT','Logged out')})
export const login=()=>{touch();act(m=>{m.loggedIn=true;log(m,m.owner,'LOGIN','Logged in via magic link (simulated)')})}
export const deleteAccount=()=>{resetKey();M=fresh();emit()}
export async function addEntry(cat:number,prio:number,p:Plain){
  const k=await getKey(M.key),jwk=M.key??await exportKey(k),ent=await seal(k,p)
  act(m=>{m.key=jwk;m.entries.push({id:m.uid++,cat,prio,...ent});log(m,m.owner,'ENTRY_ADDED',`Entry added to category ${cat+1} (encrypted in browser)`)})}
export function useOpen(es:Entry[],jwk:JsonWebKey|null){
  const[o,setO]=useState<Record<number,Plain>>({})
  useEffect(()=>{let ok=true;(async()=>{const k=await getKey(jwk),r:Record<number,Plain>={}
    for(const e of es)try{r[e.id]=await open(k,e)}catch{/* ignore decrypt failure */}
    if(ok)setO(r)})();return()=>{ok=false}},[es,jwk])
  return o}