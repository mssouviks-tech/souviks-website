-- Staff-managed sales funnel, offline lead capture, and order outcomes.
-- Staff authorization is based only on trusted app_metadata JWT claims, never
-- user-editable user_metadata. No staff claims are assigned by this migration.

ALTER TABLE public.sales_leads
    ADD COLUMN IF NOT EXISTS customer_name text,
    ADD COLUMN IF NOT EXISTS customer_phone text,
    ADD COLUMN IF NOT EXISTS customer_email text,
    ADD COLUMN IF NOT EXISTS company text,
    ADD COLUMN IF NOT EXISTS lead_details text,
    ADD COLUMN IF NOT EXISTS quote_reference text,
    ADD COLUMN IF NOT EXISTS outcome_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS outcome_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS sales_leads_status_created_at_idx
    ON public.sales_leads (status, created_at DESC);

CREATE OR REPLACE FUNCTION internal_analytics.is_sales_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
    SELECT auth.uid() IS NOT NULL
       AND (
          coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'sales', 'owner')
          OR coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb)
                ?| ARRAY['admin', 'sales', 'owner']
       );
$function$;

REVOKE ALL ON FUNCTION internal_analytics.is_sales_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal_analytics.is_sales_staff() TO authenticated;

-- Use the existing rate-limited website-lead RPC, then attach the customer
-- details only when this call created the lead. Duplicate references cannot
-- overwrite an existing enquiry's contact details.
CREATE OR REPLACE FUNCTION public.record_website_lead_details(
    p_lead_reference text,
    p_lead_type text,
    p_attribution jsonb DEFAULT '{}'::jsonb,
    p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    IF coalesce(p_lead_type, '') NOT IN ('contact', 'request_part', 'rfq_guest') THEN
        RETURN pg_catalog.jsonb_build_object('recorded', false, 'reason', 'invalid_lead_type');
    END IF;

    v_result := public.record_website_lead(p_lead_reference, p_lead_type, coalesce(p_attribution, '{}'::jsonb));

    IF v_result ->> 'recorded' = 'true' THEN
        UPDATE public.sales_leads AS l SET
            customer_name = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_details ->> 'customer_name', '')), 120), ''),
            customer_phone = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_details ->> 'customer_phone', '')), 40), ''),
            customer_email = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_details ->> 'customer_email', '')), 254), ''),
            company = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_details ->> 'company', '')), 160), ''),
            lead_details = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_details ->> 'lead_details', '')), 4000), ''),
            updated_at = now()
        WHERE l.lead_reference = pg_catalog.left(pg_catalog.btrim(coalesce(p_lead_reference, '')), 60)
          AND l.lead_type = p_lead_type;
    END IF;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_website_lead_details(text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_website_lead_details(text, text, jsonb, jsonb) TO anon, authenticated, service_role;

-- Preserve the current authenticated atomic RFQ contract while also saving the
-- customer context needed by the staff enquiry-to-order workflow.
CREATE OR REPLACE FUNCTION public.submit_rfq_attributed(
    p_customer_name text,
    p_customer_phone text,
    p_company text DEFAULT NULL::text,
    p_gst_number text DEFAULT NULL::text,
    p_message text DEFAULT NULL::text,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_attribution jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    v_result jsonb;
    v_rfq_id uuid;
    v_channel text;
    v_first_channel text;
    v_last_channel text;
    v_allowed_channels text[] := ARRAY[
        'organic_search','paid_search','paid_social','paid_media','social',
        'referral','email','direct','whatsapp','phone','offline','unknown','other'
    ];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
    END IF;

    v_result := public.submit_rfq(
        p_customer_name, p_customer_phone, p_company, p_gst_number, p_message, p_items
    );
    v_rfq_id := (v_result ->> 'id')::uuid;

    v_channel := pg_catalog.lower(pg_catalog.btrim(coalesce(p_attribution ->> 'source_channel', 'unknown')));
    IF NOT (v_channel = ANY (v_allowed_channels)) THEN v_channel := 'unknown'; END IF;

    v_first_channel := pg_catalog.lower(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_channel', v_channel)));
    IF NOT (v_first_channel = ANY (v_allowed_channels)) THEN v_first_channel := v_channel; END IF;

    v_last_channel := pg_catalog.lower(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_channel', v_channel)));
    IF NOT (v_last_channel = ANY (v_allowed_channels)) THEN v_last_channel := v_channel; END IF;

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
        first_touch_channel = v_first_channel,
        first_touch_source = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_source', 'unknown')), 120),
        first_touch_medium = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_medium', 'unknown')), 120),
        first_touch_campaign = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_campaign', '')), 120), ''),
        first_touch_term = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_term', '')), 120), ''),
        first_touch_content = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_content', '')), 120), ''),
        first_touch_referrer_host = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_referrer_host', '')), 160), ''),
        first_touch_landing_page = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'first_touch_landing_page', '')), 500), ''),
        last_touch_channel = v_last_channel,
        last_touch_source = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_source', 'unknown')), 120),
        last_touch_medium = pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_medium', 'unknown')), 120),
        last_touch_campaign = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_campaign', '')), 120), ''),
        last_touch_term = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_term', '')), 120), ''),
        last_touch_content = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_content', '')), 120), ''),
        last_touch_referrer_host = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_referrer_host', '')), 160), ''),
        last_touch_landing_page = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_attribution ->> 'last_touch_landing_page', '')), 500), ''),
        customer_name = pg_catalog.left(pg_catalog.btrim(coalesce(p_customer_name, '')), 120),
        customer_phone = pg_catalog.left(pg_catalog.btrim(coalesce(p_customer_phone, '')), 40),
        customer_email = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(auth.jwt() ->> 'email', '')), 254), ''),
        company = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_company, '')), 160), ''),
        lead_details = NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_message, '')), 4000), ''),
        updated_at = now()
    WHERE l.rfq_id = v_rfq_id;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_rfq_attributed(text, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rfq_attributed(text, text, text, text, text, jsonb, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_list_sales_leads(
    p_limit integer DEFAULT 100,
    p_offset integer DEFAULT 0,
    p_status text DEFAULT NULL,
    p_channel text DEFAULT NULL,
    p_query text DEFAULT NULL,
    p_from date DEFAULT NULL,
    p_to date DEFAULT NULL
)
RETURNS TABLE (
    lead_id uuid,
    lead_reference text,
    lead_type text,
    status text,
    source_channel text,
    source text,
    medium text,
    campaign text,
    first_touch_channel text,
    first_touch_source text,
    first_touch_medium text,
    first_touch_campaign text,
    last_touch_channel text,
    last_touch_source text,
    last_touch_medium text,
    last_touch_campaign text,
    customer_name text,
    customer_phone text,
    customer_email text,
    company text,
    lead_details text,
    quote_reference text,
    quote_sent_at timestamptz,
    accepted_at timestamptz,
    order_reference text,
    order_value numeric,
    order_won_at timestamptz,
    internal_note text,
    outcome_updated_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
    IF NOT internal_analytics.is_sales_staff() THEN
        RAISE EXCEPTION 'Sales staff access required' USING errcode = '42501';
    END IF;

    RETURN QUERY
    SELECT
        l.id,
        l.lead_reference,
        l.lead_type,
        l.status,
        l.source_channel,
        l.source,
        l.medium,
        l.campaign,
        l.first_touch_channel,
        l.first_touch_source,
        l.first_touch_medium,
        l.first_touch_campaign,
        l.last_touch_channel,
        l.last_touch_source,
        l.last_touch_medium,
        l.last_touch_campaign,
        coalesce(l.customer_name, r.customer_name),
        coalesce(l.customer_phone, r.customer_phone),
        coalesce(l.customer_email, r.customer_email),
        coalesce(l.company, r.company),
        coalesce(l.lead_details, r.message),
        l.quote_reference,
        l.quote_sent_at,
        l.accepted_at,
        l.order_reference,
        l.order_value,
        l.order_won_at,
        l.internal_note,
        l.outcome_updated_at,
        l.created_at,
        l.updated_at
    FROM public.sales_leads AS l
    LEFT JOIN public.rfqs AS r ON r.id = l.rfq_id
    WHERE (NULLIF(pg_catalog.btrim(p_status), '') IS NULL OR l.status = p_status)
      AND (NULLIF(pg_catalog.btrim(p_channel), '') IS NULL OR l.first_touch_channel = p_channel OR l.last_touch_channel = p_channel)
      AND (
          NULLIF(pg_catalog.btrim(p_query), '') IS NULL
          OR l.lead_reference ILIKE '%' || pg_catalog.left(p_query, 100) || '%'
          OR coalesce(l.customer_name, r.customer_name, '') ILIKE '%' || pg_catalog.left(p_query, 100) || '%'
          OR coalesce(l.customer_phone, r.customer_phone, '') ILIKE '%' || pg_catalog.left(p_query, 100) || '%'
          OR coalesce(l.company, r.company, '') ILIKE '%' || pg_catalog.left(p_query, 100) || '%'
          OR coalesce(l.order_reference, '') ILIKE '%' || pg_catalog.left(p_query, 100) || '%'
      )
      AND (p_from IS NULL OR l.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Kolkata'))
      AND (p_to IS NULL OR l.created_at < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'))
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT greatest(1, least(coalesce(p_limit, 100), 250))
    OFFSET greatest(0, least(coalesce(p_offset, 0), 100000));
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_channel_funnel_report(
    p_from date DEFAULT NULL,
    p_to date DEFAULT NULL
)
RETURNS TABLE (
    first_touch_channel text,
    first_touch_source text,
    first_touch_medium text,
    first_touch_campaign text,
    last_touch_channel text,
    enquiries_received bigint,
    quotations_sent bigint,
    quotations_accepted bigint,
    orders_won bigint,
    leads_lost bigint,
    awaiting_quote bigint,
    won_order_value_inr numeric,
    enquiry_to_order_rate_percent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
    IF NOT internal_analytics.is_sales_staff() THEN
        RAISE EXCEPTION 'Sales staff access required' USING errcode = '42501';
    END IF;

    RETURN QUERY
    SELECT
        l.first_touch_channel,
        l.first_touch_source,
        l.first_touch_medium,
        l.first_touch_campaign,
        l.last_touch_channel,
        count(*)::bigint,
        count(*) FILTER (WHERE l.quote_sent_at IS NOT NULL)::bigint,
        count(*) FILTER (WHERE l.accepted_at IS NOT NULL)::bigint,
        count(*) FILTER (WHERE l.status = 'won' OR l.order_won_at IS NOT NULL)::bigint,
        count(*) FILTER (WHERE l.status IN ('lost', 'unqualified'))::bigint,
        count(*) FILTER (WHERE l.status = 'received' AND l.quote_sent_at IS NULL)::bigint,
        coalesce(sum(l.order_value) FILTER (WHERE l.status = 'won' OR l.order_won_at IS NOT NULL), 0)::numeric,
        round(
            100.0 * count(*) FILTER (WHERE l.status = 'won' OR l.order_won_at IS NOT NULL)::numeric / nullif(count(*), 0)::numeric,
            2
        )::numeric
    FROM public.sales_leads AS l
    WHERE (p_from IS NULL OR l.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Kolkata'))
      AND (p_to IS NULL OR l.created_at < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'))
    GROUP BY l.first_touch_channel, l.first_touch_source, l.first_touch_medium,
             l.first_touch_campaign, l.last_touch_channel
    ORDER BY count(*) DESC, l.first_touch_channel ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_create_manual_lead(
    p_lead_type text,
    p_source_channel text,
    p_customer_name text,
    p_customer_phone text,
    p_customer_email text DEFAULT NULL,
    p_company text DEFAULT NULL,
    p_lead_details text DEFAULT NULL,
    p_source text DEFAULT NULL,
    p_medium text DEFAULT 'offline',
    p_campaign text DEFAULT NULL,
    p_internal_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    v_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_lead_type, '')));
    v_channel text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_source_channel, '')));
    v_reference text := 'ENQ-MANUAL-' || pg_catalog.left(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 16);
    v_id uuid;
    v_name text := NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_customer_name, '')), 120), '');
    v_phone text := NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_customer_phone, '')), 40), '');
    v_email text := NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_customer_email, '')), 254), '');
    v_company text := NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_company, '')), 160), '');
    v_details text := NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_lead_details, '')), 4000), '');
    v_source text := pg_catalog.left(pg_catalog.btrim(coalesce(NULLIF(p_source, ''), v_channel)), 120);
    v_medium text := pg_catalog.left(pg_catalog.btrim(coalesce(NULLIF(p_medium, ''), 'offline')), 120);
    v_campaign text := NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_campaign, '')), 120), '');
BEGIN
    IF NOT internal_analytics.is_sales_staff() THEN
        RAISE EXCEPTION 'Sales staff access required' USING errcode = '42501';
    END IF;

    IF v_type NOT IN ('phone', 'whatsapp', 'email', 'manual') THEN
        RAISE EXCEPTION 'Unsupported manual lead type' USING errcode = '22023';
    END IF;
    IF v_channel NOT IN (
        'organic_search','paid_search','paid_social','paid_media','social',
        'referral','email','direct','whatsapp','phone','offline','unknown','other'
    ) THEN
        RAISE EXCEPTION 'Unsupported source channel' USING errcode = '22023';
    END IF;
    IF v_type IN ('phone', 'whatsapp', 'email') AND v_type <> v_channel THEN
        RAISE EXCEPTION 'Lead type must match the selected channel' USING errcode = '22023';
    END IF;
    IF v_name IS NULL AND v_phone IS NULL AND v_email IS NULL THEN
        RAISE EXCEPTION 'Enter at least a customer name, phone, or email' USING errcode = '22023';
    END IF;

    INSERT INTO public.sales_leads (
        lead_reference, lead_type, status,
        source_channel, source, medium, campaign,
        first_touch_channel, first_touch_source, first_touch_medium, first_touch_campaign,
        last_touch_channel, last_touch_source, last_touch_medium, last_touch_campaign,
        customer_name, customer_phone, customer_email, company, lead_details,
        internal_note, outcome_updated_by, outcome_updated_at, created_at, updated_at
    ) VALUES (
        v_reference, v_type, 'received',
        v_channel, v_source, v_medium, v_campaign,
        v_channel, v_source, v_medium, v_campaign,
        v_channel, v_source, v_medium, v_campaign,
        v_name, v_phone, v_email, v_company, v_details,
        NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_internal_note, '')), 4000), ''),
        auth.uid(), now(), now(), now()
    )
    RETURNING id INTO v_id;

    RETURN pg_catalog.jsonb_build_object(
        'created', true,
        'id', v_id,
        'lead_reference', v_reference
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_update_sales_lead(
    p_lead_id uuid,
    p_status text,
    p_quote_reference text DEFAULT NULL,
    p_order_reference text DEFAULT NULL,
    p_order_value numeric DEFAULT NULL,
    p_internal_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    v_status text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_status, '')));
    v_reference text;
    v_current_status text;
    v_current_order_reference text;
    v_current_order_value numeric;
BEGIN
    IF NOT internal_analytics.is_sales_staff() THEN
        RAISE EXCEPTION 'Sales staff access required' USING errcode = '42501';
    END IF;

    IF v_status NOT IN ('received', 'quoted', 'accepted', 'won', 'lost', 'unqualified') THEN
        RAISE EXCEPTION 'Unsupported lead outcome' USING errcode = '22023';
    END IF;
    IF p_order_value IS NOT NULL AND p_order_value < 0 THEN
        RAISE EXCEPTION 'Order value cannot be negative' USING errcode = '22023';
    END IF;

    SELECT l.status, l.lead_reference, l.order_reference, l.order_value
      INTO v_current_status, v_reference, v_current_order_reference, v_current_order_value
    FROM public.sales_leads AS l
    WHERE l.id = p_lead_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found' USING errcode = 'P0002';
    END IF;
    IF v_current_status = 'won' AND v_status <> 'won' THEN
        RAISE EXCEPTION 'Won orders cannot be reverted from the dashboard' USING errcode = '22023';
    END IF;
    IF v_status = 'won' AND (
        coalesce(NULLIF(pg_catalog.btrim(p_order_reference), ''), v_current_order_reference) IS NULL
        OR coalesce(p_order_value, v_current_order_value) IS NULL
    ) THEN
        RAISE EXCEPTION 'Won orders require an order reference and order value' USING errcode = '22023';
    END IF;

    UPDATE public.sales_leads AS l SET
        status = v_status,
        quote_reference = coalesce(NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_quote_reference, '')), 120), ''), l.quote_reference),
        quote_sent_at = CASE
            WHEN v_status IN ('quoted', 'accepted', 'won') THEN coalesce(l.quote_sent_at, now())
            ELSE l.quote_sent_at
        END,
        accepted_at = CASE
            WHEN v_status IN ('accepted', 'won') THEN coalesce(l.accepted_at, now())
            ELSE l.accepted_at
        END,
        lost_at = CASE
            WHEN v_status IN ('lost', 'unqualified') THEN coalesce(l.lost_at, now())
            ELSE NULL
        END,
        order_reference = CASE
            WHEN v_status = 'won' THEN coalesce(NULLIF(pg_catalog.left(pg_catalog.btrim(coalesce(p_order_reference, '')), 120), ''), l.order_reference)
            ELSE l.order_reference
        END,
        order_value = CASE
            WHEN v_status = 'won' THEN coalesce(p_order_value, l.order_value)
            ELSE l.order_value
        END,
        order_won_at = CASE
            WHEN v_status = 'won' THEN coalesce(l.order_won_at, now())
            ELSE l.order_won_at
        END,
        internal_note = CASE
            WHEN p_internal_note IS NULL THEN l.internal_note
            ELSE NULLIF(pg_catalog.left(pg_catalog.btrim(p_internal_note), 4000), '')
        END,
        outcome_updated_by = auth.uid(),
        outcome_updated_at = now(),
        updated_at = now()
    WHERE l.id = p_lead_id;

    RETURN pg_catalog.jsonb_build_object(
        'updated', true,
        'id', p_lead_id,
        'lead_reference', v_reference,
        'status', v_status
    );
END;
$function$;

-- Keep the private reporting views aligned with milestone history rather than
-- losing earlier quote/acceptance stages when a lead's current status changes.
CREATE OR REPLACE VIEW internal_analytics.lead_channel_daily AS
SELECT
    (date_trunc('day', created_at))::date AS enquiry_date,
    first_touch_channel,
    last_touch_channel,
    count(*) AS enquiries_received,
    count(*) FILTER (WHERE quote_sent_at IS NOT NULL) AS quotations_sent,
    count(*) FILTER (WHERE status = 'won' OR order_won_at IS NOT NULL) AS orders_won,
    sum(order_value) FILTER (WHERE status = 'won' OR order_won_at IS NOT NULL) AS won_order_value_inr
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
    count(*) FILTER (WHERE quote_sent_at IS NOT NULL) AS quotations_sent,
    count(*) FILTER (WHERE accepted_at IS NOT NULL) AS quotations_accepted,
    count(*) FILTER (WHERE status = 'won' OR order_won_at IS NOT NULL) AS orders_won,
    count(*) FILTER (WHERE status = ANY (ARRAY['lost','unqualified'])) AS leads_lost,
    count(*) FILTER (WHERE status = 'received' AND quote_sent_at IS NULL) AS awaiting_quote,
    sum(order_value) FILTER (WHERE status = 'won' OR order_won_at IS NOT NULL) AS won_order_value_inr,
    round(
        (100.0 * count(*) FILTER (WHERE status = 'won' OR order_won_at IS NOT NULL)::numeric)
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

REVOKE ALL ON FUNCTION public.staff_list_sales_leads(integer, integer, text, text, text, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_channel_funnel_report(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_create_manual_lead(text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_update_sales_lead(uuid, text, text, text, numeric, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.staff_list_sales_leads(integer, integer, text, text, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_channel_funnel_report(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_create_manual_lead(text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_update_sales_lead(uuid, text, text, text, numeric, text) TO authenticated;
