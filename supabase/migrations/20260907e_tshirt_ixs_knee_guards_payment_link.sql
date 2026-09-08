-- Arbox payment link for the IXS Carve 2.0 knee guards, sent by Benny.
-- preorder_active is false for this product, so regular_arbox_link is the
-- one actually used at checkout (see app/api/tshirt-order/route.ts) — both
-- columns are set the same for consistency, same pattern as long_named.
update tshirt_products
set regular_arbox_link = 'https://arbox.link/QxFoE0Rp',
    preorder_arbox_link = 'https://arbox.link/QxFoE0Rp',
    updated_at = now()
where slug = 'ixs_carve_2_knee_guards';
