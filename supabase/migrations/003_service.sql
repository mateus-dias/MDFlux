create function public.rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$ declare r api_limits; begin
 insert into api_limits(key,hits) values(p_key,0) on conflict do nothing;
 select * into r from api_limits where key=p_key for update;
 if r.window_start<now()-make_interval(secs=>p_seconds) then update api_limits set hits=1,window_start=now() where key=p_key; return true; end if;
 if r.hits>=p_limit then return false; end if;
 update api_limits set hits=hits+1 where key=p_key;return true;end $$;
create function public.confirm_payment(p_id text,p_provider text,p_org uuid,p_plan text,p_status text,p_amount numeric,p_currency text,p_paid_at timestamptz) returns boolean language plpgsql security definer set search_path=public as $$ declare fresh boolean; expected numeric; begin
 perform 1 from organizations where id=p_org for update;
 expected:=case p_plan when 'essencial' then 69.90 when 'profissional' then 99.90 when 'empresarial' then 129.90 end;
 if expected is null or p_currency<>'BRL' or p_amount<>expected or not exists(select 1 from checkout_attempts where org_id=p_org and provider_id=p_provider and plan=p_plan) then raise exception 'Pagamento não corresponde ao checkout'; end if;
 select not exists(select 1 from payments where id=p_id and status='approved') into fresh;
 insert into payments(id,org_id,provider_id,status,amount,currency,paid_at) values(p_id,p_org,p_provider,p_status,p_amount,p_currency,p_paid_at) on conflict(id) do update set status=excluded.status;
 if p_status='approved' and fresh then
  update subscriptions set plan=p_plan,status='active',provider_id=p_provider,paid_until=greatest(coalesce(paid_until,p_paid_at),p_paid_at)+interval '1 month',updated_at=now() where org_id=p_org;
  update checkout_attempts set status='confirmed' where provider_id=p_provider;
  insert into audit(org_id,action,details) values(p_org,'payment.confirmed',jsonb_build_object('payment',p_id));
  insert into outbox(id,event,org_id,consent,payload) select 'purchase:'||p_id,'Purchase',p_org,coalesce((settings->>'marketing_consent')::boolean,false),jsonb_build_object('value',p_amount,'currency','BRL','plan',p_plan) from organizations where id=p_org on conflict do nothing;
 elsif p_status in ('refunded','charged_back') then
  update subscriptions set status='past_due',paid_until=least(coalesce(paid_until,now()),now()),updated_at=now() where org_id=p_org and provider_id=p_provider;
 elsif p_status='rejected' then
  update subscriptions set status='past_due',updated_at=now() where org_id=p_org and provider_id=p_provider and paid_until<=now();
 end if;return fresh and p_status='approved';end $$;
create function public.accept_document(p_hash text,p_decision text,p_signer text,p_evidence jsonb) returns void language plpgsql security definer set search_path=public as $$ declare l document_links; begin
 select * into l from document_links where token_hash=p_hash for update;
 if l.id is null or l.revoked or l.expires_at<=now() or not entitled(l.org_id) then raise exception 'Link indisponível'; end if;
 if length(trim(p_signer))<3 or length(p_signer)>200 then raise exception 'Informe seu nome';end if;
 insert into document_acceptances(link_id,decision,signer,digest,evidence) values(l.id,p_decision,p_signer,l.digest,p_evidence);
 update records set status=p_decision,version=version+1,updated_at=now() where id=l.record_id;
 insert into audit(org_id,action,entity_id,details) values(l.org_id,'document.'||p_decision,l.record_id,jsonb_build_object('digest',l.digest,'signer',p_signer));end $$;
-- Eligible trial data only; paid, financial, payment, audit and contract records are retained for review.
create function public.lifecycle() returns jsonb language plpgsql security definer set search_path=public as $$ declare s subscriptions; n integer:=0; begin
 update subscriptions set status='trial_expired',updated_at=now() where status='trialing' and trial_end<=now();
 update subscriptions set status='past_due',updated_at=now() where status='active' and paid_until<=now();
 for s in select * from subscriptions where status='trial_expired' and purge_after<now() and not suspended for update skip locked loop
  if exists(select 1 from payments where org_id=s.org_id) or exists(select 1 from checkout_attempts where org_id=s.org_id and status in ('pending','creating')) then continue;end if;
  update document_links set revoked=true where org_id=s.org_id;
  delete from records where org_id=s.org_id and kind not in ('income','expense','contract') and not exists(select 1 from document_links where record_id=records.id);
  update subscriptions set status='expired',suspended=true where org_id=s.org_id;
  update memberships set active=false where org_id=s.org_id and role<>'owner';
  insert into audit(org_id,action) values(s.org_id,'retention.trial_purged');n:=n+1;
 end loop;
 delete from api_limits where window_start<now()-interval '2 days';return jsonb_build_object('purged',n);end $$;
revoke execute on function public.rate_limit(text,integer,integer),public.confirm_payment(text,text,uuid,text,text,numeric,text,timestamptz),public.accept_document(text,text,text,jsonb),public.lifecycle() from public,anon,authenticated;
grant execute on function public.rate_limit(text,integer,integer),public.confirm_payment(text,text,uuid,text,text,numeric,text,timestamptz),public.accept_document(text,text,text,jsonb),public.lifecycle() to service_role;
