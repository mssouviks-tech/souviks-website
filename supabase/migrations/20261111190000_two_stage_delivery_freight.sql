-- Two-stage delivery workflow: collect goods payment first, quote packed freight afterwards.
-- Customer access is capability-token based for guest checkout and owner based for signed-in accounts.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS product_paid_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS freight_paid_at timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status = ANY (ARRAY[
    'awaiting_payment'::text,
    'confirmed'::text,
    'freight_pending'::text,
    'freight_quoted'::text,
    'processing'::text,
    'dispatched'::text,
    'delivered'::text,
    'cancelled'::text
  ]));

CREATE TABLE IF NOT EXISTS public.freight_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  quote_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','quoted','payment_pending','paid','expired','cancelled')),
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  chargeable_weight_g integer CHECK (chargeable_weight_g IS NULL OR chargeable_weight_g > 0),
  package_length_cm numeric(8,2) CHECK (package_length_cm IS NULL OR package_length_cm > 0),
  package_width_cm numeric(8,2) CHECK (package_width_cm IS NULL OR package_width_cm > 0),
  package_height_cm numeric(8,2) CHECK (package_height_cm IS NULL OR package_height_cm > 0),
  carrier text,
  service_level text,
  delivery_estimate text,
  quote_notes text,
  quoted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quoted_at timestamptz,
  valid_until timestamptz,
  payment_token_hash text CHECK (payment_token_hash IS NULL OR payment_token_hash ~ '^[a-f0-9]{64}$'),
  payment_token_expires_at timestamptz,
  payment_gateway_order_id text UNIQUE,
  payment_session_id text,
  payment_session_expires_at timestamptz,
  cashfree_order_status text,
  cf_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT freight_quotes_payment_fields CHECK (
    status <> 'paid' OR (payment_gateway_order_id IS NOT NULL AND paid_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS freight_quotes_status_created_idx
  ON public.freight_quotes(status, created_at);

CREATE INDEX IF NOT EXISTS freight_quotes_gateway_order_idx
  ON public.freight_quotes(payment_gateway_order_id)
  WHERE payment_gateway_order_id IS NOT NULL;

ALTER TABLE public.freight_quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.freight_quotes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.freight_quotes TO service_role;

COMMENT ON TABLE public.freight_quotes IS
  'Private post-packing delivery quotations. Customer access is mediated by the freight-quote Edge Function.';
COMMENT ON COLUMN public.orders.product_paid_amount IS
  'Goods amount collected at initial checkout, before delivery freight is quoted.';
COMMENT ON COLUMN public.orders.freight_paid_at IS
  'Timestamp when the separate freight payment was verified with Cashfree.';
