BEGIN;

CREATE SCHEMA IF NOT EXISTS internal_analytics;
REVOKE ALL ON SCHEMA internal_analytics FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA internal_analytics TO service_role;

CREATE TABLE IF NOT EXISTS public.sales_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_reference text NOT NULL UNIQUE,
    rfq_id uuid UNIQUE REFERENCES public.rfqs(id) ON DELETE SET NULL,
    lead_type text NOT NULL CHECK (lead_type IN ('rfq', 'rfq_guest', 'request_part', 'contact', 'phone', 'whatsapp', 'email', 'manual')),
    status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'quoted', 'accepted', 'won', 'lost', 'unqualified')),
    source_channel text NOT NULL DEFAULT 'unknown' CHECK (source_channel IN ('organic_search', 'paid_search', 'paid_social', 'paid_media', 'social', 'referral', 'email', 'direct', 'whatsapp', 'phone', 'offline', 'unknown', 'other')),
    source text NOT NULL DEFAULT 'unknown',
    medium text NOT NULL DEFAULT 'unknown',
    campaign text,
    term text,
    content text,
    referrer_host text,
    landing_page text,
    conversion_page text,
    first_touch_channel text NOT NULL DEFAULT 'unknown',
    first_touch_source text NOT NULL DEFAULT 'unknown',
    first_touch_medium text NOT NULL DEFAULT 'unknown',
    first_touch_campaign text,
    first_touch_term text,
    first_touch_content text,
    first_touch_referrer_host text,
    first_touch_landing_page text,
    last_touch_channel text NOT NULL DEFAULT 'unknown',
    last_touch_source text NOT NULL DEFAULT 'unknown',
    last_touch_medium text NOT NULL DEFAULT 'unknown',
    last_touch_campaign text,
    last_touch_term text,
    last_touch_content text,
    last_touch_referrer_host text,
    last_touch_landing_page text,
    quote_sent_at timestamptz,
    accepted_at timestamptz,
    order_won_at timestamptz,
    lost_at timestamptz,
    order_reference text,
    order_value numeric(12,2) CHECK (order_value IS NULL OR order_value >= 0),
    internal_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_leads_created_at_idx ON public.sales_leads (created_at);
CREATE INDEX IF NOT EXISTS sales_leads_channel_status_idx ON public.sales_leads (first_touch_channel, status);
CREATE INDEX IF NOT EXISTS sales_leads_last_channel_status_idx ON public.sales_leads (last_touch_channel, status);

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sales_leads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_leads TO service_role;

CREATE OR REPLACE FUNCTION public.record_website_lead(
    p_lead_reference text,
    p_lead_type text,
    p_attribution jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
    v_reference text := pg_catalog.left(pg_catalog.btrim(coalesce(p_lead_reference, '')), 60);
    v_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_lead_type, '')));
    v_channel text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_attribution ->> 'source_channel', 'unknown')));
    v_rows integer := 0;
BEGIN
    IF v_reference !~ '^(ENQ|RFQ)-[0-9]{10,20}$' THEN
        RETURN pg_catalog.jsonb_build_object('recorded', false, 'reason', 'invalid_reference');
    END IF;

    IF v_type NOT IN ('contact', 'request_part', 'rfq_guest') THEN
        RETURN pg_catalog.jsonb_build_object('recorded', false, 'reason', 'invalid_lead_type');
    END IF;

    IF v_channel NOT IN ('organic_search', 'paid_search', 'paid_social', 'paid_media', 'social', 'referral', 'email', 'direct', 'whatsapp', 'phone', 'offline', 'unknown', 'other') THEN
        v_channel := 'unknown';
    END IF;

    INSERT INTO public.sales_leads (
        lead_reference, lead_type, status,
        source_channel, source, medium, campaign, term, content, referrer_host, landing_page, conversion_page,
        first_touch_channel, first_touch_source, first_touch_medium, first_touch_campaign,
        first_touch_term, first_touch_content, first_touch_referrer_host, first_touch_landing_page,
        last_touch_channel, last_touch_source, last_touch_medium, last_touch_campaign,
        last_touch_term, last_touch_content, last_touch_referrer_host, last_touch_landing_page
    ) VALUES (
        v_reference, v_type, 'received',
        v_channel,
        pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'source', 'unknown')), 120),
        pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'medium', 'unknown')), 120),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'campaign', '')), 120), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'term', '')), 120), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'content', '')), 120), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'referrer_host', '')), 160), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'landing_page', '')), 500), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'conversion_page', '')), 500), ''),
        pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_channel', v_channel)), 40),
        pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_source', 'unknown')), 120),
        pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_medium', 'unknown')), 120),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_campaign', '')), 120), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_term', '')), 120), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_content', '')), 120), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_referrer_host', '')), 160), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_landing_page', '')), 500), ''),
        pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_channel', v_channel)), 40),
        pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_source', 'unknown')), 120),
        pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_medium', 'unknown')), 120),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_campaign', '')), 120), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_term', '')), 120), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_content', '')), 120), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_referrer_host', '')), 160), ''),
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_landing_page', '')), 500), '')
    )
    ON CONFLICT (lead_reference) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN pg_catalog.jsonb_build_object('recorded', v_rows = 1, 'duplicate', v_rows = 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_website_lead(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_website_lead(text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_rfq_sales_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
    v_status text;
    v_reference text := 'RFQ' || pg_catalog.lpad(NEW.rfq_number::text, 6, '0');
BEGIN
    v_status := CASE NEW.status
        WHEN 'quoted' THEN 'quoted'
        WHEN 'accepted' THEN 'accepted'
        WHEN 'rejected' THEN 'lost'
        WHEN 'cancelled' THEN 'lost'
        ELSE 'received'
    END;

    INSERT INTO public.sales_leads (
        lead_reference, rfq_id, lead_type, status, source_channel, source, medium,
        first_touch_channel, first_touch_source, first_touch_medium,
        last_touch_channel, last_touch_source, last_touch_medium,
        quote_sent_at, accepted_at, lost_at, created_at, updated_at
    ) VALUES (
        v_reference, NEW.id, 'rfq', v_status, 'unknown', 'unknown', 'unknown',
        'unknown', 'unknown', 'unknown',
        'unknown', 'unknown', 'unknown',
        CASE WHEN NEW.status = 'quoted' THEN now() ELSE NULL END,
        CASE WHEN NEW.status = 'accepted' THEN now() ELSE NULL END,
        CASE WHEN NEW.status IN ('rejected', 'cancelled') THEN now() ELSE NULL END,
        NEW.created_at, now()
    )
    ON CONFLICT (lead_reference) DO UPDATE SET
        rfq_id = EXCLUDED.rfq_id,
        status = CASE
            WHEN public.sales_leads.status IN ('won', 'unqualified') THEN public.sales_leads.status
            WHEN NEW.status = 'quoted' THEN 'quoted'
            WHEN NEW.status = 'accepted' THEN 'accepted'
            WHEN NEW.status IN ('rejected', 'cancelled') THEN 'lost'
            WHEN public.sales_leads.status IN ('quoted', 'accepted', 'lost') THEN public.sales_leads.status
            ELSE 'received'
        END,
        quote_sent_at = CASE WHEN NEW.status = 'quoted' THEN coalesce(public.sales_leads.quote_sent_at, now()) ELSE public.sales_leads.quote_sent_at END,
        accepted_at = CASE WHEN NEW.status = 'accepted' THEN coalesce(public.sales_leads.accepted_at, now()) ELSE public.sales_leads.accepted_at END,
        lost_at = CASE WHEN NEW.status IN ('rejected', 'cancelled') THEN coalesce(public.sales_leads.lost_at, now()) ELSE public.sales_leads.lost_at END,
        updated_at = now();

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS rfqs_sync_sales_lead ON public.rfqs;
CREATE TRIGGER rfqs_sync_sales_lead
AFTER INSERT OR UPDATE OF status ON public.rfqs
FOR EACH ROW EXECUTE FUNCTION public.sync_rfq_sales_lead();

INSERT INTO public.sales_leads (
    lead_reference, rfq_id, lead_type, status, source_channel, source, medium,
    first_touch_channel, first_touch_source, first_touch_medium,
    last_touch_channel, last_touch_source, last_touch_medium, created_at, updated_at
)
SELECT
    'RFQ' || pg_catalog.lpad(r.rfq_number::text, 6, '0'),
    r.id,
    'rfq',
    CASE r.status
        WHEN 'quoted' THEN 'quoted'
        WHEN 'accepted' THEN 'accepted'
        WHEN 'rejected' THEN 'lost'
        WHEN 'cancelled' THEN 'lost'
        ELSE 'received'
    END,
    'unknown', 'unknown', 'unknown',
    'unknown', 'unknown', 'unknown',
    'unknown', 'unknown', 'unknown',
    r.created_at, now()
FROM public.rfqs AS r
ON CONFLICT (lead_reference) DO NOTHING;

CREATE OR REPLACE FUNCTION public.submit_rfq_attributed(
    p_customer_name text,
    p_customer_phone text,
    p_company text DEFAULT NULL,
    p_gst_number text DEFAULT NULL,
    p_message text DEFAULT NULL,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_attribution jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
    v_result jsonb;
    v_rfq_id uuid;
    v_channel text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
    END IF;

    v_result := public.submit_rfq(
        p_customer_name, p_customer_phone, p_company, p_gst_number, p_message, p_items
    );

    v_rfq_id := (v_result ->> 'id')::uuid;
    v_channel := pg_catalog.lower(pg_catalog.btrim(coalesce(p_attribution ->> 'source_channel', 'unknown')));
    IF v_channel NOT IN ('organic_search', 'paid_search', 'paid_social', 'paid_media', 'social', 'referral', 'email', 'direct', 'whatsapp', 'phone', 'offline', 'unknown', 'other') THEN
        v_channel := 'unknown';
    END IF;

    UPDATE public.sales_leads AS l SET
        source_channel = v_channel,
        source = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'source', 'unknown')), 120),
        medium = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'medium', 'unknown')), 120),
        campaign = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'campaign', '')), 120), ''),
        term = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'term', '')), 120), ''),
        content = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'content', '')), 120), ''),
        referrer_host = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'referrer_host', '')), 160), ''),
        landing_page = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'landing_page', '')), 500), ''),
        conversion_page = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'conversion_page', '')), 500), ''),
        first_touch_channel = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_channel', v_channel)), 40),
        first_touch_source = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_source', 'unknown')), 120),
        first_touch_medium = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_medium', 'unknown')), 120),
        first_touch_campaign = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_campaign', '')), 120), ''),
        first_touch_term = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_term', '')), 120), ''),
        first_touch_content = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_content', '')), 120), ''),
        first_touch_referrer_host = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_referrer_host', '')), 160), ''),
        first_touch_landing_page = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_landing_page', '')), 500), ''),
        last_touch_channel = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_channel', v_channel)), 40),
        last_touch_source = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_source', 'unknown')), 120),
        last_touch_medium = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_medium', 'unknown')), 120),
        last_touch_campaign = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_campaign', '')), 120), ''),
        last_touch_term = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_term', '')), 120), ''),
        last_touch_content = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_content', '')), 120), ''),
        last_touch_referrer_host = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_referrer_host', '')), 160), ''),
        last_touch_landing_page = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_landing_page', '')), 500), ''),
        updated_at = now()
    WHERE l.rfq_id = v_rfq_id;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_rfq_attributed(text, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rfq_attributed(text, text, text, text, text, jsonb, jsonb) TO authenticated;

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
    count(*) FILTER (WHERE status IN ('quoted', 'accepted', 'won')) AS quotations_sent,
    count(*) FILTER (WHERE status IN ('accepted', 'won')) AS quotations_accepted,
    count(*) FILTER (WHERE status = 'won') AS orders_won,
    count(*) FILTER (WHERE status IN ('lost', 'unqualified')) AS leads_lost,
    count(*) FILTER (WHERE status = 'received') AS awaiting_quote,
    sum(order_value) FILTER (WHERE status = 'won') AS won_order_value_inr,
    round(
        100.0 * count(*) FILTER (WHERE status = 'won') / NULLIF(count(*), 0),
        2
    ) AS enquiry_to_order_rate_percent
FROM public.sales_leads
GROUP BY
    first_touch_channel, first_touch_source, first_touch_medium, first_touch_campaign,
    last_touch_channel, last_touch_source, last_touch_medium, last_touch_campaign;

CREATE OR REPLACE VIEW internal_analytics.lead_channel_daily AS
SELECT
    date_trunc('day', created_at)::date AS enquiry_date,
    first_touch_channel,
    last_touch_channel,
    count(*) AS enquiries_received,
    count(*) FILTER (WHERE status IN ('quoted', 'accepted', 'won')) AS quotations_sent,
    count(*) FILTER (WHERE status = 'won') AS orders_won,
    sum(order_value) FILTER (WHERE status = 'won') AS won_order_value_inr
FROM public.sales_leads
GROUP BY date_trunc('day', created_at)::date, first_touch_channel, last_touch_channel;

GRANT SELECT ON internal_analytics.lead_channel_funnel, internal_analytics.lead_channel_daily TO service_role;

COMMIT;
