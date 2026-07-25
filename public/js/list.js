(function () {
  const docListEl = document.getElementById("docList");
  const filterTabs = document.getElementById("filterTabs");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const saveToast = document.getElementById("saveToast");
  const modeStatusEl = document.getElementById("modeStatus");
  const modeToggleBtn = document.getElementById("modeToggleBtn");

  const MODE_KEY = "decisionModeUnlocked";

  let allDocs = [];
  let currentFilter = "all";

  function isUnlocked() {
    return sessionStorage.getItem(MODE_KEY) === "1";
  }

  function updateModeUI() {
    const unlocked = isUnlocked();
    modeStatusEl.textContent = unlocked ? "🔓 決裁者モード: 解除中" : "🔒 決裁者モード: ロック中";
    modeStatusEl.classList.toggle("unlocked", unlocked);
    modeToggleBtn.textContent = unlocked ? "ロックする" : "決裁者モードを解除";
  }

  modeToggleBtn.addEventListener("click", async () => {
    if (isUnlocked()) {
      sessionStorage.removeItem(MODE_KEY);
      updateModeUI();
      render();
      return;
    }

    const input = prompt("決裁者用パスコードを入力してください");
    if (input === null) return;

    const { data, error } = await window.db.rpc("verify_decision_passcode", {
      input_passcode: input
    });

    if (error) {
      alert("確認に失敗しました: " + error.message);
      return;
    }

    if (data === true) {
      sessionStorage.setItem(MODE_KEY, "1");
      showToast("決裁者モードを解除しました");
    } else {
      alert("パスコードが違います");
    }
    updateModeUI();
    render();
  });

  function showToast(message) {
    saveToast.textContent = message;
    saveToast.classList.add("show");
    setTimeout(() => saveToast.classList.remove("show"), 1500);
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString("ja-JP");
  }

  function extractStoragePath(url) {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  }

  async function deleteDoc(doc) {
    if (!confirm(`この稟議書データを削除します。よろしいですか？\n(${doc.file_name || "無題"} / 元に戻せません)`)) {
      return;
    }

    const path = extractStoragePath(doc.image_url);
    if (path) {
      const { error: storageError } = await window.db.storage.from(BUCKET).remove([path]);
      if (storageError) {
        console.warn("画像ファイルの削除に失敗しました(データの削除は続行します):", storageError.message);
      }
    }

    const { error } = await window.db.from("documents").delete().eq("id", doc.id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
      return;
    }

    allDocs = allDocs.filter((d) => d.id !== doc.id);
    showToast("削除しました");
    render();
  }

  async function loadDocs() {
    docListEl.textContent = "読み込み中...";
    const { data, error } = await window.db
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      docListEl.textContent = "読み込みエラー: " + error.message;
      return;
    }
    allDocs = (data || []).filter((d) => d.image_url && d.image_url.trim() !== "");
    render();
  }

  function render() {
    const docs = currentFilter === "all"
      ? allDocs
      : allDocs.filter((d) => d.status === currentFilter);

    if (docs.length === 0) {
      docListEl.innerHTML = "<p>該当する稟議書はありません。</p>";
      return;
    }

    docListEl.innerHTML = "";
    docs.forEach((doc) => docListEl.appendChild(renderRow(doc)));
  }

  function renderRow(doc) {
    const row = document.createElement("div");
    row.className = "doc-row";

    const img = document.createElement("img");
    img.src = doc.image_url;
    img.alt = doc.file_name || "";
    img.addEventListener("click", () => {
      lightboxImg.src = doc.image_url;
      lightbox.classList.add("show");
    });
    row.appendChild(img);

    const body = document.createElement("div");
    body.className = "doc-body";

    const meta = document.createElement("div");
    meta.className = "doc-meta";

    const badge = document.createElement("span");
    badge.className = "status-badge " + doc.status;
    badge.textContent = STATUS_LABEL[doc.status] || doc.status;
    meta.appendChild(badge);

    const toggle = document.createElement("div");
    toggle.className = "status-toggle";
    toggle.innerHTML = `
      <button data-status="approved" class="approve ${doc.status === "approved" ? "selected" : ""}">⭕ 決裁</button>
      <button data-status="on_hold" class="hold ${doc.status === "on_hold" ? "selected" : ""}">🔼 保留</button>
      <button data-status="rejected" class="reject ${doc.status === "rejected" ? "selected" : ""}">✖️ 否決</button>
      <button data-status="pending" class="${doc.status === "pending" ? "selected" : ""}">未処理に戻す</button>
    `;
    if (!isUnlocked()) {
      toggle.classList.add("locked");
    }
    toggle.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!isUnlocked()) {
          alert("ステータスの変更には決裁者モードの解除が必要です");
          return;
        }
        const newStatus = btn.dataset.status;
        if (newStatus === doc.status) return;
        const decidedAt = newStatus === "pending" ? null : new Date().toISOString();
        const { error } = await window.db
          .from("documents")
          .update({ status: newStatus, decided_at: decidedAt })
          .eq("id", doc.id);
        if (error) {
          alert("更新に失敗しました: " + error.message);
          return;
        }
        doc.status = newStatus;
        doc.decided_at = decidedAt;
        showToast("更新しました");
        render();
      });
    });
    meta.appendChild(toggle);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "🗑 削除";
    deleteBtn.addEventListener("click", () => deleteDoc(doc));
    meta.appendChild(deleteBtn);

    body.appendChild(meta);

    const fileName = document.createElement("div");
    fileName.className = "file-name";
    fileName.textContent = doc.file_name || "";
    body.appendChild(fileName);

    const comment = document.createElement("textarea");
    comment.className = "comment-box";
    comment.placeholder = "短評を入力...";
    comment.value = doc.comment || "";
    comment.addEventListener("blur", async () => {
      if (comment.value === (doc.comment || "")) return;
      const { error } = await window.db
        .from("documents")
        .update({ comment: comment.value })
        .eq("id", doc.id);
      if (error) {
        alert("短評の保存に失敗しました: " + error.message);
        return;
      }
      doc.comment = comment.value;
      showToast("短評を保存しました");
    });
    body.appendChild(comment);

    const decidedAt = document.createElement("div");
    decidedAt.className = "decided-at";
    decidedAt.textContent = "処理日時: " + formatDate(doc.decided_at) + " / 取込日時: " + formatDate(doc.created_at);
    body.appendChild(decidedAt);

    row.appendChild(body);
    return row;
  }

  filterTabs.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterTabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.status;
      render();
    });
  });

  lightbox.addEventListener("click", () => lightbox.classList.remove("show"));

  updateModeUI();
  loadDocs();
})();
