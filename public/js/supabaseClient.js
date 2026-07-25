// window.supabase はCDNのUMDビルドが提供するグローバル（createClientを持つ）
// クライアント作成後は window.db として使い、グローバル名の衝突を避ける
window.db = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

const STATUS_LABEL = {
  pending: "未処理",
  approved: "決裁",
  rejected: "否決",
  on_hold: "保留"
};

const BUCKET = window.APP_CONFIG.STORAGE_BUCKET;
