create extension if not exists pgcrypto;

create type public.company_status as enum ('active','suspended','cancelled');
create type public.user_status as enum ('active','inactive','blocked');
create type public.payment_status as enum ('paid','pending','overdue','exempt','cancelled');
create type public.transaction_type as enum ('income','expense');
create type public.record_status as enum ('active','inactive','pending','completed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  is_global_admin boolean not null default false,
  last_access_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.companies (
  id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null,
  document text, logo_path text, primary_color text not null default '#075cf2', secondary_color text not null default '#08c8ee',
  status public.company_status not null default 'active', is_demo boolean not null default false,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.company_users (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'member', job_title text,
  status public.user_status not null default 'active', created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  unique(company_id,user_id)
);
create table public.plans (id uuid primary key default gen_random_uuid(), name text unique not null, price numeric(12,2) not null, user_limit int not null, description text, active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.modules (id uuid primary key default gen_random_uuid(), code text unique not null, name text not null, description text, active boolean default true);
create table public.plan_modules (plan_id uuid references public.plans(id) on delete cascade, module_id uuid references public.modules(id) on delete cascade, primary key(plan_id,module_id));
create table public.company_modules (company_id uuid references public.companies(id) on delete cascade, module_id uuid references public.modules(id) on delete cascade, enabled boolean default true, primary key(company_id,module_id));
create table public.subscriptions (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), plan_id uuid not null references public.plans(id), negotiated_price numeric(12,2), additional_users int default 0, next_due_date date, status public.payment_status default 'pending', notes text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.payments (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), subscription_id uuid references public.subscriptions(id), amount numeric(12,2) not null, payment_method text, paid_at timestamptz, due_date date, status public.payment_status default 'pending', notes text, created_at timestamptz default now());
create table public.permissions (id uuid primary key default gen_random_uuid(), module_code text not null, resource text not null, action text not null check(action in ('view','create','edit','delete','export')), unique(module_code,resource,action));
create table public.user_permissions (company_user_id uuid references public.company_users(id) on delete cascade, permission_id uuid references public.permissions(id) on delete cascade, allowed boolean default false, primary key(company_user_id,permission_id));

create table public.customers (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), name text not null, person_type text check(person_type in ('individual','company')), document text, email text, phone text, whatsapp text, address jsonb default '{}', notes text, status public.record_status default 'active', created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table public.customer_notes (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), customer_id uuid not null references public.customers(id) on delete cascade, note text not null, created_by uuid references auth.users(id), created_at timestamptz default now());
create table public.financial_categories (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), name text not null, type public.transaction_type not null, active boolean default true, created_at timestamptz default now());
create table public.payment_methods (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), name text not null, active boolean default true, created_at timestamptz default now());
create table public.financial_transactions (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), description text not null, category_id uuid references public.financial_categories(id), type public.transaction_type not null, amount numeric(12,2) not null check(amount>=0), transaction_date date not null, due_date date, paid_at timestamptz, customer_id uuid references public.customers(id), status public.payment_status default 'pending', notes text, attachment_path text, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table public.services (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), name text not null, description text, category text, price numeric(12,2) default 0, duration_minutes int, status public.record_status default 'active', created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table public.products (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), name text not null, sku text, code text, category text, description text, sale_price numeric(12,2) default 0, cost numeric(12,2) default 0, stock numeric(14,3) default 0, minimum_stock numeric(14,3) default 0, status public.record_status default 'active', created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now(), unique(company_id,sku));
create table public.appointments (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), title text not null, customer_id uuid references public.customers(id), service_id uuid references public.services(id), starts_at timestamptz not null, duration_minutes int default 60, responsible_user_id uuid references auth.users(id), status public.record_status default 'pending', notes text, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table public.sales (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), customer_id uuid references public.customers(id), subtotal numeric(12,2) default 0, discount numeric(12,2) default 0, total numeric(12,2) default 0, payment_method_id uuid references public.payment_methods(id), status public.record_status default 'pending', sold_at timestamptz default now(), responsible_user_id uuid references auth.users(id), notes text, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table public.sale_items (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), sale_id uuid not null references public.sales(id) on delete cascade, product_id uuid references public.products(id), service_id uuid references public.services(id), description text not null, quantity numeric(12,3) not null check(quantity>0), unit_price numeric(12,2) not null, total numeric(12,2) not null);
create table public.inventory_movements (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), product_id uuid not null references public.products(id), type text not null check(type in ('in','out','adjustment','inventory')), quantity numeric(14,3) not null, reason text, reference_id uuid, created_by uuid references auth.users(id), created_at timestamptz default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), user_id uuid references auth.users(id), type text not null, title text not null, message text, read_at timestamptz, created_at timestamptz default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id), user_id uuid references auth.users(id), action text not null, module text, record_id uuid, ip inet, metadata jsonb default '{}', created_at timestamptz default now());
create table public.company_settings (company_id uuid primary key references public.companies(id) on delete cascade, preferences jsonb default '{}', notification_settings jsonb default '{}', updated_at timestamptz default now());

create index on public.company_users(user_id,company_id); create index on public.customers(company_id,name); create index on public.financial_transactions(company_id,transaction_date); create index on public.products(company_id,name); create index on public.appointments(company_id,starts_at); create index on public.sales(company_id,sold_at); create index on public.audit_logs(company_id,created_at desc);

create or replace function public.is_global_admin() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select is_global_admin from public.profiles where id=auth.uid()),false) $$;
create or replace function public.current_company_ids() returns setof uuid language sql stable security definer set search_path=public as $$ select company_id from public.company_users where user_id=auth.uid() and status='active' $$;
create or replace function public.is_demo_company(target uuid) returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select is_demo from public.companies where id=target),false) $$;

alter table public.profiles enable row level security; alter table public.companies enable row level security; alter table public.company_users enable row level security; alter table public.plans enable row level security; alter table public.modules enable row level security; alter table public.plan_modules enable row level security; alter table public.company_modules enable row level security; alter table public.subscriptions enable row level security; alter table public.payments enable row level security; alter table public.permissions enable row level security; alter table public.user_permissions enable row level security;
alter table public.customers enable row level security; alter table public.customer_notes enable row level security; alter table public.financial_categories enable row level security; alter table public.payment_methods enable row level security; alter table public.financial_transactions enable row level security; alter table public.services enable row level security; alter table public.products enable row level security; alter table public.appointments enable row level security; alter table public.sales enable row level security; alter table public.sale_items enable row level security; alter table public.inventory_movements enable row level security; alter table public.notifications enable row level security; alter table public.audit_logs enable row level security; alter table public.company_settings enable row level security;

create policy profiles_self on public.profiles for select using(id=auth.uid() or public.is_global_admin());
create policy companies_tenant_read on public.companies for select using(id in(select public.current_company_ids()) or public.is_global_admin());
create policy plans_read on public.plans for select to authenticated using(active or public.is_global_admin());
create policy modules_read on public.modules for select to authenticated using(active or public.is_global_admin());
create policy plan_modules_read on public.plan_modules for select to authenticated using(true);
create policy company_users_tenant on public.company_users for select using(company_id in(select public.current_company_ids()) or public.is_global_admin());

do $$ declare t text; begin foreach t in array array['company_modules','subscriptions','payments','customers','customer_notes','financial_categories','payment_methods','financial_transactions','services','products','appointments','sales','sale_items','inventory_movements','notifications','audit_logs','company_settings'] loop
  execute format('create policy %I on public.%I for select using (company_id in (select public.current_company_ids()) or public.is_global_admin())',t||'_read',t);
  execute format('create policy %I on public.%I for insert with check (company_id in (select public.current_company_ids()) and not public.is_demo_company(company_id) or public.is_global_admin())',t||'_insert',t);
  execute format('create policy %I on public.%I for update using (company_id in (select public.current_company_ids()) and not public.is_demo_company(company_id) or public.is_global_admin()) with check (company_id in (select public.current_company_ids()) and not public.is_demo_company(company_id) or public.is_global_admin())',t||'_update',t);
  execute format('create policy %I on public.%I for delete using (company_id in (select public.current_company_ids()) and not public.is_demo_company(company_id) or public.is_global_admin())',t||'_delete',t);
end loop; end $$;

insert into storage.buckets(id,name,public) values('company-files','company-files',false) on conflict(id) do nothing;
create policy company_files_read on storage.objects for select to authenticated using(bucket_id='company-files' and (split_part(name,'/',2))::uuid in(select public.current_company_ids()));
create policy company_files_write on storage.objects for insert to authenticated with check(bucket_id='company-files' and split_part(name,'/',1)='companies' and (split_part(name,'/',2))::uuid in(select public.current_company_ids()) and not public.is_demo_company((split_part(name,'/',2))::uuid));

