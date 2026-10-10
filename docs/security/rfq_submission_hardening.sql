-- RFQ submission hardening.
-- Authenticated clients must submit through submit_rfq so ownership and limits
-- are applied atomically by the database. Client code must not write parent
-- RFQs and child items in separate requests.

CREATE OR REPLACE FUNCTION public.submit_rfq(
    p_customer_name text,
    p_customer_phone text,
    p_company text DEFAULT NULL::text,
    p_gst_number text DEFAULT NULL::text,
    p_message text DEFAULT NULL::text,
    p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    v_user_id uuid;
    v_email text;
    v_name text;
    v_phone text;
    v_company text;
    v_gst text;
    v_message text;
    v_is_business boolean;
    v_rfq record;
    v_item jsonb;
    v_product_id text;
    v_part_number text;
    v_product_name text;
    v_brand text;
    v_quantity_text text;
    v_quantity integer;
    v_seen_ids text[] := ARRAY[]::text[];
    v_count integer := 0;
BEGIN
    -- Owner identity always comes from the authenticated JWT, never a client
    -- supplied user_id or RFQ id.
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING errcode = '42501';
    END IF;

    v_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
    IF v_email = '' OR char_length(v_email) > 254 THEN
        RAISE EXCEPTION 'Authenticated account has no valid email address'
            USING errcode = '22023';
    END IF;

    v_name := btrim(coalesce(p_customer_name, ''));
    v_phone := btrim(coalesce(p_customer_phone, ''));
    v_company := btrim(coalesce(p_company, ''));
    v_gst := upper(btrim(coalesce(p_gst_number, '')));
    v_message := btrim(coalesce(p_message, ''));

    IF v_name = '' OR v_phone = '' THEN
        RAISE EXCEPTION 'Name and phone number are required'
            USING errcode = '22023';
    END IF;
    IF char_length(v_name) > 120 THEN
        RAISE EXCEPTION 'Customer name exceeds 120 characters'
            USING errcode = '22023';
    END IF;
    IF char_length(v_phone) > 40 THEN
        RAISE EXCEPTION 'Customer phone exceeds 40 characters'
            USING errcode = '22023';
    END IF;
    IF char_length(v_company) > 160 THEN
        RAISE EXCEPTION 'Company exceeds 160 characters'
            USING errcode = '22023';
    END IF;
    IF char_length(v_gst) > 15 THEN
        RAISE EXCEPTION 'GST number exceeds 15 characters'
            USING errcode = '22023';
    END IF;
    IF char_length(v_message) > 2000 THEN
        RAISE EXCEPTION 'Message exceeds 2000 characters'
            USING errcode = '22023';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'RFQ items must be a JSON array'
            USING errcode = '22023';
    END IF;
    IF jsonb_array_length(p_items) < 1 THEN
        RAISE EXCEPTION 'RFQ basket is empty'
            USING errcode = '22023';
    END IF;
    IF jsonb_array_length(p_items) > 50 THEN
        RAISE EXCEPTION 'RFQ contains too many items'
            USING errcode = '22023';
    END IF;

    v_is_business := (v_company <> '' OR v_gst <> '');

    INSERT INTO public.rfqs (
        user_id,
        customer_name,
        customer_email,
        customer_phone,
        company,
        gst_number,
        is_business,
        message
    )
    VALUES (
        v_user_id,
        v_name,
        v_email,
        v_phone,
        nullif(v_company, ''),
        nullif(v_gst, ''),
        v_is_business,
        nullif(v_message, '')
    )
    RETURNING id, rfq_number
    INTO v_rfq;

    FOR v_item IN
        SELECT value
        FROM pg_catalog.jsonb_array_elements(p_items) AS item_rows(value)
    LOOP
        IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
            RAISE EXCEPTION 'RFQ item must be a JSON object'
                USING errcode = '22023';
        END IF;
        IF jsonb_typeof(v_item -> 'id') IS DISTINCT FROM 'string'
           OR jsonb_typeof(v_item -> 'name') IS DISTINCT FROM 'string'
           OR jsonb_typeof(v_item -> 'partNumber') IS DISTINCT FROM 'string'
           OR jsonb_typeof(v_item -> 'brand') IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION 'RFQ item fields have invalid types'
                USING errcode = '22023';
        END IF;

        v_product_id := btrim(coalesce(v_item ->> 'id', ''));
        v_part_number := btrim(coalesce(v_item ->> 'partNumber', ''));
        v_product_name := btrim(coalesce(v_item ->> 'name', ''));
        v_brand := btrim(coalesce(v_item ->> 'brand', ''));

        IF v_product_id = '' OR v_product_name = '' THEN
            RAISE EXCEPTION 'RFQ item is missing its product identifier or name'
                USING errcode = '22023';
        END IF;
        IF char_length(v_product_id) > 128 THEN
            RAISE EXCEPTION 'Product identifier exceeds 128 characters'
                USING errcode = '22023';
        END IF;
        IF char_length(v_part_number) > 128 THEN
            RAISE EXCEPTION 'Part number exceeds 128 characters'
                USING errcode = '22023';
        END IF;
        IF char_length(v_product_name) > 300 THEN
            RAISE EXCEPTION 'Product name exceeds 300 characters'
                USING errcode = '22023';
        END IF;
        IF char_length(v_brand) > 160 THEN
            RAISE EXCEPTION 'Brand exceeds 160 characters'
                USING errcode = '22023';
        END IF;

        IF v_product_id = ANY(v_seen_ids) THEN
            RAISE EXCEPTION 'RFQ contains duplicate products'
                USING errcode = '23505';
        END IF;

        v_quantity_text := btrim(coalesce(v_item ->> 'quantity', ''));
        IF v_quantity_text !~ '^[0-9]{1,4}$' THEN
            RAISE EXCEPTION 'RFQ item quantity is invalid'
                USING errcode = '22023';
        END IF;

        v_quantity := v_quantity_text::integer;
        IF v_quantity < 1 OR v_quantity > 9999 THEN
            RAISE EXCEPTION 'RFQ item quantity is outside the permitted range'
                USING errcode = '22023';
        END IF;

        INSERT INTO public.rfq_items (
            rfq_id,
            product_id,
            part_number,
            product_name,
            brand,
            quantity
        )
        VALUES (
            v_rfq.id,
            v_product_id,
            nullif(v_part_number, ''),
            v_product_name,
            nullif(v_brand, ''),
            v_quantity
        );

        v_seen_ids := array_append(v_seen_ids, v_product_id);
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'id', v_rfq.id,
        'rfq_number', v_rfq.rfq_number,
        'item_count', v_count
    );
END;
$function$;

-- The browser needs read access to its own RFQs, but all RFQ writes must go
-- through the owner-scoped, transactional RPC. RLS alone does not protect
-- TRUNCATE, so remove broad table grants from the public anon role.
REVOKE ALL PRIVILEGES ON TABLE public.rfqs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON TABLE public.rfqs FROM authenticated;
GRANT SELECT ON TABLE public.rfqs TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.rfq_items FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON TABLE public.rfq_items FROM authenticated;
GRANT SELECT ON TABLE public.rfq_items TO authenticated;

-- Cart writes remain client-side, but anon must not have table privileges and
-- authenticated users do not need the non-DML privileges below.
REVOKE ALL PRIVILEGES ON TABLE public.rfq_cart_items FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
    ON TABLE public.rfq_cart_items FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.rfq_cart_items TO authenticated;

REVOKE ALL ON FUNCTION public.submit_rfq(text, text, text, text, text, jsonb)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rfq(text, text, text, text, text, jsonb)
    TO authenticated;
