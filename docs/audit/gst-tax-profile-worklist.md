# Souviks GST tax-profile worklist

Generated on 4 November 2026 from the main-branch catalogue.

- Active product records included: 1157
- Additional freight profile: 1
- Total rows: 1158

**This is a blank approval worklist, not an approved rate master.** No HSN/SAC or GST rates have been guessed or prefilled. Online catalogue selling prices are currently treated as GST-inclusive by checkout configuration, so every approved profile must confirm that basis.

For each SKU, the accountant must review the product, applicable HSN/SAC, current rate, unit, inclusive/exclusive value basis, effective dates and documentary source. Explicitly decide whether reverse charge and compensation cess apply. Record who approved each row and when. Use the separate `FREIGHT` profile for delivery charges; do not copy a product rate into it. Profiles are effective-dated: a new GST treatment is added as a new row for the same profile key and later effective date; do not overwrite prior approved history.

The invoice Edge Function accepts only profiles with:
- `approval_status=approved`
- a source reference, approver and approval timestamp
- effective dates covering the invoice date
- a valid HSN/SAC and unit code
- `amount_includes_gst=TRUE`
- explicit Boolean decisions for `reverse_charge_applicable` and `cess_applicable`
- a non-empty approved unit code

Until every order line (and freight, where charged) has an approved profile, the system deliberately refuses to generate a draft invoice. Reverse-charge or cess-applicable orders are also rejected by this first invoice version and require a separate approved invoice implementation. Do not bulk-approve this sheet without product-by-product review.
