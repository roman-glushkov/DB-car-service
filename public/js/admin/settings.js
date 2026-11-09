function openImagePreview(src, alt = "Фотография автомобиля") {
  const viewer = document.createElement("div");
  viewer.className = "image-preview-backdrop";
  viewer.innerHTML = `
    <button type="button" class="image-preview-close" aria-label="Закрыть">×</button>
    <img src="${esc(src)}" alt="${esc(alt)}">`;
  document.body.append(viewer);
  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };
  const close = () => {
    viewer.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer || event.target.closest(".image-preview-close"))
      close();
  });
  document.addEventListener("keydown", onKeyDown);
}

function openSettingsModal() {
  const modal = modalShell(
    "Настройки профиля",
    "Управление данными доступа",
    `<div class="settings-content">
      <div class="settings-account"><span>Текущий аккаунт</span><b>${esc(
        currentUser?.email || "—"
      )}</b></div>
      <p class="app-modal-note">Для смены пароля потребуется подтвердить email, привязанный к текущей сессии.</p>
      <div class="app-modal-actions"><button type="button" class="action-btn" data-modal-close>Закрыть</button><button type="button" class="action-btn action-btn-primary" data-open-password>Сменить пароль</button></div>
    </div>`
  );
  modal.querySelector("[data-open-password]").addEventListener("click", () => {
    modal.querySelector(".settings-content").innerHTML = `
      <form id="passwordChangeForm">
        <div class="app-form-grid">
          <label class="app-field app-field-full">Email текущей учётной записи
            <input name="email" type="email" maxlength="190" required value="${esc(
              currentUser?.email || ""
            )}" autocomplete="username">
          </label>
          <label class="app-field app-field-full">Новый пароль
            <input name="password" type="password" minlength="10" required autocomplete="new-password" placeholder="Не менее 10 символов">
          </label>
          <label class="app-field app-field-full">Повторите новый пароль
            <input name="password_confirmation" type="password" minlength="10" required autocomplete="new-password">
          </label>
        </div>
        <div id="passwordChangeError" class="modal-error" hidden></div>
        <div class="app-modal-actions"><button type="button" class="action-btn" data-modal-close>Отмена</button><button type="submit" class="action-btn action-btn-primary">Сохранить пароль</button></div>
      </form>`;
    const form = modal.querySelector("#passwordChangeForm");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      const error = form.querySelector("#passwordChangeError");
      submit.disabled = true;
      error.hidden = true;
      try {
        await api("/api/account/password", {
          method: "PATCH",
          body: JSON.stringify({
            email: data.get("email"),
            password: data.get("password"),
            password_confirmation: data.get("password_confirmation"),
          }),
        });
        modal.remove();
        alert("Пароль успешно изменён.");
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
        submit.disabled = false;
      }
    });
  });
}

function initialsForAdmin(name) {
  return String(name || "АП")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}
