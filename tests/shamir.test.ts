import {describe,it,expect} from 'vitest'
import {split,combine} from '../src/lib/shamir'
describe('Shamir 2-of-3',()=>{
  const secret=crypto.getRandomValues(new Uint8Array(32)),sh=split(secret,3,2)
  it('any two shares recover the key',()=>{for(const p of [[0,1],[0,2],[1,2]])expect(combine(p.map(i=>sh[i]))).toEqual(secret)})
  it('one share does not',()=>{expect(combine([sh[0],sh[0]].slice(0,1))).not.toEqual(secret)})
})
