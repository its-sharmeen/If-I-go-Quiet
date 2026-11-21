import {describe,it,expect} from 'vitest'
import {fresh,evaluate,checkIn,decide,revoke,quorumError,familyAccess} from '../src/lib/machine'
import {looksSecret} from '../src/lib/secrets'
import type {Model} from '../src/lib/types'
const mk=():Model=>{const m=fresh();m.seeded=true;m.owner='Aarav';m.ownerEmail='a@x.com';m.spd=1;m.last=0;m.quorum=2
  ;['a','b','c'].forEach((n,i)=>m.contacts.push({id:100+i,name:n,rel:'',email:n+'@x.com',accepted:true}));return m}
const D=1000,vm=(m:Model,cid:number)=>m.mail.find(x=>x.t==='verify'&&x.cid===cid)!.id
const notified=()=>{const m=mk();evaluate(m,8*D);evaluate(m,11.5*D);return m}
describe('If I Go Quiet core',()=>{
  it('AT-1 blocks password-like input',()=>{expect(looksSecret('password: Hunter2!')).toBeTruthy();expect(looksSecret('card 4111 1111 1111 1111')).toBeTruthy();expect(looksSecret('Blue folder, top drawer')).toBe('')})
  it('AT-2 rejects quorum above contact count',()=>{expect(quorumError(4,3)).toMatch(/exceed/);expect(quorumError(2,3)).toBeNull()})
  it('AT-3 check-in during grace returns to ACTIVE and contacts are never notified',()=>{const m=mk();evaluate(m,8*D);expect(m.state).toBe('GRACE');checkIn(m,9*D);expect(m.state).toBe('ACTIVE');expect(m.mail.some(x=>x.t==='verify')).toBe(false)})
  it('AT-4 one confirmation keeps the map locked',()=>{const m=notified();expect(m.state).toBe('CONTACTS_NOTIFIED');decide(m,vm(m,100),'confirm',12*D);expect(m.state).toBe('CONFIRMING');expect(familyAccess(m,100,12*D)).toBe(false)})
  it('AT-5 two confirmations release only to those contacts',()=>{const m=notified();decide(m,vm(m,100),'confirm',12*D);decide(m,vm(m,101),'confirm',12*D);expect(m.state).toBe('RELEASED');expect(familyAccess(m,100,12*D)).toBe(true);expect(familyAccess(m,102,12*D)).toBe(false)})
  it('AT-6 owner cancel during CONFIRMING never grants access',()=>{const m=notified();decide(m,vm(m,100),'confirm',12*D);checkIn(m,12.5*D);expect(m.state).toBe('ACTIVE');expect(familyAccess(m,100,12.5*D)).toBe(false)})
  it('AT-7 expired link is denied',()=>{const m=notified();expect(decide(m,vm(m,100),'confirm',40*D)).toMatch(/expired/)})
  it('decline halts release and alerts owner',()=>{const m=notified();decide(m,vm(m,100),'decline',12*D);expect(m.state).toBe('ACTIVE');expect(m.mail.some(x=>x.t==='notice')).toBe(true)})
  it('revoke ends access after release',()=>{const m=notified();decide(m,vm(m,100),'confirm',12*D);decide(m,vm(m,101),'confirm',12*D);revoke(m,13*D);expect(familyAccess(m,100,13*D)).toBe(false)})
  it('NFR-4 evaluate is idempotent',()=>{const m=mk();evaluate(m,8*D);const n=m.audit.length;evaluate(m,8*D);evaluate(m,8*D);expect(m.audit.length).toBe(n)})
})
