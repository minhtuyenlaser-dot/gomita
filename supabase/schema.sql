create extension if not exists "pgcrypto";

create type public.employee_level as enum (
  'staff',
  'team_lead',
  'department_head',
  'senior_manager',
  'director',
  'admin'
);

create type public.order_step as enum (
  'waiting_acceptance',
  'accepted',
  'design',
  'quote',
  'file_prepare',
  'production',
  'installation',
  'acceptance',
  'completion',
  'archived'
);

create type public.approval_role as enum ('hr', 'department_manager', 'director');
create type public.approval_status as enum ('pending', 'approved', 'rejected');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  employee_code text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id),
  title text not null,
  level public.employee_level not null default 'staff',
  created_at timestamptz not null default now()
);

create table public.profile_positions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  primary key (profile_id, position_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  parent_order_id uuid references public.orders(id),
  code text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_area text not null,
  address text,
  step public.order_step not null default 'waiting_acceptance',
  assigned_sale_id uuid references public.profiles(id),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  deadline_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id),
  work_date date not null,
  slot_time time not null,
  photo_path text,
  photo_taken_at timestamptz,
  is_compensated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, work_date, slot_time)
);

create table public.attendance_compensation_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  slot_times time[] not null,
  reason text not null,
  missing_count_in_month integer not null,
  required_approvals public.approval_role[] not null,
  status public.approval_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.attendance_compensation_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.attendance_compensation_requests(id) on delete cascade,
  approval_role public.approval_role not null,
  approver_id uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  unique (request_id, approval_role)
);

create table public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_by_manager boolean not null default false,
  status public.approval_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  force_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null,
  amount numeric(14, 2) not null,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.kpi_scores (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id),
  speed_score numeric(5, 2) not null default 0,
  progress_score numeric(5, 2) not null default 0,
  return_count integer not null default 0,
  stars integer not null default 0,
  created_at timestamptz not null default now()
);

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.attendance_compensation_requests;
