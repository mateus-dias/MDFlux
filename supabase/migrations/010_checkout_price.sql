-- Preserve the price agreed in each new checkout while supporting legacy subscriptions.
begin;

alter table public.checkout_attempts
  add column expected_amount numeric(12,2) check (expected_amount > 0);

create or replace function public.confirm_payment(p_id text,p_provider text,p_org uuid,p_plan text,p_status text,p_amount numeric,p_currency text,p_paid_at timestamptz) returns boolean language plpgsql security definer set search_path=public as $$ declare fresh boolean; expected numeric; previous payments; begin
 if p_id is null or p_provider is null or p_org is null or p_plan is null or p_status is null or p_amount is null or p_currency is null or p_paid_at is null then raise exception 'Pagamento incompleto'; end if;
 perform 1 from organizations where id=p_org for update;
 select coalesce(a.expected_amount, case a.plan when 'essencial' then 69.90 when 'profissional' then 99.90 when 'empresarial' then 129.90 end)
 into expected from checkout_attempts a where a.org_id=p_org and a.provider_id=p_provider and a.plan=p_plan;
 if expected is null or p_currency<>'BRL' or p_amount<>expected then raise exception 'Pagamento não corresponde ao checkout'; end if;
 select * into previous from payments where id=p_id for update;
 if previous.id is not null then
  if previous.org_id is distinct from p_org or previous.provider_id is distinct from p_provider or previous.amount is distinct from p_amount or previous.currency is distinct from p_currency then raise exception 'Identidade do pagamento divergente'; end if;
  if previous.status in ('refunded','charged_back') then return false; end if;
  if previous.status='approved' and p_status not in ('refunded','charged_back') then return false; end if;
 end if;
 fresh:=previous.credited_at is null;
 insert into payments(id,org_id,provider_id,status,amount,currency,paid_at) values(p_id,p_org,p_provider,p_status,p_amount,p_currency,p_paid_at) on conflict(id) do update set status=excluded.status;
 if p_status='approved' and fresh then
  update payments set credited_at=now(),paid_at=p_paid_at where id=p_id;
  update subscriptions set plan=p_plan,status='active',provider_id=p_provider,paid_until=greatest(coalesce(paid_until,p_paid_at),p_paid_at)+interval '1 month',updated_at=now() where org_id=p_org;
  update checkout_attempts set status='confirmed' where provider_id=p_provider;
  insert into audit(org_id,action,details) values(p_org,'payment.confirmed',jsonb_build_object('payment',p_id));
  insert into outbox(id,event,org_id,consent,payload) select 'purchase:'||p_id,'Purchase',p_org,coalesce((settings->>'marketing_consent')::boolean,false),jsonb_build_object('value',p_amount,'currency','BRL','plan',p_plan) from organizations where id=p_org on conflict do nothing;
 elsif p_status in ('refunded','charged_back') then
  update subscriptions set status='past_due',paid_until=least(coalesce(paid_until,now()),now()),updated_at=now() where org_id=p_org and provider_id=p_provider;
 elsif p_status='rejected' then
  update subscriptions set status='past_due',updated_at=now() where org_id=p_org and provider_id=p_provider and paid_until<=now();
 end if;return fresh and p_status='approved';end $$;

commit;
