-- GST invoice issuance: immutable per-order snapshots, financial-year numbering and private PDF storage.
alter table public.orders
  add column if not exists billing_address_line1 text,
  add column if not exists billing_address_line2 text,
  add column if not exists billing_city text,
  add column if not exists billing_state text,
  add column if not exists billing_state_code text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_country text not null default 'IN',
  add column if not exists shipping_state_code text;

alter table public.order_items
  add column if not exists gst_rate_percent numeric(5,2),
  add column if not exists gst_cgst_rate_percent numeric(5,2),
  add column if not exists gst_sgst_rate_percent numeric(5,2),
  add column if not exists gst_igst_rate_percent numeric(5,2),
  add column if not exists gst_rate_effective_from date,
  add column if not exists gst_rate_source_reference text,
  add column if not exists gst_rate_basis text,
  add column if not exists gst_rate_candidate_approved boolean not null default false,
  add column if not exists gst_rate_candidate_status text,
  add column if not exists unit_of_measure text;

create table if not exists public.gst_invoice_sequences (
  financial_year text primary key check (financial_year ~ '^20[0-9]{2}-[0-9]{2}$'),
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.gst_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  invoice_number text not null unique check (char_length(invoice_number) <= 16),
  financial_year text not null check (financial_year ~ '^20[0-9]{2}-[0-9]{2}$'),
  invoice_status text not null default 'generating'
    check (invoice_status in ('generating','issued','failed','voided')),
  snapshot jsonb not null,
  storage_path text,
  pdf_sha256 text check (pdf_sha256 is null or pdf_sha256 ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gst_invoice_issued_fields check (
    invoice_status <> 'issued' or
    (storage_path is not null and pdf_sha256 is not null and issued_at is not null)
  )
);

create index if not exists gst_invoices_status_idx
  on public.gst_invoices(invoice_status, created_at desc);

-- Issued documents are immutable: a correction must be handled through a separate
-- statutory credit/debit note workflow, not by replacing the original invoice.
create or replace function public.guard_issued_gst_invoice_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if old.invoice_status = 'issued' and (
    new.order_id is distinct from old.order_id or
    new.invoice_number is distinct from old.invoice_number or
    new.financial_year is distinct from old.financial_year or
    new.snapshot is distinct from old.snapshot or
    new.storage_path is distinct from old.storage_path or
    new.pdf_sha256 is distinct from old.pdf_sha256 or
    new.issued_at is distinct from old.issued_at or
    new.invoice_status is distinct from old.invoice_status
  ) then
    raise exception 'issued_gst_invoice_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists gst_invoice_immutable_before_update on public.gst_invoices;
create trigger gst_invoice_immutable_before_update
before update on public.gst_invoices
for each row execute function public.guard_issued_gst_invoice_immutable();

alter table public.gst_invoice_sequences enable row level security;
alter table public.gst_invoices enable row level security;
revoke all on table public.gst_invoice_sequences from public, anon, authenticated;
revoke all on table public.gst_invoices from public, anon, authenticated;
grant select, insert, update on table public.gst_invoice_sequences to service_role;
grant select, insert, update on table public.gst_invoices to service_role;

-- The only numbering entry point. It reserves one consecutive number and the exact
-- taxable snapshot atomically, and returns the same reservation on retries.
create or replace function public.reserve_gst_invoice(
  p_order_id uuid,
  p_financial_year text,
  p_snapshot jsonb
)
returns table (
  invoice_id uuid,
  invoice_number text,
  invoice_status text,
  snapshot jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.gst_invoices%rowtype;
  v_next bigint;
begin
  if p_financial_year !~ '^20[0-9]{2}-[0-9]{2}$' then
    raise exception 'invalid_financial_year';
  end if;

  select * into v_existing
  from public.gst_invoices
  where order_id = p_order_id
  for update;

  if found then
    return query
      select v_existing.id, v_existing.invoice_number, v_existing.invoice_status, v_existing.snapshot;
    return;
  end if;

  insert into public.gst_invoice_sequences(financial_year, last_number)
  values (p_financial_year, 0)
  on conflict (financial_year) do nothing;

  update public.gst_invoice_sequences
  set last_number = last_number + 1, updated_at = now()
  where financial_year = p_financial_year
  returning last_number into v_next;

  if v_next > 999999 then
    raise exception 'invoice_sequence_exhausted_for_financial_year';
  end if;

  insert into public.gst_invoices(order_id, invoice_number, financial_year, invoice_status, snapshot)
  values (
    p_order_id,
    'SVK/' || right(p_financial_year, 5) || '/' || lpad(v_next::text, 6, '0'),
    p_financial_year,
    'generating',
    p_snapshot
  )
  returning * into v_existing;

  return query
    select v_existing.id, v_existing.invoice_number, v_existing.invoice_status, v_existing.snapshot;
end;
$$;

revoke all on function public.reserve_gst_invoice(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_gst_invoice(uuid, text, jsonb) to service_role;

-- PDFs are never public; access is mediated by gst-invoice Edge Function ownership checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gst-invoices', 'gst-invoices', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

