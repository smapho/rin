(function () {
  const cardStage = document.getElementById("cardStage");
  const progressText = document.getElementById("progressText");
  const btnApprove = document.getElementById("btnApprove");
  const btnReject = document.getElementById("btnReject");

  const SWIPE_THRESHOLD = 100;

  let queue = [];
  let currentCard = null;
  let dragState = null;
  let busy = false;

  async function loadQueue() {
    progressText.textContent = "読み込み中...";
    const { data, error } = await window.db
      .from("documents")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      progressText.textContent = "読み込みエラー: " + error.message;
      return;
    }
    queue = data || [];
    renderCurrent();
  }

  function renderCurrent() {
    cardStage.innerHTML = "";
    currentCard = null;

    if (queue.length === 0) {
      progressText.textContent = "対象の稟議書はありません";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<p>未処理の稟議書はすべて処理済みです。</p><p><a href='list.html'>一覧を見る</a></p>";
      cardStage.appendChild(empty);
      return;
    }

    progressText.textContent = `残り ${queue.length} 件`;

    const doc = queue[0];
    const card = document.createElement("div");
    card.className = "doc-card";
    card.innerHTML = `
      <div class="stamp approve">決裁</div>
      <div class="stamp reject">否決</div>
      <img src="${doc.image_url}" alt="${doc.file_name || "稟議書"}">
    `;
    cardStage.appendChild(card);
    currentCard = card;
    attachDrag(card, doc);
  }

  function attachDrag(card, doc) {
    const approveStamp = card.querySelector(".stamp.approve");
    const rejectStamp = card.querySelector(".stamp.reject");

    card.addEventListener("pointerdown", (e) => {
      if (busy) return;
      card.setPointerCapture(e.pointerId);
      dragState = { startX: e.clientX, dx: 0 };
      card.style.transition = "none";
    });

    card.addEventListener("pointermove", (e) => {
      if (!dragState || busy) return;
      dragState.dx = e.clientX - dragState.startX;
      const rotate = dragState.dx / 20;
      card.style.transform = `translateX(${dragState.dx}px) rotate(${rotate}deg)`;
      const ratio = Math.min(Math.abs(dragState.dx) / SWIPE_THRESHOLD, 1);
      if (dragState.dx > 0) {
        approveStamp.style.opacity = ratio;
        rejectStamp.style.opacity = 0;
      } else {
        rejectStamp.style.opacity = ratio;
        approveStamp.style.opacity = 0;
      }
    });

    const endDrag = (e) => {
      if (!dragState || busy) return;
      const dx = dragState.dx;
      dragState = null;
      card.style.transition = "transform 0.25s ease";

      if (dx > SWIPE_THRESHOLD) {
        commitDecision(doc, "approved", card);
      } else if (dx < -SWIPE_THRESHOLD) {
        commitDecision(doc, "rejected", card);
      } else {
        card.style.transform = "translateX(0) rotate(0)";
        approveStamp.style.opacity = 0;
        rejectStamp.style.opacity = 0;
      }
    };

    card.addEventListener("pointerup", endDrag);
    card.addEventListener("pointercancel", endDrag);
  }

  async function commitDecision(doc, status, card) {
    if (busy) return;
    busy = true;

    const flyX = status === "approved" ? window.innerWidth : -window.innerWidth;
    card.style.transition = "transform 0.35s ease";
    card.style.transform = `translateX(${flyX}px) rotate(${flyX / 20}deg)`;
    const stampClass = status === "approved" ? ".stamp.approve" : ".stamp.reject";
    card.querySelector(stampClass).style.opacity = 1;

    const { error } = await window.db
      .from("documents")
      .update({ status: status, decided_at: new Date().toISOString() })
      .eq("id", doc.id);

    if (error) {
      alert("更新に失敗しました: " + error.message);
      busy = false;
      card.style.transform = "translateX(0) rotate(0)";
      return;
    }

    setTimeout(() => {
      queue.shift();
      busy = false;
      renderCurrent();
    }, 350);
  }

  btnApprove.addEventListener("click", () => {
    if (busy || queue.length === 0 || !currentCard) return;
    commitDecision(queue[0], "approved", currentCard);
  });

  btnReject.addEventListener("click", () => {
    if (busy || queue.length === 0 || !currentCard) return;
    commitDecision(queue[0], "rejected", currentCard);
  });

  loadQueue();
})();
