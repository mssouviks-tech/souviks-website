begin;

-- Remove legacy policy names from the original application schema so the
-- authoritative owner-only policy set is unambiguous.
drop policy if exists "Users can create their own RFQs" on public.rfqs;
drop policy if exists "Users can create items for their own RFQs" on public.rfq_items;

drop policy if exists "Enable users to view their own data" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "Users can add to their own RFQ cart" on public.rfq_cart_items;
drop policy if exists "Users can delete their own RFQ cart" on public.rfq_cart_items;
drop policy if exists "Users can update their own RFQ cart" on public.rfq_cart_items;
drop policy if exists "Users can view their own RFQ cart" on public.rfq_cart_items;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

alter function public.handle_new_user() set search_path = public, pg_catalog;
alter function public.update_rfq_cart_items_updated_at() set search_path = public, pg_catalog;
alter function public.set_customer_vehicles_updated_at() set search_path = public, pg_catalog;

commit;
