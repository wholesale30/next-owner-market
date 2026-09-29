-- Videos on listings: short uploaded clips (same bucket as photos) or pasted links (YouTube, Facebook, etc.)
create table if not exists item_videos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  kind text not null check (kind in ('upload','link')),
  url text not null,
  storage_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists item_videos_item_idx on item_videos(item_id);
alter table item_videos enable row level security;

create policy "videos read" on item_videos for select
  using (exists (select 1 from items i where i.id = item_id and (i.status in ('active','reserved','sold') or i.owner_id = auth.uid() or is_staff())));
create policy "videos write" on item_videos for all
  using (exists (select 1 from items i where i.id = item_id and (i.owner_id = auth.uid() or is_staff())))
  with check (exists (select 1 from items i where i.id = item_id and (i.owner_id = auth.uid() or is_staff())));

-- allow video mime types and cap file size in the photo bucket (50 MB)
update storage.buckets
  set file_size_limit = 52428800,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm','video/3gpp']
  where id = 'item-photos';
