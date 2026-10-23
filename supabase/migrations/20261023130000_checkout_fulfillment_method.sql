-- Add a persisted fulfilment method and allow pickup orders without a delivery address.
-- Existing orders remain delivery orders; the change is additive and idempotent.

alter table public.orders
    add column if not exists fulfillment_method text not null default 'delivery';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'orders_fulfillment_method_check'
          and conrelid = 'public.orders'::regclass
    ) then
        alter table public.orders
            add constraint orders_fulfillment_method_check
            check (fulfillment_method in ('delivery', 'pickup'));
    end if;
end
$$;

alter table public.orders alter column shipping_address_line1 drop not null;
alter table public.orders alter column shipping_city drop not null;
alter table public.orders alter column shipping_state drop not null;
alter table public.orders alter column shipping_postal_code drop not null;

comment on column public.orders.fulfillment_method is
    'Customer-selected fulfilment method: delivery or pickup. Pickup orders do not require a delivery address or courier charge.';
