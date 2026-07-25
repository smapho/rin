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

drop policy if exists "documents_delete_anon" on public.documents;
create policy "documents_delete_anon" on public.documents
  for delete using (true);

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

drop policy if exists "ringi_images_anon_delete" on storage.objects;
create policy "ringi_images_anon_delete" on storage.objects
  for delete using (bucket_id = 'ringi-images');

-- ---------------------------------------------------------------
-- 決裁者用パスコード
-- 一覧画面での「決裁/否決/保留」変更は、このパスコードを知っている
-- 決裁者だけができるようにするための照合用RPC。
-- パスコード自体は private スキーマに隠し、PostgRESTからは
-- verify_decision_passcode() の true/false 結果しか見えない。
-- ---------------------------------------------------------------

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null
);

-- 'CHANGE_ME_PASSCODE' の部分を、決裁者に共有する実際のパスコードに
-- 書き換えてから実行してください。パスコードを変更したい場合は
-- この insert 文だけ値を変えて再実行すればOKです。
insert into private.app_secrets (key, value)
values ('decision_passcode_hash', crypt('CHANGE_ME_PASSCODE', gen_salt('bf')))
on conflict (key) do update set value = excluded.value;

create or replace function public.verify_decision_passcode(input_passcode text)
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select value = crypt(input_passcode, value)
  from private.app_secrets
  where key = 'decision_passcode_hash';
$$;

revoke all on function public.verify_decision_passcode(text) from public;
grant execute on function public.verify_decision_passcode(text) to anon, authenticated;
