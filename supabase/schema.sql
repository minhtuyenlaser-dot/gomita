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

create type public.leave_type as enum ('annual', 'unpaid', 'sick', 'half_day');
create type public.payroll_status as enum ('draft', 'locked', 'paid');
create type public.cash_account_type as enum ('cash', 'bank');
create type public.cash_transaction_kind as enum ('receipt', 'payment', 'transfer');
create type public.inventory_unit as enum ('sheet', 'piece', 'm2', 'md', 'kg', 'set');
create type public.payment_stage as enum (
  'deposit',
  'phase_2',
  'before_production',
  'before_installation',
  'acceptance',
  'completion'
);
create type public.document_type as enum ('id_front', 'id_back', 'labor_contract', 'other');

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_type public.document_type not null,
  file_path text not null,
  file_name text,
  uploaded_at timestamptz not null default now()
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  leave_type public.leave_type not null,
  from_date date not null,
  to_date date not null,
  days numeric(5, 2) not null,
  reason text not null,
  status public.approval_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.leave_balances (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  year integer not null,
  annual_days numeric(5, 2) not null default 12,
  carried_days numeric(5, 2) not null default 0,
  used_days numeric(5, 2) not null default 0,
  primary key (profile_id, year)
);

create table public.order_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  step public.order_step not null,
  assigned_by uuid references public.profiles(id),
  assigned_note text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.order_budgets (
  order_id uuid primary key references public.orders(id) on delete cascade,
  quoted_revenue numeric(14, 2) not null default 0,
  budget_material_cost numeric(14, 2) not null default 0,
  budget_labor_cost numeric(14, 2) not null default 0,
  budget_other_cost numeric(14, 2) not null default 0,
  actual_revenue numeric(14, 2) not null default 0,
  actual_material_cost numeric(14, 2) not null default 0,
  actual_labor_cost numeric(14, 2) not null default 0,
  actual_other_cost numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.order_payment_schedules (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stage public.payment_stage not null,
  due_date date,
  amount numeric(14, 2) not null default 0,
  note text,
  unique (order_id, stage)
);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  schedule_id uuid references public.order_payment_schedules(id) on delete set null,
  amount numeric(14, 2) not null,
  paid_at timestamptz not null,
  payment_method text,
  received_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  account_type public.cash_account_type not null,
  bank_name text,
  account_number text,
  opening_balance numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.cash_accounts(id),
  transfer_account_id uuid references public.cash_accounts(id),
  order_id uuid references public.orders(id) on delete set null,
  kind public.cash_transaction_kind not null,
  amount numeric(14, 2) not null,
  transaction_date timestamptz not null,
  category text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  month integer not null check (month between 1 and 12),
  year integer not null,
  status public.payroll_status not null default 'draft',
  locked_at timestamptz,
  locked_by uuid references public.profiles(id),
  unique (month, year)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  working_days numeric(6, 2) not null default 0,
  annual_leave_days numeric(6, 2) not null default 0,
  unpaid_leave_days numeric(6, 2) not null default 0,
  sick_leave_days numeric(6, 2) not null default 0,
  half_day_leave_days numeric(6, 2) not null default 0,
  overtime_hours numeric(8, 2) not null default 0,
  gross_salary numeric(14, 2) not null default 0,
  social_insurance numeric(14, 2) not null default 0,
  health_insurance numeric(14, 2) not null default 0,
  unemployment_insurance numeric(14, 2) not null default 0,
  personal_income_tax numeric(14, 2) not null default 0,
  advance_amount numeric(14, 2) not null default 0,
  bonus_amount numeric(14, 2) not null default 0,
  penalty_amount numeric(14, 2) not null default 0,
  other_deduction_amount numeric(14, 2) not null default 0,
  net_salary numeric(14, 2) not null default 0,
  note text,
  unique (payroll_period_id, profile_id)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text not null,
  unit public.inventory_unit not null,
  standard_cost numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory_balances (
  inventory_item_id uuid primary key references public.inventory_items(id) on delete cascade,
  quantity numeric(14, 3) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  quantity numeric(14, 3) not null,
  unit_cost numeric(14, 2) not null default 0,
  transaction_type text not null,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.material_norms (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  item_scope text not null,
  quantity_per_unit numeric(14, 3) not null,
  unit text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  module text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_leave_requests_profile_status on public.leave_requests(profile_id, status);
create index idx_order_assignments_order_step on public.order_assignments(order_id, step);
create index idx_customer_payments_order on public.customer_payments(order_id, paid_at desc);
create index idx_cash_transactions_account_date on public.cash_transactions(account_id, transaction_date desc);
create index idx_payroll_items_period on public.payroll_items(payroll_period_id);
create index idx_inventory_transactions_item on public.inventory_transactions(inventory_item_id, created_at desc);
create index idx_audit_logs_module_entity on public.audit_logs(module, entity_type, entity_id);

alter publication supabase_realtime add table public.leave_requests;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_assignments;
alter publication supabase_realtime add table public.cash_transactions;
alter publication supabase_realtime add table public.customer_payments;

create table public.app_runtime_state (
  singleton_key text primary key,
  state jsonb not null,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.app_runtime_state (singleton_key, state)
values ('primary', '{}'::jsonb)
on conflict (singleton_key) do nothing;

alter publication supabase_realtime add table public.app_runtime_state;
