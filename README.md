# If I Go Quiet
A family emergency map that opens only when you can’t. Team NASH (Nadim Saifi, Sharmeen Khan), Orbix Round 2.

## Run in VS Code
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # state machine, quorum, secrets, token expiry (AT-1 to AT-7)
npm run build
```
Needs Node 18+. Works offline: data persists in the browser (localStorage), emails are shown in a simulated Inbox.

## Demo script (SRS 9.1)
1. Home → **Try the demo** (sample owner, 3 contacts, 2-of-3 quorum, encrypted map).
2. Dashboard → **Check in**. 3. **Go quiet**: watch Grace and reminders (Inbox shows email + simulated SMS/WhatsApp).
4. Inbox → open Contact 1’s secure link → confirm; then Contact 2. 5. On quorum, open the release email → **Family View** (People to Call first).
6. Audit tab; Dashboard → cancel/revoke. Try a password in the Map form to see it blocked.

## Structure
`src/lib/machine.ts` state machine, quorum, rules (pure, tested) · `crypto.ts` AES-GCM · `secrets.ts` secret blocker · `store.ts` persistence · `src/App.tsx` screens · `supabase/schema.sql` production schema + RLS · `tests/`.

## Real backend (Supabase + Resend)
1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor, copy `.env.example` to `.env` and fill the two `VITE_` values. Enable Email (magic link) auth.
2. `supabase login && supabase link --project-ref <ref>`, then `supabase secrets set RESEND_API_KEY=... MAIL_FROM=... APP_URL=...` and `npm run deploy:functions` (copies `machine.ts` into the functions, then deploys `scheduler` and `contact-action`).
3. Schedule `scheduler` every minute with the pg_cron snippet at the bottom of `schema.sql`. Deploy the frontend to Vercel or Netlify with the same `VITE_` env vars.
Without `.env` the app runs local-only. Contacts open `#/c/<owner>/<token>` links and need no account.

## AI helper (optional, uses your Adaption credits)
The "Not sure what to write down?" card works offline with built-in lists. With Supabase connected it can also call the `suggest` edge function, which sends **only the person type** (for example "Student") to an OpenAI-compatible model, never any map content:
`supabase secrets set ADAPTION_API_KEY=... AI_MODEL=deepseek-v4-flash` (default base URL `https://api.prod.adaptionlabs.ai/api/v1`, override with `AI_BASE_URL`). Never put the key in `.env` or frontend code.

## Extras
Hindi + large-text mode (header buttons; main screens translated), Emergency QR card on the dashboard, `src/lib/shamir.ts` (2-of-3 key splitting with tests), ESLint + Prettier, GitHub Actions CI.

## Limitations (honest)
- Shamir splitting is implemented and tested but not yet wired into the release flow; the key still lives in the snapshot (SRS 8.1 prototype approach).
- Sync is one JSON snapshot per owner, last write wins: a client save can overwrite a scheduler change made in the same minute. A production version should use the per-entity tables in `schema.sql`.
- SMS and WhatsApp are simulated (no provider). Hindi covers the main screens only. Not tested against a live Supabase project.

- Local mode: the browser is the backend. The state machine is server-ready (pure functions) but here runs client-side; to productionise, move `evaluate/decide` into Supabase Edge Functions on a cron and swap `store.ts` for Supabase calls.
- In local mode email and login are simulated. Sample data only. Not a will or legal advice.

## Judges: test it yourself (about 5 minutes, real emails)
1. Open the live link. Use the **Try it for real** card: enter an email and a password (6+ characters) and press **Create account**.
2. **My map:** add one or two entries (for example “Insurance papers” and “Call first: Dr. Rao”).
3. **My people:** add one trusted person. Use a second email of yours, or the same email if you only have one. Open the invitation email and press **Accept** (check spam).
4. **Dashboard:** press **Start the 3-minute live test** and do nothing else.
5. After about a minute you get a reminder email (the one-tap “I’m okay” link cancels everything). About two minutes later your trusted person gets “Please confirm”.
6. Open it, tick the box, confirm. Your dashboard shows **Map opened** and the Family View link arrives by email.
7. Press **Revoke access** to see the owner stay in control.
Emails are sent from a test sender and may take up to a minute. Real days are shortened to minutes only in the live test.
