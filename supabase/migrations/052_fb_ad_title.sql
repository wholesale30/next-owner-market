-- What the ad on Facebook says right now (old title and price), so Claude in Chrome can match the old ad before deleting it; the app's own title is the new rewritten one (Oct 23, 2026).
alter table items add column if not exists fb_ad_title text;
alter table items add column if not exists fb_ad_price numeric(10,2);
update items i set fb_ad_title = q.data->>'title', fb_ad_price = nullif(regexp_replace(q.data->>'price','[^0-9.]','','g'),'')::numeric
from fb_import_queue q where q.item_id = i.id and i.fb_ad_title is null;
