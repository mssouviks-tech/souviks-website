-- Record the latest verified Cashfree payment failure without exposing it to browser roles.
alter table public.orders
  add column if not exists payment_failure_code text,
  add column if not exists payment_failure_reason text;

comment on column public.orders.payment_failure_code is 'Latest Cashfree payment failure code from provider reconciliation.';
comment on column public.orders.payment_failure_reason is 'Latest verified Cashfree payment failure message from provider reconciliation.';
