-- Authenticated customers can create RFQs only for their own account.
CREATE POLICY "rfqs_insert_own"
ON public.rfqs
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

-- A customer may attach items only to an RFQ owned by that same customer.
CREATE POLICY "rfq_items_insert_own"
ON public.rfq_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.rfqs AS parent_rfq
        WHERE parent_rfq.id = rfq_items.rfq_id
          AND parent_rfq.user_id = (SELECT auth.uid())
    )
);
