-- Atomically enforce team limits, including simultaneous invite requests.
create function public.attach_invited_user(p_org uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path=public as $$ declare lim integer;begin
 perform 1 from organizations where id=p_org for update;
 if p_role not in ('manager','finance','operator','viewer') or not entitled(p_org) then raise exception 'Convite não autorizado';end if;
 select case plan when 'essencial' then 1 when 'profissional' then 3 else 10 end into lim from subscriptions where org_id=p_org;
 if (select count(*) from memberships where org_id=p_org and active)>=lim then raise exception 'Limite de usuários';end if;
 insert into memberships(org_id,user_id,role) values(p_org,p_user,p_role);
end $$;
revoke execute on function public.attach_invited_user(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.attach_invited_user(uuid,uuid,text) to service_role;
-- Files can accompany support tickets on every paid plan; read/delete remain tenant-isolated.
drop policy tenant_files_insert on storage.objects;
create policy tenant_files_insert on storage.objects for insert to authenticated with check(bucket_id='tenant-files' and public.allowed((storage.foldername(name))[1]::uuid,'product',true));
