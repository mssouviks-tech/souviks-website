-- Reconstructed source for the attribution migration already recorded in the
-- connected Supabase project's migration history as 20261019140604.
-- Idempotent so the same file can bootstrap a fresh project from the earlier
-- Souviks sales_leads migration. This file is intentionally not applied here.

CREATE SCHEMA IF NOT EXISTS internal_analytics;

ALTER TABLE public.sales_leads
    ADD COLUMN IF NOT EXISTS source_channel text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS medium text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS campaign text,
    ADD COLUMN IF NOT EXISTS term text,
    ADD COLUMN IF NOT EXISTS content text,
    ADD COLUMN IF NOT EXISTS referrer_host text,
    ADD COLUMN IF NOT EXISTS landing_page text,
    ADD COLUMN IF NOT EXISTS conversion_page text,
    ADD COLUMN IF NOT EXISTS first_touch_channel text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS first_touch_source text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS first_touch_medium text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS first_touch_campaign text,
    ADD COLUMN IF NOT EXISTS first_touch_term text,
    ADD COLUMN IF NOT EXISTS first_touch_content text,
    ADD COLUMN IF NOT EXISTS first_touch_referrer_host text,
    ADD COLUMN IF NOT EXISTS first_touch_landing_page text,
    ADD COLUMN IF NOT EXISTS last_touch_channel text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS last_touch_source text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS last_touch_medium text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS last_touch_campaign text,
    ADD COLUMN IF NOT EXISTS last_touch_term text,
    ADD COLUMN IF NOT EXISTS last_touch_content text,
    ADD COLUMN IF NOT EXISTS last_touch_referrer_host text,
    ADD COLUMN IF NOT EXISTS last_touch_landing_page text;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.sales_leads'::regclass
          AND conname = 'sales_leads_source_channel_check'
    ) THEN
        ALTER TABLE public.sales_leads
            ADD CONSTRAINT sales_leads_source_channel_check
            CHECK (source_channel = ANY (ARRAY[
                'organic_search','paid_search','paid_social','paid_media',
                'social','referral','email','direct','whatsapp','phone',
                'offline','unknown','other'
            ]));
    END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS sales_leads_channel_status_idx
    ON public.sales_leads (first_touch_channel, status);
CREATE INDEX IF NOT EXISTS sales_leads_last_channel_status_idx
    ON public.sales_leads (last_touch_channel, status);
CREATE INDEX IF NOT EXISTS sales_leads_created_at_idx
    ON public.sales_leads (created_at);

CREATE TABLE IF NOT EXISTS internal_analytics.public_lead_rate_limit_salt (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    salt text NOT NULL
);
INSERT INTO internal_analytics.public_lead_rate_limit_salt (singleton, salt)
VALUES (true, pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS internal_analytics.public_lead_rate_limits (
    ip_hash text NOT NULL,
    window_start timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    PRIMARY KEY (ip_hash, window_start)
);

ALTER TABLE internal_analytics.public_lead_rate_limit_salt ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_analytics.public_lead_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA internal_analytics FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA internal_analytics TO service_role;
REVOKE ALL ON TABLE
    internal_analytics.public_lead_rate_limit_salt,
    internal_analytics.public_lead_rate_limits
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE VIEW internal_analytics.lead_channel_daily AS
SELECT
    (date_trunc('day', created_at))::date AS enquiry_date,
    first_touch_channel,
    last_touch_channel,
    count(*) AS enquiries_received,
    count(*) FILTER (WHERE status = ANY (ARRAY['quoted','accepted','won'])) AS quotations_sent,
    count(*) FILTER (WHERE status = 'won') AS orders_won,
    sum(order_value) FILTER (WHERE status = 'won') AS won_order_value_inr
FROM public.sales_leads
GROUP BY (date_trunc('day', created_at))::date, first_touch_channel, last_touch_channel;

CREATE OR REPLACE VIEW internal_analytics.lead_channel_funnel AS
SELECT
    first_touch_channel,
    first_touch_source,
    first_touch_medium,
    first_touch_campaign,
    last_touch_channel,
    last_touch_source,
    last_touch_medium,
    last_touch_campaign,
    count(*) AS enquiries_received,
    count(*) FILTER (WHERE status = ANY (ARRAY['quoted','accepted','won'])) AS quotations_sent,
    count(*) FILTER (WHERE status = ANY (ARRAY['accepted','won'])) AS quotations_accepted,
    count(*) FILTER (WHERE status = 'won') AS orders_won,
    count(*) FILTER (WHERE status = ANY (ARRAY['lost','unqualified'])) AS leads_lost,
    count(*) FILTER (WHERE status = 'received') AS awaiting_quote,
    sum(order_value) FILTER (WHERE status = 'won') AS won_order_value_inr,
    round(
        (100.0 * count(*) FILTER (WHERE status = 'won')::numeric)
        / nullif(count(*), 0)::numeric,
        2
    ) AS enquiry_to_order_rate_percent
FROM public.sales_leads
GROUP BY
    first_touch_channel, first_touch_source, first_touch_medium, first_touch_campaign,
    last_touch_channel, last_touch_source, last_touch_medium, last_touch_campaign;

REVOKE ALL ON TABLE
    internal_analytics.lead_channel_daily,
    internal_analytics.lead_channel_funnel
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
    internal_analytics.lead_channel_daily,
    internal_analytics.lead_channel_funnel
TO service_role;
