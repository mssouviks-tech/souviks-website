-- Souviks RFQ/account security baseline.
--
-- Apply this migration in the Supabase project before treating the
-- browser/database security boundary as production-closed.
--
-- The customer-facing RFQ write path is deliberately exposed through a
-- SECURITY DEFINER function with explicit auth.uid(), input-size and quantity
-- validation. This keeps creation of the RFQ parent and its items atomic.
--
-- Browser permissions:
--   profiles        -> owner-only profile access
--   rfq_cart_items  -> owner-only basket CRUD
--   rfqs            -> owner-only SELECT
--   rfq_items       -> owner-only SELECT through the parent RFQ
--
-- Browser INSERT access to rfqs/rfq_items is intentionally denied.
-- The submit_rfq() function is the only customer-side creation path.

begin;

-- ==========================================================
-- profiles
-- ==========================================================

alter table if exists public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- No DELETE policy: account deletion is an administrative operation.

-- ==========================================================
-- rfq_cart_items
-- ==========================================================

alter table if exists public.rfq_cart_items enable row level security;

drop policy if exists "rfq_cart_items_select_own" on public.rfq_cart_items;
create policy "rfq_cart_items_select_own"
on public.rfq_cart_items
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "rfq_cart_items_insert_own" on public.rfq_cart_items;
create policy "rfq_cart_items_insert_own"
on public.rfq_cart_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "rfq_cart_items_update_own" on public.rfq_cart_items;
create policy "rfq_cart_items_update_own"
on public.rfq_cart_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "rfq_cart_items_delete_own" on public.rfq_cart_items;
create policy "rfq_cart_items_delete_own"
on public.rfq_cart_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
    if to_regclass('public.rfq_cart_items') is not null
       and not exists (
           select 1
           from pg_constraint
           where conname = 'rfq_cart_items_quantity_range'
             and conrelid = 'public.rfq_cart_items'::regclass
       ) then
        execute $sql$
            alter table public.rfq_cart_items
            add constraint rfq_cart_items_quantity_range
            check (quantity between 1 and 9999)
        $sql$;
    end if;
end $$;

-- ==========================================================
-- rfqs
-- ==========================================================

alter table if exists public.rfqs enable row level security;

drop policy if exists "rfqs_select_own" on public.rfqs;
create policy "rfqs_select_own"
on public.rfqs
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Remove legacy direct browser INSERT access. RFQs are now created through
-- submit_rfq(), which validates the caller and writes parent + items atomically.
drop policy if exists "rfqs_insert_own" on public.rfqs;

-- No UPDATE/DELETE policies: customer-side code does not need them.

-- ==========================================================
-- rfq_items
-- ==========================================================

alter table if exists public.rfq_items enable row level security;

drop policy if exists "rfq_items_select_own" on public.rfq_items;
create policy "rfq_items_select_own"
on public.rfq_items
for select
to authenticated
using (
    exists (
        select 1
        from public.rfqs
        where public.rfqs.id = public.rfq_items.rfq_id
          and public.rfqs.user_id = (select auth.uid())
    )
);

-- Remove legacy direct browser INSERT access. Item creation is performed
-- inside submit_rfq() in the same database transaction as the parent RFQ.
drop policy if exists "rfq_items_insert_own" on public.rfq_items;

do $$
begin
    if to_regclass('public.rfq_items') is not null
       and not exists (
           select 1
           from pg_constraint
           where conname = 'rfq_items_quantity_range'
             and conrelid = 'public.rfq_items'::regclass
       ) then
        execute $sql$
            alter table public.rfq_items
            add constraint rfq_items_quantity_range
            check (quantity between 1 and 9999)
        $sql$;
    end if;
end $$;

-- ==========================================================
-- Atomic authenticated RFQ submission
-- ==========================================================

create or replace function public.submit_rfq(
    p_customer_name text,
    p_customer_phone text,
    p_company text default null,
    p_gst_number text default null,
    p_message text default null,
    p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
    v_user_id uuid;
    v_email text;
    v_name text := left(trim(coalesce(p_customer_name, '')), 120);
    v_phone text := left(trim(coalesce(p_customer_phone, '')), 40);
    v_company text := left(trim(coalesce(p_company, '')), 160);
    v_gst text := upper(left(trim(coalesce(p_gst_number, '')), 15));
    v_message text := left(trim(coalesce(p_message, '')), 2000);
    v_is_business boolean;
    v_rfq record;
    v_item jsonb;
    v_product_id text;
    v_part_number text;
    v_product_name text;
    v_brand text;
    v_quantity integer;
    v_seen_ids text[] := array[]::text[];
    v_count integer := 0;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
    if v_email = '' then
        raise exception 'Authenticated account has no email address'
            using errcode = '22023';
    end if;

    if v_name = '' or v_phone = '' then
        raise exception 'Name and phone number are required'
            using errcode = '22023';
    end if;

    if jsonb_typeof(p_items) <> 'array' then
        raise exception 'RFQ items must be a JSON array'
            using errcode = '22023';
    end if;

    if jsonb_array_length(p_items) < 1 then
        raise exception 'RFQ basket is empty'
            using errcode = '22023';
    end if;

    if jsonb_array_length(p_items) > 50 then
        raise exception 'RFQ contains too many items'
            using errcode = '22023';
    end if;

    v_is_business := (v_company <> '' or v_gst <> '');

    insert into public.rfqs (
        user_id,
        customer_name,
        customer_email,
        customer_phone,
        company,
        gst_number,
        is_business,
        message
    )
    values (
        v_user_id,
        v_name,
        v_email,
        v_phone,
        nullif(v_company, ''),
        nullif(v_gst, ''),
        v_is_business,
        nullif(v_message, '')
    )
    returning id, rfq_number
    into v_rfq;

    for v_item in
        select value
        from jsonb_array_elements(p_items)
    loop
        v_product_id := left(trim(coalesce(v_item ->> 'id', '')), 128);
        v_part_number := left(trim(coalesce(v_item ->> 'partNumber', '')), 128);
        v_product_name := left(trim(coalesce(v_item ->> 'name', '')), 300);
        v_brand := left(trim(coalesce(v_item ->> 'brand', '')), 160);

        if v_product_id = '' then
            raise exception 'RFQ item has no product identifier'
                using errcode = '22023';
        end if;

        if v_product_id = any(v_seen_ids) then
            raise exception 'RFQ contains duplicate products'
                using errcode = '23505';
        end if;

        if v_product_name = '' then
            raise exception 'RFQ item has no product name'
                using errcode = '22023';
        end if;

        if coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+$' then
            raise exception 'RFQ item quantity is invalid'
                using errcode = '22023';
        end if;

        v_quantity := (v_item ->> 'quantity')::integer;

        if v_quantity < 1 or v_quantity > 9999 then
            raise exception 'RFQ item quantity is outside the permitted range'
                using errcode = '22023';
        end if;

        insert into public.rfq_items (
            rfq_id,
            product_id,
            part_number,
            product_name,
            brand,
            quantity
        )
        values (
            v_rfq.id,
            v_product_id,
            nullif(v_part_number, ''),
            v_product_name,
            nullif(v_brand, ''),
            v_quantity
        );

        v_seen_ids := array_append(v_seen_ids, v_product_id);
        v_count := v_count + 1;
    end loop;

    return jsonb_build_object(
        'id', v_rfq.id,
        'rfq_number', v_rfq.rfq_number,
        'item_count', v_count
    );
end;
$$;

revoke all on function public.submit_rfq(text, text, text, text, text, jsonb)
from public, anon;

grant execute on function public.submit_rfq(text, text, text, text, text, jsonb)
to authenticated;

commit;
