-- Souviks RFQ/account security baseline.
-- Apply this migration in the Supabase project before treating the
-- client-side RFQ boundary as production-closed.
--
-- Scope:
--   profiles        -> owner-only account profile access
--   rfq_cart_items  -> owner-only basket access
--   rfqs            -> owner-only RFQ read/create
--   rfq_items       -> access only through an RFQ owned by the caller
--
-- There are intentionally no public/anon policies on these tables.

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

-- Keep browser-controlled quantities inside an explicit business limit.
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

drop policy if exists "rfqs_insert_own" on public.rfqs;
create policy "rfqs_insert_own"
on public.rfqs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

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

drop policy if exists "rfq_items_insert_own" on public.rfq_items;
create policy "rfq_items_insert_own"
on public.rfq_items
for insert
to authenticated
with check (
    exists (
        select 1
        from public.rfqs
        where public.rfqs.id = public.rfq_items.rfq_id
          and public.rfqs.user_id = (select auth.uid())
    )
);

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

commit;
