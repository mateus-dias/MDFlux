create table public.user_activity(user_id uuid primary key references auth.users on delete cascade, last_seen timestamptz not null default now(),active_seconds bigint not null default 0,last_org uuid references public.organizations on delete set null);
alter table public.user_activity enable row level security;
revoke all on public.user_activity from anon,authenticated;
grant all on public.user_activity to service_role;
create function public.heartbeat(p_org uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_member(p_org) then raise exception 'Sem permissão';end if;
 insert into user_activity(user_id,last_org) values(auth.uid(),p_org) on conflict(user_id) do update set active_seconds=user_activity.active_seconds+least(60,greatest(0,extract(epoch from(now()-user_activity.last_seen))::bigint)),last_seen=now(),last_org=p_org;
end $$;
revoke execute on function public.heartbeat(uuid) from public,anon;
grant execute on function public.heartbeat(uuid) to authenticated,service_role;
