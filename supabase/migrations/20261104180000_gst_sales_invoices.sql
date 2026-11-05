-- GST tax profiles and immutable sales-invoice drafts for Souviks.
-- No product tax rates are seeded: invoice creation fails closed until an accountant
-- approves the HSN/SAC, GST rate and inclusive-price treatment for each SKU/profile.

-- Keep recipient billing details separate from the delivery address for B2B/B2C invoices.
alter table public.orders
    add column if not exists billing_same_as_shipping boolean not null default true,
    add column if not exists billing_address_line1 text,
    add column if not exists billing_address_line2 text,
    add column if not exists billing_city text,
    add column if not exists billing_state text,
    add column if not exists billing_postal_code text;

create table if not exists public.gst_tax_profiles (
    profile_id uuid primary key default gen_random_uuid(),
    profile_key text not null,
    hsn_sac_code text not null,
    item_description text,
    unit_code text,
    gst_rate_percent numeric(6,3) not null check (gst_rate_percent >= 0 and gst_rate_percent <= 100),
    amount_includes_gst boolean not null default true,
    reverse_charge_applicable boolean,
    cess_applicable boolean,
    approval_status text not null default 'pending'
        check (approval_status in ('pending', 'approved', 'rejected')),
    source_reference text,
    approved_by text,
    approved_at timestamptz,
    valid_from date not null default current_date,
    valid_to date,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint gst_tax_profiles_key_valid_from_unique unique (profile_key, valid_from),
    constraint gst_tax_profiles_validity_check check (valid_to is null or valid_to >= valid_from),
    constraint gst_tax_profiles_approval_check check (
        approval_status <> 'approved'
        or (
            nullif(trim(source_reference), '') is not null
            and nullif(trim(approved_by), '') is not null
            and approved_at is not null
            and nullif(trim(unit_code), '') is not null
            and reverse_charge_applicable is not null
            and cess_applicable is not null
        )
    )
);

comment on table public.gst_tax_profiles is
    'Accountant-approved HSN/SAC and GST-rate profiles. profile_key is a catalogue product id or the reserved key FREIGHT. No defaults are seeded.';
comment on column public.gst_tax_profiles.amount_includes_gst is
    'Must be true for current Souviks checkout totals; the paid Cashfree total is already fixed and must not be grossed up after payment.';

alter table public.gst_tax_profiles enable row level security;
revoke all on table public.gst_tax_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.gst_tax_profiles to service_role;

create table if not exists public.sales_invoice_sequences (
    financial_year text primary key check (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
    last_number integer not null default 0 check (last_number >= 0),
    updated_at timestamptz not null default now()
);

create table if not exists public.sales_invoices (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null unique references public.orders(id) on delete restrict,
    invoice_number varchar(16) not null unique check (char_length(invoice_number) <= 16),
    financial_year text not null check (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
    invoice_date date not null,
    status text not null default 'draft'
        check (status in ('draft', 'issued', 'void')),
    signature_status text not null default 'pending'
        check (signature_status in ('pending', 'signed')),
    snapshot jsonb not null,
    taxable_total numeric(14,2) not null check (taxable_total >= 0),
    cgst_total numeric(14,2) not null default 0 check (cgst_total >= 0),
    sgst_total numeric(14,2) not null default 0 check (sgst_total >= 0),
    igst_total numeric(14,2) not null default 0 check (igst_total >= 0),
    tax_total numeric(14,2) not null default 0 check (tax_total >= 0),
    invoice_total numeric(14,2) not null check (invoice_total >= 0),
    pdf_storage_path text,
    pdf_sha256 text check (pdf_sha256 is null or pdf_sha256 ~ '^[a-f0-9]{64}$'),
    pdf_generated_at timestamptz,
    issued_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists sales_invoices_created_idx
    on public.sales_invoices (created_at desc);
create index if not exists sales_invoices_fy_idx
    on public.sales_invoices (financial_year, invoice_number);

alter table public.sales_invoice_sequences enable row level security;
alter table public.sales_invoices enable row level security;
revoke all on table public.sales_invoice_sequences from public, anon, authenticated;
revoke all on table public.sales_invoices from public, anon, authenticated;
grant select, insert, update, delete on table public.sales_invoice_sequences to service_role;
grant select, insert, update, delete on table public.sales_invoices to service_role;

-- Private PDF storage. Customer access is granted only through short-lived signed URLs
-- issued by the authenticated/guest-token-checked sales-invoice Edge Function.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sales-invoices-private', 'sales-invoices-private', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.create_sales_invoice_draft(
    p_order_id uuid,
    p_financial_year text,
    p_invoice_date date,
    p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
    v_order public.orders%rowtype;
    v_existing public.sales_invoices%rowtype;
    v_next integer;
    v_fy_short text;
    v_invoice_number text;
    v_invoice_id uuid;
begin
    if coalesce(auth.role(), '') <> 'service_role' then
        raise exception 'Service role required' using errcode = '42501';
    end if;

    if p_order_id is null
       or p_financial_year !~ '^[0-9]{4}-[0-9]{2}$'
       or p_invoice_date is null
       or coalesce(jsonb_typeof(p_snapshot), '') <> 'object'
       or coalesce(jsonb_typeof(p_snapshot -> 'lines'), '') <> 'array'
       or coalesce(jsonb_array_length(p_snapshot -> 'lines'), 0) < 1 then
        raise exception 'Invalid invoice draft payload' using errcode = '22023';
    end if;

    select * into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        raise exception 'Order not found' using errcode = 'P0002';
    end if;
    if v_order.payment_status <> 'paid' then
        raise exception 'Only paid orders can have an invoice draft' using errcode = '22023';
    end if;
    if v_order.tax_included is distinct from true then
        raise exception 'Order price basis is not confirmed GST-inclusive' using errcode = '22023';
    end if;

    select * into v_existing
    from public.sales_invoices
    where order_id = p_order_id;

    if found then
        return jsonb_build_object(
            'invoice_id', v_existing.id,
            'invoice_number', v_existing.invoice_number,
            'status', v_existing.status,
            'signature_status', v_existing.signature_status,
            'snapshot', v_existing.snapshot,
            'pdf_storage_path', v_existing.pdf_storage_path,
            'created', false
        );
    end if;

    insert into public.sales_invoice_sequences (financial_year, last_number, updated_at)
    values (p_financial_year, 1, now())
    on conflict (financial_year) do update
    set last_number = public.sales_invoice_sequences.last_number + 1,
        updated_at = now()
    returning last_number into v_next;

    if v_next > 99999 then
        raise exception 'Invoice number series exhausted for financial year' using errcode = '22023';
    end if;

    v_fy_short := substr(p_financial_year, 3, 2) || '-' || right(p_financial_year, 2);
    v_invoice_number := 'SVKS/' || v_fy_short || '/' || lpad(v_next::text, 5, '0');
    if char_length(v_invoice_number) > 16 then
        raise exception 'Invoice number exceeds GST serial limit' using errcode = '22023';
    end if;

    insert into public.sales_invoices (
        order_id, invoice_number, financial_year, invoice_date,
        status, signature_status, snapshot,
        taxable_total, cgst_total, sgst_total, igst_total, tax_total, invoice_total
    )
    values (
        p_order_id,
        v_invoice_number,
        p_financial_year,
        p_invoice_date,
        'draft',
        'pending',
        p_snapshot,
        coalesce((p_snapshot #>> '{totals,taxable_total}')::numeric, 0),
        coalesce((p_snapshot #>> '{totals,cgst_total}')::numeric, 0),
        coalesce((p_snapshot #>> '{totals,sgst_total}')::numeric, 0),
        coalesce((p_snapshot #>> '{totals,igst_total}')::numeric, 0),
        coalesce((p_snapshot #>> '{totals,tax_total}')::numeric, 0),
        coalesce((p_snapshot #>> '{totals,invoice_total}')::numeric, 0)
    )
    returning id into v_invoice_id;

    return jsonb_build_object(
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'status', 'draft',
        'signature_status', 'pending',
        'snapshot', p_snapshot,
        'pdf_storage_path', null,
        'created', true
    );
end;
$function$;

revoke all on function public.create_sales_invoice_draft(uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.create_sales_invoice_draft(uuid, text, date, jsonb) to service_role;
