-- Preserve current owner-scoped access while avoiding per-row auth function calls.
-- Remove overlapping read policies and an identical duplicate unique index.
BEGIN;

-- These are exact duplicates of the *_select_own policies created by RFQ hardening.
DROP POLICY IF EXISTS "Users can view their own RFQs" ON public.rfqs;
DROP POLICY IF EXISTS "Users can view their own RFQ items" ON public.rfq_items;

-- Customer vehicles: retain the same authenticated-user ownership scope.
DROP POLICY IF EXISTS "Customers can view their vehicles" ON public.customer_vehicles;
CREATE POLICY "Customers can view their vehicles"
  ON public.customer_vehicles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Customers can add their vehicles" ON public.customer_vehicles;
CREATE POLICY "Customers can add their vehicles"
  ON public.customer_vehicles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Customers can update their vehicles" ON public.customer_vehicles;
CREATE POLICY "Customers can update their vehicles"
  ON public.customer_vehicles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Customers can delete their vehicles" ON public.customer_vehicles;
CREATE POLICY "Customers can delete their vehicles"
  ON public.customer_vehicles FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Saved products: retain the same owner checks and use a stable initplan.
DROP POLICY IF EXISTS "Users can view their own saved products" ON public.saved_products;
CREATE POLICY "Users can view their own saved products"
  ON public.saved_products FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can save their own products" ON public.saved_products;
CREATE POLICY "Users can save their own products"
  ON public.saved_products FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can remove their own saved products" ON public.saved_products;
CREATE POLICY "Users can remove their own saved products"
  ON public.saved_products FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Product reviews: combine approved-public and owner-read access into a single
-- policy with exactly the same effective predicate as the two existing policies.
DROP POLICY IF EXISTS "Public can read approved product reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can read their own pending reviews" ON public.product_reviews;
CREATE POLICY "Public can read approved product reviews"
  ON public.product_reviews FOR SELECT TO public
  USING (status = 'approved' OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can submit product reviews" ON public.product_reviews;
CREATE POLICY "Authenticated users can submit product reviews"
  ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'pending');

-- The primary key already enforces uniqueness of rfq_cart_items.id.
ALTER TABLE public.rfq_cart_items
  DROP CONSTRAINT IF EXISTS rfq_cart_items_id_key;

-- Cover the public product_reviews.user_id -> auth.users(id) foreign key.
CREATE INDEX IF NOT EXISTS product_reviews_user_id_idx
  ON public.product_reviews (user_id);

COMMIT;
