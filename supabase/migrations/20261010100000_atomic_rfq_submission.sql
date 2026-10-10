-- Authenticated RFQ creation must insert the parent request and every item
-- in one transaction. This function mirrors the function already deployed to
-- the Souviks Supabase project and keeps that contract reproducible from source.
CREATE OR REPLACE FUNCTION public.submit_rfq(
    p_customer_name text,
    p_customer_phone text,
    p_company text DEFAULT NULL,
    p_gst_number text DEFAULT NULL,
    p_message text DEFAULT NULL,
    p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_user_id uuid;
    v_email text;
    v_name text := left(trim(coalesce(p_customer_name, '')), 120);
    v_phone text := left(trim(coalesce(p_customer_phone, '')), 40);
    v_company text := left(trim(coalesce(p_company, '')), 160);
    v_gst text := upper(left(trim(coalesce(p_gst_number, '')), 15));
    v_message text := left(trim(coalesce(p_message, '')), 2000);
    v_is_business boolean;
    v_rfq record;
    v_item jsonb;
    v_product_id text;
    v_part_number text;
    v_product_name text;
    v_brand text;
    v_quantity integer;
    v_seen_ids text[] := array[]::text[];
    v_count integer := 0;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING errcode = '42501';
    END IF;

    v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
    IF v_email = '' THEN
        RAISE EXCEPTION 'Authenticated account has no email address'
            USING errcode = '22023';
    END IF;

    IF v_name = '' OR v_phone = '' THEN
        RAISE EXCEPTION 'Name and phone number are required'
            USING errcode = '22023';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
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
        FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := left(trim(coalesce(v_item ->> 'id', '')), 128);
        v_part_number := left(trim(coalesce(v_item ->> 'partNumber', '')), 128);
        v_product_name := left(trim(coalesce(v_item ->> 'name', '')), 300);
        v_brand := left(trim(coalesce(v_item ->> 'brand', '')), 160);

        IF v_product_id = '' THEN
            RAISE EXCEPTION 'RFQ item has no product identifier'
                USING errcode = '22023';
        END IF;

        IF v_product_id = ANY(v_seen_ids) THEN
            RAISE EXCEPTION 'RFQ contains duplicate products'
                USING errcode = '23505';
        END IF;

        IF v_product_name = '' THEN
            RAISE EXCEPTION 'RFQ item has no product name'
                USING errcode = '22023';
        END IF;

        IF coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'RFQ item quantity is invalid'
                USING errcode = '22023';
        END IF;

        v_quantity := (v_item ->> 'quantity')::integer;

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

REVOKE ALL ON FUNCTION public.submit_rfq(text, text, text, text, text, jsonb)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rfq(text, text, text, text, text, jsonb)
    TO authenticated, service_role;
