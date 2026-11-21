import type {Plain} from './types'
/** NFR-2 / FR-B4: AES-GCM via Web Crypto. Plaintext never leaves the browser; only ciphertext + iv are stored. */
let K:CryptoKey|null=null
const b64=(b:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)))
const ub=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0))
export const resetKey=()=>{K=null}
export async function getKey(jwk:JsonWebKey|null):Promise<CryptoKey>{
  if(!K)K=jwk?await crypto.subtle.importKey('jwk',jwk,'AES-GCM',true,['encrypt','decrypt']):await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt'])
  return K
}
export const exportKey=(k:CryptoKey)=>crypto.subtle.exportKey('jwk',k)
export async function seal(k:CryptoKey,o:Plain){const iv=crypto.getRandomValues(new Uint8Array(12))
  return{ct:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(JSON.stringify(o)))),iv:b64(iv)}}
export async function open(k:CryptoKey,e:{ct:string;iv:string}):Promise<Plain>{
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(e.iv)},k,ub(e.ct))))}
