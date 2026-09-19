-- Additive application schemas. Does not modify existing public tables.
create schema if not exists trainwith;
create schema if not exists trainwith_private;
revoke all on schema trainwith_private from public, anon, authenticated;
grant usage on schema trainwith to anon, authenticated;

create table trainwith.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create table trainwith.creators (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null unique references trainwith.profiles(id),
  handle text not null unique check (handle ~ '^[a-z][a-z0-9_]{2,23}$'),
  name text not null,
  category text not null default 'Strength' check (category in ('Strength','Mobility','Pilates')),
  tagline text not null default '',
  bio text not null default '',
  photo text not null default '',
  price_cents integer not null default 0 check (price_cents between 0 and 100000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  published boolean not null default false,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create table trainwith.workouts (
  id text primary key,
  creator_id text not null references trainwith.creators(id),
  title text not null check (length(title) between 1 and 160),
  description text not null default '',
  minutes integer not null default 20 check (minutes between 1 and 180),
  equipment text not null default 'Mat',
  level text not null default 'Beginner',
  free boolean not null default false,
  published boolean not null default false,
  photo text not null default '',
  created_at timestamptz not null default now()
);
create index workouts_creator_idx on trainwith.workouts(creator_id);
create table trainwith.programs (
  id text primary key,
  creator_id text not null references trainwith.creators(id),
  title text not null check (length(title) between 1 and 160),
  description text not null default '',
  weeks integer not null default 4 check (weeks between 1 and 52),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table trainwith.program_workouts (
  program_id text not null references trainwith.programs(id) on delete cascade,
  workout_id text not null references trainwith.workouts(id),
  position integer not null check(position >= 0),
  primary key(program_id, workout_id),
  unique(program_id, position)
);
create table trainwith.saved_programs (
  user_id uuid not null references trainwith.profiles(id) on delete cascade,
  program_id text not null references trainwith.programs(id) on delete cascade,
  primary key(user_id, program_id)
);
create table trainwith.completions (
  user_id uuid not null references trainwith.profiles(id) on delete cascade,
  workout_id text not null references trainwith.workouts(id),
  completed_at timestamptz not null default now(),
  primary key(user_id, workout_id)
);
create table trainwith.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references trainwith.profiles(id) on delete cascade,
  message text not null check(length(message) between 10 and 5000),
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now()
);
create table trainwith_private.creator_billing (
  creator_id text primary key references trainwith.creators(id),
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false
);
create table trainwith_private.customers (
  user_id uuid primary key references trainwith.profiles(id),
  stripe_customer_id text not null unique
);
create table trainwith_private.subscriptions (
  id text primary key,
  user_id uuid not null references trainwith.profiles(id),
  creator_id text not null references trainwith.creators(id),
  customer_id text not null,
  status text not null,
  price_cents integer not null check(price_cents >= 0),
  currency text not null,
  started_at timestamptz not null,
  period_end timestamptz not null,
  paid_until timestamptz,
  cancel_at_period_end boolean not null default false,
  revoked_invoice_id text,
  last_invoice_id text,
  paid_invoice_id text,
  updated_at timestamptz not null default now()
);
create index subscriptions_member_idx on trainwith_private.subscriptions(user_id,creator_id);
create table trainwith_private.checkout_attempts (
  user_id uuid not null references trainwith.profiles(id),
  creator_id text not null references trainwith.creators(id),
  session_id text,
  url text,
  expires_at timestamptz not null,
  request_key uuid not null default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  primary key(user_id,creator_id)
);
create table trainwith_private.video_assets (
  workout_id text primary key references trainwith.workouts(id),
  upload_id text unique,
  asset_id text unique,
  playback_id text,
  status text not null default 'waiting' check(status in ('waiting','processing','ready','errored')),
  duration_seconds double precision,
  updated_at timestamptz not null default now()
);
create table trainwith_private.events (
  provider text not null check(provider in ('stripe','mux','revenuecat')),
  id text not null,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','done','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  primary key(provider,id)
);
create index events_pending_idx on trainwith_private.events(status,available_at);
create table trainwith_private.ledger (
  id text primary key,
  creator_id text not null references trainwith.creators(id),
  subscription_id text,
  invoice_id text,
  charge_id text,
  kind text not null check(kind in ('payment','refund','dispute')),
  amount_cents integer not null,
  currency text not null,
  provider_fee_cents integer,
  platform_fee_cents integer,
  created_at timestamptz not null default now()
);
create index ledger_charge_idx on trainwith_private.ledger(charge_id);
create table trainwith_private.payouts (
  id text primary key,
  creator_id text not null references trainwith.creators(id),
  amount_cents integer not null,
  currency text not null,
  status text not null,
  arrival_date timestamptz,
  updated_at timestamptz not null default now()
);
create table trainwith_private.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  subject_id text,
  created_at timestamptz not null default now()
);

-- Low-privilege roles can only read rows allowed by policies. All mutations
-- go through the authenticated API, which validates ownership and business rules.
alter table trainwith.profiles enable row level security;
alter table trainwith.creators enable row level security;
alter table trainwith.workouts enable row level security;
alter table trainwith.programs enable row level security;
alter table trainwith.program_workouts enable row level security;
alter table trainwith.saved_programs enable row level security;
alter table trainwith.completions enable row level security;
alter table trainwith.support_requests enable row level security;
create policy profiles_self on trainwith.profiles for select to authenticated using(id=(select auth.uid()));
create policy creators_visible on trainwith.creators for select to anon,authenticated
 using ((published and approved) or owner_id=(select auth.uid()));
create policy workouts_visible on trainwith.workouts for select to anon,authenticated
 using(exists(select 1 from trainwith.creators c where c.id=creator_id and
   (c.owner_id=(select auth.uid()) or (c.published and c.approved and workouts.published))));
create policy programs_visible on trainwith.programs for select to anon,authenticated
 using(exists(select 1 from trainwith.creators c where c.id=creator_id and
   (c.owner_id=(select auth.uid()) or (c.published and c.approved and programs.published))));
create policy program_workouts_visible on trainwith.program_workouts for select to anon,authenticated
 using(exists(select 1 from trainwith.programs p where p.id=program_id));
create policy saved_self on trainwith.saved_programs for select to authenticated using(user_id=(select auth.uid()));
create policy completions_self on trainwith.completions for select to authenticated using(user_id=(select auth.uid()));
create policy support_self on trainwith.support_requests for select to authenticated using(user_id=(select auth.uid()));
revoke all on all tables in schema trainwith from anon,authenticated;
grant select on trainwith.creators,trainwith.workouts,trainwith.programs,trainwith.program_workouts to anon,authenticated;
grant select on trainwith.profiles,trainwith.saved_programs,trainwith.completions,trainwith.support_requests to authenticated;
-- Private records have RLS with no end-user policies as defense in depth.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='trainwith_private' loop
 execute format('alter table trainwith_private.%I enable row level security',t.tablename);
 end loop;
end $$;
revoke all on all tables in schema trainwith_private from public,anon,authenticated;
revoke all on all sequences in schema trainwith_private from public,anon,authenticated;
