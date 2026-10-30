-- Enforce payment arithmetic and inventory movement at the database boundary.
create function public.validate_record() returns trigger language plpgsql set search_path=public as $$ declare paid_sum numeric; delta numeric; s subscriptions; begin
 if new.kind in ('income','expense') then
  if jsonb_typeof(coalesce(new.data->'settlements','[]'))<>'array' then raise exception 'Baixas inválidas';end if;
  if exists(select 1 from jsonb_array_elements(coalesce(new.data->'settlements','[]')) x where (x->>'amount')::numeric<=0 or nullif(x->>'date','')::date is null) then raise exception 'Baixa inválida';end if;
  select coalesce(sum((x->>'amount')::numeric),0) into paid_sum from jsonb_array_elements(coalesce(new.data->'settlements','[]')) x;
  if round(paid_sum,2)<>new.paid then raise exception 'Total das baixas não corresponde ao valor recebido/pago';end if;
  new.status:=case when new.paid>=new.amount then 'paid' when new.paid>0 then 'partial' else 'pending' end;
 end if;
 if new.kind='product' then
  select * into s from subscriptions where org_id=new.org_id;
  delta:=coalesce((new.data->>'stock_delta')::numeric,0);
  if s.plan='essencial' and (delta<>0 or coalesce(new.data->>'type','service')='material') then raise exception 'Estoque e materiais exigem Profissional ou Empresarial';end if;
  new.data:=new.data||jsonb_build_object('stock',case when tg_op='INSERT' then 0 else coalesce((old.data->>'stock')::numeric,0) end+delta,'stock_delta',0,'movements',(case when tg_op='INSERT' then '[]'::jsonb else coalesce(old.data->'movements','[]') end)||case when delta<>0 then jsonb_build_array(jsonb_build_object('delta',delta,'at',now(),'actor',auth.uid())) else '[]'::jsonb end);
  if (new.data->>'stock')::numeric<0 then raise exception 'Estoque insuficiente';end if;
 end if;
 return new;end $$;
create trigger record_validation before insert or update on public.records for each row execute function public.validate_record();
revoke execute on function public.validate_record() from public,anon,authenticated;
grant execute on function public.validate_record() to service_role;
