# Setup guide: every service, what it does, what to paste where

Three places hold settings. Never mix them up:
- **`.env` (frontend, public):** only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Safe to be public.
- **Supabase secrets (backend, private):** all other keys. Set with `supabase secrets set NAME=value`.
- **Vercel environment variables:** the same two `VITE_` values, so the live site connects too.

| # | Feature | Service | Needs key? | Why it matters (significance) |
|---|---|---|---|---|
| 1 | Accounts, magic-link login, saved data | Supabase | URL + anon key | Real accounts and storage instead of browser-only data (SRS 3.1, 4.2) |
| 2 | Scheduler: detects missed check-ins | Supabase Edge Function + pg_cron | none extra | The "goes quiet" detection runs on a server, so it works when the owner’s phone is off (FR-E1) |
| 3 | Contact links without accounts | Supabase Edge Function `contact-action` | none extra | Stressed relatives can confirm in under a minute (FR-A3, NFR-5) |
| 4 | Real emails | Resend | `RESEND_API_KEY` | Reminders, invitations, verification and release notices (FR-J1) |
| 5 | SMS + WhatsApp nudges | Twilio | SID, token, 2 numbers | "Nudges across channels" from your pitch; fewer false alarms (FR-J3) |
| 6 | AI "what to write down" ideas | Adaption (your credits) | `ADAPTION_API_KEY` | Helps first-time users start; sends only the person type, never map content |
| 7 | Hosting + link for judges | Vercel | none (env vars only) | The working deployment link Round 2 requires |
| 8 | Code + history | GitHub | none | Public repo, commit history, CI |
| 9 | Rate limiting on contact links | built in (`attempts` table) | none | Blocks guessing of links (NFR-2) |

No key needed at all: Hindi and large-text mode, QR emergency card, check-in/pause/cancel, quorum, audit log, AES-GCM encryption, Demo Mode.

## 1. Supabase (do this first, free)
1. supabase.com > New project. Wait for it to finish.
2. SQL Editor > paste all of `supabase/schema.sql` > Run.
3. Authentication > Providers: keep **Email** on. Authentication > URL Configuration: set Site URL to your Vercel link (use `http://localhost:5173` while testing).
4. Project Settings > API: copy **Project URL** and **anon public key** into `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Install the CLI (`npm i -g supabase`), then `supabase login` and `supabase link --project-ref xxxx` (the ref is the part before `.supabase.co`).
6. Database > Extensions: enable **pg_cron** and **pg_net**. Then in the SQL Editor run the `cron.schedule` line at the bottom of `schema.sql`, replacing `<ref>` and `<ANON_KEY>`.
Never put the **service_role** key in the frontend. Edge functions already receive it automatically.

## 2. Resend (emails)
1. resend.com > API Keys > create one.
2. For testing, use `MAIL_FROM="onboarding@resend.dev"`; Resend only delivers this to your own account email. For real recipients, verify your own domain in Resend and use an address on it.
3. `supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="If I Go Quiet <noreply@yourdomain.com>" APP_URL=https://your-app.vercel.app`

## 3. Twilio (SMS + WhatsApp)
1. twilio.com > sign up > Console shows **Account SID** and **Auth Token**.
2. SMS: get a trial phone number. WhatsApp: Messaging > Try it out > WhatsApp sandbox; each recipient must first send the join code to the sandbox number.
3. Trial accounts can only message verified numbers (verify your teammates’ numbers). India SMS may need extra sender registration; WhatsApp sandbox is the easiest for a demo.
4. `supabase secrets set TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_FROM=+1555... TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`
Skip Twilio entirely if you want: the app simply sends email only.

## 4. Adaption (AI ideas)
1. Redeem your credits, create an API key.
2. `supabase secrets set ADAPTION_API_KEY=xxx AI_MODEL=deepseek-v4-flash`
3. If the model name or address differs in their docs, change `AI_MODEL` or set `AI_BASE_URL` (default `https://api.prod.adaptionlabs.ai/api/v1`).

## 5. Deploy
1. `npm run deploy:functions` (deploys `scheduler`, `contact-action`, `suggest`).
2. Push to GitHub (see README). Vercel > Add New > Project > import the repo > Settings > Environment Variables: add both `VITE_` values > Redeploy.

## 6. Test the whole chain
Sign up on your live link with a real email and your phone (+country code). Add yourself as a contact, accept the email invite, set interval 7 and grace 1. To test quickly, in Supabase Table Editor open `snapshots` and set `last` in the JSON to an old timestamp (milliseconds), then run the scheduler (Edge Functions > scheduler > Invoke). You should receive the reminder by email, SMS and WhatsApp.

## Known limits (be honest with judges)
- **Shamir’s Secret Sharing** is built and tested (`src/lib/shamir.ts`) but not used in the release flow. The key is still held in the stored data, so the server is a trusted party (SRS 8.1 prototype approach).
- Data is stored as one JSON snapshot per owner, last write wins: a save in the same minute as the scheduler can overwrite it.
- Live accounts run in real time, so only the Demo (sample owner) shows the whole flow quickly.
- Service names, free-tier limits and trial rules above are from general knowledge; check each service’s current docs.
