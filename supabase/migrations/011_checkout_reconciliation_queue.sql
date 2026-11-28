alter table public.checkout_attempts
  add column if not exists reconcile_after timestamptz not null default now();

create index if not exists checkout_attempts_pending_reconcile_idx
  on public.checkout_attempts (reconcile_after, created_at)
  where status = 'pending' and provider_id is not null;
