import {createClient} from '@supabase/supabase-js'
import type {Model} from './types'
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined,anon=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined
/** null when env vars are missing: the app then runs in local-only mode. */
export const sb=url&&anon?createClient(url,anon):null
export const signInLink=(email:string)=>sb!.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin}})
export async function pull():Promise<Model|null>{const{data}=await sb!.from('snapshots').select('data').maybeSingle();return(data?.data as Model)??null}
export async function push(m:Model){const{data:{user}}=await sb!.auth.getUser();if(user)await sb!.from('snapshots').upsert({owner_id:user.id,data:m,updated_at:new Date().toISOString()})}
export async function ownerId(){return(await sb!.auth.getUser()).data.user?.id}
export interface ContactReply{error?:string;type?:string;owner?:string;state?:string;confirmed?:number;quorum?:number;done?:boolean;view?:{key:JsonWebKey;entries:{id:number;cat:number;prio:number;ct:string;iv:string}[]}}
export async function contactAction(owner:string,tok:string,decision:string):Promise<ContactReply>{
  const{data,error}=await sb!.functions.invoke('contact-action',{body:{owner,tok,decision}});return error?{error:error.message}:data}
export async function suggest(role:string,lang:string):Promise<{cat:number;title:string;hint:string}[]>{
  const{data}=await sb!.functions.invoke('suggest',{body:{role,lang}});return Array.isArray(data?.items)?data.items:[]}
