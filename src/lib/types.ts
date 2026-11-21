export type St='ACTIVE'|'GRACE'|'CONTACTS_NOTIFIED'|'CONFIRMING'|'RELEASED'
export interface Contact{id:number;name:string;rel:string;email:string;phone?:string;accepted:boolean}
export interface Entry{id:number;cat:number;prio:number;ct:string;iv:string}
export interface Plain{title:string;desc:string;where:string;contact:string}
export type MailType='invite'|'verify'|'release'|'reminder'|'notice'
export interface Mail{id:number;cid:number;to:string;t:MailType;subj:string;body:string;ep:number;exp:number;at:number;tok:string}
export interface Audit{at:number;actor:string;type:string;msg:string}
export interface Model{seeded:boolean;demo:boolean;loggedIn:boolean;spd:number;interval:number;grace:number;quorum:number;state:St;last:number;rem:number;ep:number;uid:number;
owner:string;ownerEmail:string;ownerPhone?:string;relExp:number;contacts:Contact[];entries:Entry[];conf:Record<number,number>;audit:Audit[];mail:Mail[];key:JsonWebKey|null}
