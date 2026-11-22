// Copies the shared state-machine code into the edge functions folder (works on Windows, Mac, Linux).
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs'
mkdirSync('supabase/functions/_shared',{recursive:true})
writeFileSync('supabase/functions/_shared/machine.ts',readFileSync('src/lib/machine.ts','utf8').replace("from './types'","from './types.ts'"))
copyFileSync('src/lib/types.ts','supabase/functions/_shared/types.ts')
console.log('shared code synced')
