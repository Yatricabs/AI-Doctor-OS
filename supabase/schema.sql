create table if not exists patients (
  id text primary key,
  name text not null,
  initials text not null,
  appointment text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  title text not null,
  type text not null,
  date date not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists scribe_notes (
  id text primary key,
  patient_id text references patients(id) on delete set null,
  status text not null,
  subjective text not null,
  objective text not null,
  assessment text not null,
  plan text not null,
  updated_at timestamptz not null default now(),
  disclaimer text
);

create table if not exists insights (
  id text primary key,
  title text not null,
  detail text not null,
  priority text not null,
  status text not null,
  reviewed_at timestamptz
);

create table if not exists profile_settings (
  id integer primary key default 1 check (id = 1),
  full_name text not null,
  specialty text not null,
  clinic_bio text not null,
  urgent_follow_ups boolean not null default true,
  weekly_summary boolean not null default true,
  two_step_sign_in boolean not null default true
);

alter table patients enable row level security;
alter table reports enable row level security;
alter table scribe_notes enable row level security;
alter table insights enable row level security;
alter table profile_settings enable row level security;

-- API routes use the server-only service-role key. Never expose it in NEXT_PUBLIC_* variables.
