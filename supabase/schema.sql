-- Production data model (SRS section 6). Entry content is ciphertext only; contact tokens are stored as hashes.
create table maps(id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users not null,interval_days int not null default 7,grace_days int not null default 3,
  quorum int not null default 2,state text not null default 'ACTIVE',last_checkin_at timestamptz default now(),paused_until timestamptz);
create table entries(id uuid primary key default gen_random_uuid(),map_id uuid references maps on delete cascade,category int not null,title_hint text,ciphertext text not null,iv text not null,priority int not null,updated_at timestamptz default now());
create table contacts(id uuid primary key default gen_random_uuid(),map_id uuid references maps on delete cascade,name text,relationship text,email text not null,phone text,accepted_at timestamptz,token_hash text);
create table confirmations(id uuid primary key default gen_random_uuid(),map_id uuid references maps on delete cascade,contact_id uuid references contacts,decision text check(decision in('confirm','decline')),decided_at timestamptz default now(),expires_at timestamptz);
create table checkins(id uuid primary key default gen_random_uuid(),map_id uuid references maps on delete cascade,at timestamptz default now(),method text);
create table audit_events(id uuid primary key default gen_random_uuid(),map_id uuid references maps on delete cascade,actor text,event_type text,at timestamptz default now(),metadata jsonb);
create table release_sessions(id uuid primary key default gen_random_uuid(),map_id uuid references maps on delete cascade,released_at timestamptz,expires_at timestamptz,revoked_at timestamptz);
alter table maps enable row level security;alter table entries enable row level security;alter table contacts enable row level security;alter table audit_events enable row level security;
create policy owner_maps on maps for all using(owner_id=auth.uid());
create policy owner_entries on entries for all using(map_id in(select id from maps where owner_id=auth.uid()));
create policy owner_contacts on contacts for all using(map_id in(select id from maps where owner_id=auth.uid()));
-- audit log is append-only for end users (FR-I3): select + insert only, no update/delete policies
create policy owner_audit_read on audit_events for select using(map_id in(select id from maps where owner_id=auth.uid()));
-- Run the transition logic in src/lib/machine.ts (evaluate) from a Supabase Edge Function on a pg_cron schedule.

-- Snapshot sync used by the app + edge functions (one JSON document per owner, protected by RLS).
create table snapshots(owner_id uuid primary key references auth.users on delete cascade,data jsonb not null,updated_at timestamptz default now());
alter table snapshots enable row level security;
create policy own_snapshot on snapshots for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
-- Run the scheduler every minute (enable pg_cron + pg_net, then):
-- select cron.schedule('iigq-scheduler','* * * * *',$$select net.http_post(url:='https://<ref>.functions.supabase.co/scheduler',headers:='{"Authorization":"Bearer <ANON_KEY>"}'::jsonb)$$);

-- Rate limiting for contact links (NFR-2). RLS on with no policies: only the service role can read/write.
create table attempts(ip text,at timestamptz default now());
alter table attempts enable row level security;
create index on attempts(ip,at);
