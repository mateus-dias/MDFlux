-- Execute depois de 001_initial_schema.sql e seed.sql.
-- Cria perfil automaticamente, fortalece permissões e permite administração segura.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles(id,full_name)
select id,coalesce(raw_user_meta_data->>'full_name',split_part(email,'@',1))
from auth.users on conflict(id) do nothing;

-- Catálogo usado pelas permissões individuais. Owners e admins continuam com
-- acesso integral; membros recebem somente as ações explicitamente liberadas.
insert into public.permissions(module_code,resource,action)
select module_code,'*',action
from unnest(array['dashboard','finance','customers','calendar','products','sales','inventory','reports','team','settings']) module_code
cross join unnest(array['view','create','edit','delete','export']) action
on conflict(module_code,resource,action) do nothing;

create or replace function public.can_access_company(target_company uuid, target_module text, target_action text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_global_admin() or exists(
    select 1 from public.company_users cu
    where cu.company_id=target_company and cu.user_id=auth.uid() and cu.status='active'
      and (
        cu.role in ('owner','admin')
        or exists(
          select 1 from public.user_permissions up
          join public.permissions p on p.id=up.permission_id
          where up.company_user_id=cu.id and up.allowed=true
            and p.module_code=target_module and p.action=target_action
        )
      )
  );
$$;

drop policy if exists profiles_self on public.profiles;
create policy profiles_read on public.profiles for select using(id=auth.uid() or public.is_global_admin());
create policy profiles_self_update on public.profiles for update using(id=auth.uid() or public.is_global_admin()) with check(id=auth.uid() or public.is_global_admin());

create policy companies_global_manage on public.companies for all using(public.is_global_admin()) with check(public.is_global_admin());
create policy company_users_global_manage on public.company_users for all using(public.is_global_admin()) with check(public.is_global_admin());
create policy plans_global_manage on public.plans for all using(public.is_global_admin()) with check(public.is_global_admin());
create policy modules_global_manage on public.modules for all using(public.is_global_admin()) with check(public.is_global_admin());
create policy plan_modules_global_manage on public.plan_modules for all using(public.is_global_admin()) with check(public.is_global_admin());
create policy permissions_global_manage on public.permissions for all using(public.is_global_admin()) with check(public.is_global_admin());
create policy user_permissions_global_manage on public.user_permissions for all using(public.is_global_admin()) with check(public.is_global_admin());

-- Substitui as policies amplas da migration inicial por autorização granular.
do $$
declare r record;
begin
  for r in select * from (values
    ('company_modules','settings'),('subscriptions','settings'),('payments','finance'),
    ('customers','customers'),('customer_notes','customers'),
    ('financial_categories','finance'),('payment_methods','finance'),('financial_transactions','finance'),
    ('services','products'),('products','products'),('appointments','calendar'),
    ('sales','sales'),('sale_items','sales'),('inventory_movements','inventory'),
    ('notifications','dashboard'),('audit_logs','settings'),('company_settings','settings')
  ) as x(table_name,module_code)
  loop
    execute format('drop policy if exists %I on public.%I',r.table_name||'_read',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_insert',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_update',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_delete',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_secure_read',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_secure_insert',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_secure_update',r.table_name);
    execute format('drop policy if exists %I on public.%I',r.table_name||'_secure_delete',r.table_name);
    execute format('create policy %I on public.%I for select using (public.can_access_company(company_id,%L,%L))',r.table_name||'_secure_read',r.table_name,r.module_code,'view');
    execute format('create policy %I on public.%I for insert with check (public.can_access_company(company_id,%L,%L) and not public.is_demo_company(company_id))',r.table_name||'_secure_insert',r.table_name,r.module_code,'create');
    execute format('create policy %I on public.%I for update using (public.can_access_company(company_id,%L,%L) and not public.is_demo_company(company_id)) with check (public.can_access_company(company_id,%L,%L) and not public.is_demo_company(company_id))',r.table_name||'_secure_update',r.table_name,r.module_code,'edit',r.module_code,'edit');
    execute format('create policy %I on public.%I for delete using (public.can_access_company(company_id,%L,%L) and not public.is_demo_company(company_id))',r.table_name||'_secure_delete',r.table_name,r.module_code,'delete');
  end loop;
end $$;

create policy company_users_team_insert on public.company_users for insert with check(public.can_access_company(company_id,'team','create'));
create policy company_users_team_update on public.company_users for update using(public.can_access_company(company_id,'team','edit')) with check(public.can_access_company(company_id,'team','edit'));
create policy company_users_team_delete on public.company_users for delete using(public.can_access_company(company_id,'team','delete'));

-- Promova manualmente somente o primeiro administrador, substituindo o e-mail:
-- update public.profiles p set is_global_admin=true
-- from auth.users u where p.id=u.id and lower(u.email)=lower('admin@mdflux.com.br');
