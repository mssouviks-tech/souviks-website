-- Cashfree checkout storage. Payment/order writes are performed only by the Edge Functions.
-- This is intentionally additive; the existing RFQ tables and workflow are unchanged.

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    order_number text not null unique,
    gateway_order_id text not null unique,
    user_id uuid references auth.users(id) on delete set null,
    customer_name text not null,
    customer_email text,
    customer_phone text not null,
    company text,
    gst_number text,
    shipping_address_line1 text not null,
    shipping_address_line2 text,
    shipping_city text not null,
    shipping_state text not null,
    shipping_postal_code text not null,
    shipping_country text not null default 'IN' check (shipping_country = 'IN'),
    currency text not null default 'INR' check (currency = 'INR'),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    shipping_amount numeric(12, 2) not null default 0 check (shipping_amount >= 0),
    total_amount numeric(12, 2) not null check (total_amount >= 1),
    tax_included boolean not null default false,
    terms_accepted_at timestamptz not null,
    payment_status text not null default 'pending'
        check (payment_status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
    order_status text not null default 'awaiting_payment'
        check (order_status in ('awaiting_payment', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled')),
    cashfree_order_status text,
    cashfree_payment_session_created_at timestamptz,
    cf_payment_id text,
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx
    on public.orders (user_id, created_at desc);
create index if not exists orders_payment_status_idx
    on public.orders (payment_status, created_at desc);

create table if not exists public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id text not null,
    part_number text,
    product_name text not null,
    brand text,
    quantity integer not null check (quantity between 1 and 9999),
    unit_price numeric(12, 2) not null check (unit_price > 0),
    line_total numeric(14, 2) not null check (line_total > 0),
    created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- The raw checkout access token is never stored. A short-lived SHA-256 hash lets
-- the returning browser retrieve status without exposing a service credential.
create table if not exists public.checkout_access_tokens (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    gateway_order_id text not null unique references public.orders(gateway_order_id) on delete cascade,
    token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);
create index if not exists checkout_access_tokens_expiry_idx
    on public.checkout_access_tokens (expires_at);

-- Webhook deliveries are idempotent on Cashfree payment ID + status.
create table if not exists public.cashfree_payment_events (
    id uuid primary key default gen_random_uuid(),
    gateway_order_id text not null references public.orders(gateway_order_id) on delete cascade,
    cf_payment_id text not null,
    payment_status text not null,
    payment_amount numeric(12, 2) not null check (payment_amount >= 0),
    payment_currency text not null default 'INR' check (payment_currency = 'INR'),
    event_source text not null,
    created_at timestamptz not null default now(),
    unique (gateway_order_id, cf_payment_id, payment_status)
);
create index if not exists cashfree_payment_events_order_idx
    on public.cashfree_payment_events (gateway_order_id, created_at desc);

-- The rate limiter uses a one-way IP hash rather than retaining raw IP addresses.
create table if not exists public.cashfree_checkout_rate_limits (
    key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
    window_started_at timestamptz not null,
    request_count integer not null check (request_count >= 1),
    updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.checkout_access_tokens enable row level security;
alter table public.cashfree_payment_events enable row level security;
alter table public.cashfree_checkout_rate_limits enable row level security;

-- Browser clients cannot directly create, edit, inspect, or delete orders, prices,
-- payment sessions, guest access hashes, or payment events.
revoke all on table public.orders from public, anon, authenticated;
revoke all on table public.order_items from public, anon, authenticated;
revoke all on table public.checkout_access_tokens from public, anon, authenticated;
revoke all on table public.cashfree_payment_events from public, anon, authenticated;
revoke all on table public.cashfree_checkout_rate_limits from public, anon, authenticated;

grant select, insert, update, delete on table public.orders to service_role;
grant select, insert, update, delete on table public.order_items to service_role;
grant select, insert, update, delete on table public.checkout_access_tokens to service_role;
grant select, insert, update, delete on table public.cashfree_payment_events to service_role;
grant select, insert, update, delete on table public.cashfree_checkout_rate_limits to service_role;

-- SECURITY INVOKER deliberately keeps the rate-limit routine subject to the calling
-- service_role's table privileges; untrusted roles cannot execute this RPC.
create or replace function public.cashfree_checkout_rate_limit(
    p_key_hash text,
    p_limit integer default 5,
    p_window_seconds integer default 600
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    current_count integer;
begin
    if p_key_hash is null
       or p_key_hash !~ '^[a-f0-9]{64}$'
       or p_limit < 1 or p_limit > 20
       or p_window_seconds < 30 or p_window_seconds > 3600 then
        return false;
    end if;

    insert into public.cashfree_checkout_rate_limits as stored (
        key_hash, window_started_at, request_count, updated_at
    )
    values (p_key_hash, now(), 1, now())
    on conflict (key_hash) do update
    set
        window_started_at = case
            when stored.window_started_at <= now() - (p_window_seconds * interval '1 second')
            then now()
            else stored.window_started_at
        end,
        request_count = case
            when stored.window_started_at <= now() - (p_window_seconds * interval '1 second')
            then 1
            else stored.request_count + 1
        end,
        updated_at = now()
    returning request_count into current_count;

    return current_count <= p_limit;
end;
$$;

revoke all on function public.cashfree_checkout_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.cashfree_checkout_rate_limit(text, integer, integer) to service_role;
