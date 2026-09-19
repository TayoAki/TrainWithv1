-- Additive release controls. The previously applied migration stays immutable.
alter table trainwith.profiles add column policy_version text;
alter table trainwith.profiles add column adult_confirmed_at timestamptz;
alter table trainwith.profiles add column age_source text check(age_source in ('self_declared','apple_age_range'));
alter table trainwith.profiles add column account_status text not null default 'active' check(account_status in ('active','suspended','deleting'));
alter table trainwith.workouts add column moderation_status text not null default 'pending' check(moderation_status in ('pending','approved','rejected'));
update trainwith.workouts set published=false;
alter table trainwith.programs add column moderation_status text not null default 'pending' check(moderation_status in ('pending','approved','rejected'));
update trainwith.programs set published=false;

create table trainwith_private.blocks (
 user_id uuid not null references trainwith.profiles(id) on delete cascade,
 creator_id text not null references trainwith.creators(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,creator_id)
);
create table trainwith_private.reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid references trainwith.profiles(id) on delete set null,
 creator_id text references trainwith.creators(id) on delete set null,
 workout_id text references trainwith.workouts(id) on delete set null,
 reason text not null check(reason in ('unsafe','age_inappropriate','harassment','rights','other')),
 details text not null check(length(details) between 10 and 3000),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create table trainwith_private.contact_requests (
 id uuid primary key default gen_random_uuid(),
 email text not null,
 message text not null check(length(message) between 10 and 5000),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now()
);
create table trainwith_private.deletions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique,
 receipt_hash text not null unique,
 status text not null default 'pending' check(status in ('pending','processing','failed','done')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 locked_at timestamptz,
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 last_error text
);
-- Provider identifiers only: ignore late events without recreating deleted data.
create table trainwith_private.erased_subjects (
 kind text not null check(kind in ('user','creator','workout')),
 subject_id text not null,
 created_at timestamptz not null default now(),
 primary key(kind,subject_id)
);
alter table trainwith_private.ledger alter column creator_id drop not null;
alter table trainwith_private.ledger drop constraint ledger_creator_id_fkey;
alter table trainwith_private.ledger add foreign key(creator_id) references trainwith.creators(id) on delete set null;
alter table trainwith_private.payouts alter column creator_id drop not null;
alter table trainwith_private.payouts drop constraint payouts_creator_id_fkey;
alter table trainwith_private.payouts add foreign key(creator_id) references trainwith.creators(id) on delete set null;

do $$ declare t text; begin
 foreach t in array array['blocks','reports','contact_requests','deletions','erased_subjects'] loop
 execute format('alter table trainwith_private.%I enable row level security',t);
 execute format('revoke all on trainwith_private.%I from public,anon,authenticated',t);
 end loop;
end $$;

-- Keep direct catalog reads subject to blocking and moderation as well as the API.
create function trainwith.channel_allowed(owner uuid, channel text) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from trainwith.profiles p where p.id=owner and p.account_status='active')
 and not exists(select 1 from trainwith_private.blocks b where b.user_id=(select auth.uid()) and b.creator_id=channel)
 $$;
revoke all on function trainwith.channel_allowed(uuid,text) from public;
grant execute on function trainwith.channel_allowed(uuid,text) to anon,authenticated;
create policy creators_safety on trainwith.creators as restrictive for select to anon,authenticated using(trainwith.channel_allowed(owner_id,id));
create policy workouts_safety on trainwith.workouts as restrictive for select to anon,authenticated using(
 exists(select 1 from trainwith.creators c where c.id=creator_id and trainwith.channel_allowed(c.owner_id,c.id) and (c.owner_id=(select auth.uid()) or moderation_status='approved'))
);

create policy programs_safety on trainwith.programs as restrictive for select to anon,authenticated using(
 exists(select 1 from trainwith.creators c where c.id=creator_id and trainwith.channel_allowed(c.owner_id,c.id) and (c.owner_id=(select auth.uid()) or moderation_status='approved'))
);
