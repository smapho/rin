-- 稟議書 決裁アプリ用スキーマ
-- Supabaseダッシュボード > SQL Editor に貼り付けて実行してください。

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  file_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'on_hold')),
  comment text default '',
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- 既存テーブルに「保留」ステータスを追加する場合のマイグレーション
-- (テーブルを新規作成した場合は上のcheck制約に含まれているため不要)
alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents add constraint documents_status_check
  check (status in ('pending', 'approved', 'rejected', 'on_hold'));

create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_created_at_idx on public.documents (created_at);

alter table public.documents enable row level security;

-- 社内利用の簡易ツール想定のため、anonキーからの読み書きを許可する。
-- 認証を導入する場合はここを auth.role() = 'authenticated' などに絞ってください。
drop policy if exists "documents_select_anon" on public.documents;
create policy "documents_select_anon" on public.documents
  for select using (true);

drop policy if exists "documents_insert_anon" on public.documents;
create policy "documents_insert_anon" on public.documents
  for insert with check (true);

drop policy if exists "documents_update_anon" on public.documents;
create policy "documents_update_anon" on public.documents
  for update using (true) with check (true);

-- ---------------------------------------------------------------
-- Storage: 画像を入れるバケット (Supabaseダッシュボード > Storage で
-- 同名のバケットを作成するか、下記を実行してください)
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('ringi-images', 'ringi-images', true)
on conflict (id) do nothing;

drop policy if exists "ringi_images_public_read" on storage.objects;
create policy "ringi_images_public_read" on storage.objects
  for select using (bucket_id = 'ringi-images');

drop policy if exists "ringi_images_anon_insert" on storage.objects;
create policy "ringi_images_anon_insert" on storage.objects
  for insert with check (bucket_id = 'ringi-images');
