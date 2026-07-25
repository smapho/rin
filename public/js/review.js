(function () {
  const cardStage = document.getElementById("cardStage");
  const progressText = document.getElementById("progressText");
  const btnApprove = document.getElementById("btnApprove");
  const btnReject = document.getElementById("btnReject");
  const btnHold = document.getElementById("btnHold");

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
      <div class="stamp hold">保留</div>
      <img src="${doc.image_url}" alt="${doc.file_name || "稟議書"}">
    `;
    cardStage.appendChild(card);
    currentCard = card;
    attachDrag(card, doc);
  }

  function attachDrag(card, doc) {
    const approveStamp = card.querySelector(".stamp.approve");
    const rejectStamp = card.querySelector(".stamp.reject");
    const holdStamp = card.querySelector(".stamp.hold");

    card.addEventListener("pointerdown", (e) => {
      if (busy) return;
      card.setPointerCapture(e.pointerId);
      dragState = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 };
      card.style.transition = "none";
    });

    card.addEventListener("pointermove", (e) => {
      if (!dragState || busy) return;
      dragState.dx = e.clientX - dragState.startX;
      dragState.dy = e.clientY - dragState.startY;
      const { dx, dy } = dragState;
      const rotate = dx / 20;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;

      approveStamp.style.opacity = 0;
      rejectStamp.style.opacity = 0;
      holdStamp.style.opacity = 0;

      if (dy < 0 && Math.abs(dy) > Math.abs(dx)) {
        holdStamp.style.opacity = Math.min(Math.abs(dy) / SWIPE_THRESHOLD, 1);
      } else if (dx > 0) {
        approveStamp.style.opacity = Math.min(dx / SWIPE_THRESHOLD, 1);
      } else if (dx < 0) {
        rejectStamp.style.opacity = Math.min(-dx / SWIPE_THRESHOLD, 1);
      }
    });

    const endDrag = (e) => {
      if (!dragState || busy) return;
      const { dx, dy } = dragState;
      dragState = null;
      card.style.transition = "transform 0.25s ease";

      if (dy < -SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        commitDecision(doc, "on_hold", card);
      } else if (dx > SWIPE_THRESHOLD) {
        commitDecision(doc, "approved", card);
      } else if (dx < -SWIPE_THRESHOLD) {
        commitDecision(doc, "rejected", card);
      } else {
        card.style.transform = "translate(0, 0) rotate(0)";
        approveStamp.style.opacity = 0;
        rejectStamp.style.opacity = 0;
        holdStamp.style.opacity = 0;
      }
    };

    card.addEventListener("pointerup", endDrag);
    card.addEventListener("pointercancel", endDrag);
  }

  const STAMP_SELECTOR = {
    approved: ".stamp.approve",
    rejected: ".stamp.reject",
    on_hold: ".stamp.hold"
  };

  async function commitDecision(doc, status, card) {
    if (busy) return;
    busy = true;

    let flyX = 0;
    let flyY = 0;
    if (status === "approved") flyX = window.innerWidth;
    else if (status === "rejected") flyX = -window.innerWidth;
    else if (status === "on_hold") flyY = -window.innerHeight;

    card.style.transition = "transform 0.35s ease";
    card.style.transform = `translate(${flyX}px, ${flyY}px) rotate(${flyX / 20}deg)`;
    card.querySelector(STAMP_SELECTOR[status]).style.opacity = 1;

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

  btnHold.addEventListener("click", () => {
    if (busy || queue.length === 0 || !currentCard) return;
    commitDecision(queue[0], "on_hold", currentCard);
  });

  loadQueue();
})();
