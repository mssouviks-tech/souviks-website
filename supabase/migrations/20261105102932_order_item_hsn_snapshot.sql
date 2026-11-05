-- Preserve the tariff classification snapshot used for each ecommerce order line.
-- The HSN is sourced from the trusted server-side catalogue, never from browser input.
alter table public.order_items
    add column if not exists hsn_code text,
    add column if not exists hsn_description text,
    add column if not exists hsn_classification_status text,
    add column if not exists hsn_confidence text;
