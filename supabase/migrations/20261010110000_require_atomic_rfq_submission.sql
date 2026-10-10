-- Authenticated RFQ parents and items are created only through the validated,
-- transactional submit_rfq() SECURITY DEFINER function. Direct INSERT policies
-- would let clients bypass that atomic validation path.
DROP POLICY IF EXISTS "rfqs_insert_own" ON public.rfqs;
DROP POLICY IF EXISTS "rfq_items_insert_own" ON public.rfq_items;
