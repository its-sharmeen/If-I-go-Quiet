/** Shamir's Secret Sharing over GF(256) (SRS 8.1 stretch goal). split(secret,n,k) -> n shares; any k recover it. Share = [x, ...ys]. */
const E=new Uint8Array(510),L=new Uint8Array(256)
{let x=1;for(let i=0;i<255;i++){E[i]=x;E[i+255]=x;L[x]=i;x=((x<<1)^(x&128?0x11b:0))^x}}
const mul=(a:number,b:number)=>a&&b?E[L[a]+L[b]]:0
const div=(a:number,b:number)=>a?E[L[a]+255-L[b]]:0
export function split(secret:Uint8Array,n:number,k:number):Uint8Array[]{
  if(k<2||k>n||n>255)throw new Error('need 2 <= k <= n <= 255')
  const sh=Array.from({length:n},(_,i)=>{const s=new Uint8Array(secret.length+1);s[0]=i+1;return s})
  secret.forEach((b,j)=>{const c=new Uint8Array(k);crypto.getRandomValues(c);c[0]=b
    sh.forEach(s=>{let y=0;for(let i=k-1;i>=0;i--)y=mul(y,s[0])^c[i];s[j+1]=y})})
  return sh}
export function combine(shares:Uint8Array[]):Uint8Array{
  const out=new Uint8Array(shares[0].length-1)
  for(let j=0;j<out.length;j++){let acc=0
    shares.forEach((si,i)=>{let l=1;shares.forEach((sj,m)=>{if(m!==i)l=mul(l,div(sj[0],sj[0]^si[0]))});acc^=mul(si[j+1],l)})
    out[j]=acc}
  return out}
