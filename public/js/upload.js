(function () {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const uploadList = document.getElementById("uploadList");

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
    fileInput.value = "";
  });

  function sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  function handleFiles(fileList) {
    Array.from(fileList).forEach(uploadOne);
  }

  async function uploadOne(file) {
    const item = document.createElement("div");
    item.className = "upload-item";
    const nameEl = document.createElement("span");
    nameEl.className = "name";
    nameEl.textContent = file.name;
    const statusEl = document.createElement("span");
    statusEl.className = "status";
    statusEl.textContent = "アップロード中...";
    item.appendChild(nameEl);
    item.appendChild(statusEl);
    uploadList.prepend(item);

    try {
      const now = new Date();
      const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
      const path = `${folder}/${now.getTime()}-${sanitizeName(file.name)}`;

      const { error: uploadError } = await window.db.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = window.db.storage.from(BUCKET).getPublicUrl(path);
      const imageUrl = publicUrlData.publicUrl;

      const { error: insertError } = await window.db.from("documents").insert({
        image_url: imageUrl,
        file_name: file.name,
        status: "pending"
      });

      if (insertError) throw insertError;

      statusEl.textContent = "完了";
      statusEl.classList.add("ok");
    } catch (err) {
      statusEl.textContent = "失敗: " + (err.message || err);
      statusEl.classList.add("error");
    }
  }
})();
