# 稟議書 決裁アプリ

社内の稟議書（画像）を1件ずつ確認しながら、タブレット上で ⭕(決裁) / ✖️(否決) を判断していく審査アプリです。
判断が終わると自動的に次の画像へ進みます。あとから一覧で決裁/否決と短評を確認・修正できます。

- `index.html` … 審査画面（画像をドラッグ、または下のボタンで ⭕決裁 / ✖️否決）
- `list.html` … 一覧画面（ステータス変更・短評の編集が可能）
- `upload.html` … 稟議書画像の取込画面（Supabase Storageへアップロード）

構成: 素のHTML/JavaScript（ビルド不要）+ Supabase（DB & Storage）+ Vercel（ホスティング）

## セットアップ手順

### 1. Supabaseプロジェクトを作成

1. https://supabase.com でプロジェクトを新規作成
2. 作成したプロジェクトの `SQL Editor` を開き、[`supabase/schema.sql`](supabase/schema.sql) の内容を貼り付けて実行
   - `documents` テーブルの作成
   - `ringi-images` という公開Storageバケットの作成
   - RLSポリシー（社内ツール想定でanonキーからの読み書きを許可。認証を入れる場合は要調整）
3. `Project Settings > API` から以下を控える
   - `Project URL`
   - `anon public` キー

### 2. アプリに接続情報を設定

[`public/js/config.js`](public/js/config.js) を編集し、控えた値を入力してください。

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "xxxxxxxxxxxxxxxx",
  STORAGE_BUCKET: "ringi-images"
};
```

anon keyはSupabaseの設計上クライアント（ブラウザ）に公開される前提のキーです。実データはRLSポリシーで保護します。

### 3. ローカルで確認

ビルド不要の静的サイトなので、`public` ディレクトリを適当な静的サーバーで開くだけで確認できます。

```bash
npx serve public
```

### 4. Vercelへデプロイ

このリポジトリはすでに Vercel プロジェクト `smapho/rin` にリンク済みです。

```bash
vercel deploy          # プレビューデプロイ
vercel deploy --prod   # 本番デプロイ
```

## 使い方

1. **取込**: `upload.html` で稟議書の画像（複数可）をアップロード。Supabase Storageの `ringi-images` バケットに保存され、`documents` テーブルに `pending` として1件ずつ登録されます。
2. **審査**: `index.html` で画像を確認しながら、右にドラッグ（または「⭕ 決裁」ボタン）で決裁、左にドラッグ（または「✖️ 否決」ボタン）で否決。判定すると画面に決裁/否決のスタンプが表示され、自動的に次の画像へ切り替わります。
3. **一覧・修正**: `list.html` で全件の決裁/否決ステータスと短評を確認。ステータスボタンで判断をあとから変更でき、短評欄はフォーカスを外すと自動保存されます。

## セキュリティに関する注意

社内利用を想定したシンプルな構成のため、現状は認証なし・anonキーでの読み書き許可としています。社外からアクセス可能にする場合は、以下のいずれかを検討してください。

- Vercelのデプロイ保護（パスワード保護 / SSO）を有効化する
- Supabase Authを導入し、RLSポリシーを `auth.uid()` ベースに変更する
