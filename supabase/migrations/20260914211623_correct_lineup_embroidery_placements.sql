-- Correct only the original preset defaults, preserving later admin choices.
update public.product_templates
set placement='embroidery_front_large'
where slug='dad-hat' and placement='embroidery_front';

update public.product_templates
set placement='embroidery_apparel_front', technique='embroidery'
where slug='tote' and placement='front' and technique='dtg';
