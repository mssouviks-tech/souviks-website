-- Anonymous, privacy-minimised contact-intent analytics for the sales funnel.
-- Records link clicks only. They do not claim that a call connected or an email was sent.

ALTER TABLE public.sales_leads
    ADD COLUMN IF NOT EXISTS contact_intent_visitor_id uuid;

CREATE INDEX IF NOT EXISTS sales_leads_contact_intent_visitor_idx
    ON public.sales_leads (contact_intent_visitor_id, created_at DESC)
    WHERE contact_intent_visitor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS internal_analytics.contact_intent_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    visitor_id uuid NOT NULL,
    contact_type text NOT NULL CHECK (contact_type IN ('email', 'phone')),
    page_path text NOT NULL CHECK (page_path LIKE '/%' AND page_path NOT LIKE '//%'),
    source_channel text NOT NULL DEFAULT 'unknown',
    source text NOT NULL DEFAULT 'unknown',
    medium text NOT NULL DEFAULT 'unknown',
    campaign text,
    first_touch_channel text NOT NULL DEFAULT 'unknown',
    first_touch_source text NOT NULL DEFAULT 'unknown',
    first_touch_medium text NOT NULL DEFAULT 'unknown',
    first_touch_campaign text,
    lead_id uuid REFERENCES public.sales_leads(id) ON DELETE SET NULL,
    clicked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE internal_analytics.contact_intent_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE internal_analytics.contact_intent_events FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS contact_intent_events_clicked_at_idx
    ON internal_analytics.contact_intent_events (clicked_at DESC);
CREATE INDEX IF NOT EXISTS contact_intent_events_visitor_clicked_idx
    ON internal_analytics.contact_intent_events (visitor_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS contact_intent_events_lead_clicked_idx
    ON internal_analytics.contact_intent_events (lead_id, clicked_at DESC)
    WHERE lead_id IS NOT NULL;

CREATE OR REPLACE FUNCTION internal_analytics.attach_contact_intent_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
    IF NEW.contact_intent_visitor_id IS NOT NULL THEN
        UPDATE internal_analytics.contact_intent_events AS e
        SET lead_id = NEW.id
        WHERE e.visitor_id = NEW.contact_intent_visitor_id
          AND e.lead_id IS NULL
          AND e.clicked_at <= NEW.created_at
          AND e.clicked_at >= NEW.created_at - interval '90 days';
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION internal_analytics.attach_contact_intent_events() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sales_leads_attach_contact_intents
AFTER INSERT OR UPDATE OF contact_intent_visitor_id
ON public.sales_leads
FOR EACH ROW
EXECUTE FUNCTION internal_analytics.attach_contact_intent_events();

CREATE OR REPLACE FUNCTION public.record_contact_intent(
    p_visitor_id uuid,
    p_contact_type text,
    p_page_path text,
    p_attribution jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    v_contact_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_contact_type, '')));
    v_page_path text := pg_catalog.left(
        pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_page_path, ''), '[[:cntrl:]?#<>]', '', 'g')),
        500
    );
    v_channel text;
    v_first_channel text;
    v_recent_count bigint;
    v_lead_id uuid;
    v_now timestamptz := now();
BEGIN
    IF p_visitor_id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('recorded', false, 'reason', 'missing_visitor_id');
    END IF;

    IF v_contact_type NOT IN ('email', 'phone') THEN
        RETURN pg_catalog.jsonb_build_object('recorded', false, 'reason', 'invalid_contact_type');
    END IF;

    IF v_page_path !~ '^/[A-Za-z0-9._~%/-]*$' OR v_page_path LIKE '//%' THEN
        RETURN pg_catalog.jsonb_build_object('recorded', false, 'reason', 'invalid_page_path');
    END IF;

    SELECT count(*) INTO v_recent_count
    FROM internal_analytics.contact_intent_events AS e
    WHERE e.visitor_id = p_visitor_id
      AND e.clicked_at >= v_now - interval '1 hour';

    IF v_recent_count >= 100 THEN
        RETURN pg_catalog.jsonb_build_object('recorded', false, 'reason', 'rate_limited');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM internal_analytics.contact_intent_events AS e
        WHERE e.visitor_id = p_visitor_id
          AND e.contact_type = v_contact_type
          AND e.page_path = v_page_path
          AND e.clicked_at >= v_now - interval '5 seconds'
    ) THEN
        RETURN pg_catalog.jsonb_build_object('recorded', false, 'duplicate', true);
    END IF;

    v_channel := pg_catalog.lower(pg_catalog.btrim(coalesce(
        p_attribution ->> 'last_touch_channel',
        p_attribution ->> 'source_channel',
        'unknown'
    )));
    IF v_channel NOT IN (
        'organic_search','paid_search','paid_social','paid_media','social',
        'referral','email','direct','whatsapp','phone','offline','unknown','other'
    ) THEN
        v_channel := 'unknown';
    END IF;

    v_first_channel := pg_catalog.lower(pg_catalog.btrim(coalesce(
        p_attribution ->> 'first_touch_channel',
        p_attribution ->> 'source_channel',
        'unknown'
    )));
    IF v_first_channel NOT IN (
        'organic_search','paid_search','paid_social','paid_media','social',
        'referral','email','direct','whatsapp','phone','offline','unknown','other'
    ) THEN
        v_first_channel := v_channel;
    END IF;

    SELECT l.id INTO v_lead_id
    FROM public.sales_leads AS l
    WHERE l.contact_intent_visitor_id = p_visitor_id
      AND l.created_at >= v_now - interval '90 days'
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT 1;

    INSERT INTO internal_analytics.contact_intent_events (
        visitor_id, contact_type, page_path,
        source_channel, source, medium, campaign,
        first_touch_channel, first_touch_source, first_touch_medium, first_touch_campaign,
        lead_id, clicked_at
    ) VALUES (
        p_visitor_id,
        v_contact_type,
        v_page_path,
        v_channel,
        coalesce(NULLIF(pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(coalesce(p_attribution ->> 'last_touch_source', p_attribution ->> 'source', 'unknown'), 'https?://[^[:space:]]+', '', 'gi'), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '', 'gi')), 120), ''), 'unknown'),
        coalesce(NULLIF(pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(coalesce(p_attribution ->> 'last_touch_medium', p_attribution ->> 'medium', 'unknown'), 'https?://[^[:space:]]+', '', 'gi'), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '', 'gi')), 120), ''), 'unknown'),
        NULLIF(pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(coalesce(p_attribution ->> 'last_touch_campaign', p_attribution ->> 'campaign', ''), 'https?://[^[:space:]]+', '', 'gi'), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '', 'gi')), 120), ''),
        v_first_channel,
        coalesce(NULLIF(pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(coalesce(p_attribution ->> 'first_touch_source', 'unknown'), 'https?://[^[:space:]]+', '', 'gi'), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '', 'gi')), 120), ''), 'unknown'),
        coalesce(NULLIF(pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(coalesce(p_attribution ->> 'first_touch_medium', 'unknown'), 'https?://[^[:space:]]+', '', 'gi'), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '', 'gi')), 120), ''), 'unknown'),
        NULLIF(pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(coalesce(p_attribution ->> 'first_touch_campaign', ''), 'https?://[^[:space:]]+', '', 'gi'), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '', 'gi')), 120), ''),
        v_lead_id,
        v_now
    );

    RETURN pg_catalog.jsonb_build_object('recorded', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_contact_intent(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_contact_intent(uuid, text, text, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_contact_intent_summary(
    p_from date DEFAULT NULL,
    p_to date DEFAULT NULL
)
RETURNS TABLE (
    email_clicks bigint,
    phone_clicks bigint,
    unique_visitors bigint,
    linked_leads bigint,
    last_clicked_at timestamptz
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
        count(*) FILTER (WHERE e.contact_type = 'email')::bigint,
        count(*) FILTER (WHERE e.contact_type = 'phone')::bigint,
        count(DISTINCT e.visitor_id)::bigint,
        count(DISTINCT e.lead_id) FILTER (WHERE e.lead_id IS NOT NULL)::bigint,
        max(e.clicked_at)
    FROM internal_analytics.contact_intent_events AS e
    WHERE (p_from IS NULL OR e.clicked_at >= (p_from::timestamp AT TIME ZONE 'Asia/Kolkata'))
      AND (p_to IS NULL OR e.clicked_at < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'));
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_contact_intent_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_contact_intent_summary(date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_list_contact_intents(
    p_from date DEFAULT NULL,
    p_to date DEFAULT NULL,
    p_contact_type text DEFAULT NULL,
    p_limit integer DEFAULT 50
)
RETURNS TABLE (
    event_id bigint,
    contact_type text,
    page_path text,
    source_channel text,
    source text,
    medium text,
    campaign text,
    first_touch_channel text,
    clicked_at timestamptz,
    lead_reference text,
    lead_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
    IF NOT internal_analytics.is_sales_staff() THEN
        RAISE EXCEPTION 'Sales staff access required' USING errcode = '42501';
    END IF;

    IF NULLIF(pg_catalog.btrim(p_contact_type), '') IS NOT NULL
       AND p_contact_type NOT IN ('email', 'phone') THEN
        RAISE EXCEPTION 'Invalid contact type' USING errcode = '22023';
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        e.contact_type,
        e.page_path,
        e.source_channel,
        e.source,
        e.medium,
        e.campaign,
        e.first_touch_channel,
        e.clicked_at,
        l.lead_reference,
        l.status
    FROM internal_analytics.contact_intent_events AS e
    LEFT JOIN public.sales_leads AS l ON l.id = e.lead_id
    WHERE (p_from IS NULL OR e.clicked_at >= (p_from::timestamp AT TIME ZONE 'Asia/Kolkata'))
      AND (p_to IS NULL OR e.clicked_at < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'))
      AND (NULLIF(pg_catalog.btrim(p_contact_type), '') IS NULL OR e.contact_type = p_contact_type)
    ORDER BY e.clicked_at DESC, e.id DESC
    LIMIT greatest(1, least(coalesce(p_limit, 50), 100));
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_list_contact_intents(date, date, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_contact_intents(date, date, text, integer) TO authenticated, service_role;

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
            contact_intent_visitor_id = CASE
                WHEN coalesce(p_attribution ->> 'visitor_id', '') ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                    THEN (p_attribution ->> 'visitor_id')::uuid
                ELSE l.contact_intent_visitor_id
            END,
            updated_at = now()
        WHERE l.lead_reference = pg_catalog.left(pg_catalog.btrim(coalesce(p_lead_reference, '')), 60)
          AND l.lead_type = p_lead_type;
    END IF;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_website_lead_details(text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_website_lead_details(text, text, jsonb, jsonb) TO anon, authenticated, service_role;

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
        contact_intent_visitor_id = CASE
            WHEN coalesce(p_attribution ->> 'visitor_id', '') ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN (p_attribution ->> 'visitor_id')::uuid
            ELSE l.contact_intent_visitor_id
        END,
        updated_at = now()
    WHERE l.rfq_id = v_rfq_id;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_rfq_attributed(text, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rfq_attributed(text, text, text, text, text, jsonb, jsonb) TO authenticated, service_role;
