-- "Mine" price on the Relist list (Oct 23, 2026): starts as his Facebook price, replaced by whatever he types in Edit.
alter table items add column if not exists my_price numeric(10,2);
update items i set my_price = nullif(regexp_replace(q.data->>'price','[^0-9.]','','g'),'')::numeric from fb_import_queue q where q.item_id = i.id and i.my_price is null;
