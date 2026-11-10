async function clients() {
  const list = await api("/api/clients");
  const rows = list
    .map(
      (item) => `
    <tr data-search="${esc(`${item.full_name} ${item.phone} ${item.email || ""}`)}">
      <td><b>${esc(item.full_name)}</b></td>
      <td>${esc(item.phone)}</td>
      <td>${esc(item.email || "—")}</td>
      <td>${esc(item.cars || "—")}</td><td><button class="action-btn" data-action="edit-client" data-id="${Number(item.client_id)}">Изменить</button><button class="action-btn" data-action="delete-record" data-kind="clients" data-id="${Number(item.client_id)}">Удалить</button></td>
    </tr>`
    )
    .join("");

  return page(
    "Клиенты",
    ["Клиент", "Телефон", "Почта", "Автомобили", "Действия"],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-client">+ Добавить клиента</button>',
    tableTools("Поиск по ФИО или телефону")
  );
}


async function openClientModal(clientId = null) {
  const records = clientId ? await api("/api/clients") : [];
  const found = clientId ? records.find(item => Number(item.client_id) === Number(clientId)) : null;
  if (clientId && !found) throw new Error("Клиент не найден");
  const body = `
    <form id="clientEditorForm">
      <div class="app-form-grid">
        <label class="app-field app-field-full">ФИО
          <input name="full_name" maxlength="150" required value="${esc(found?.full_name || "")}" placeholder="Иванов Иван Иванович">
        </label>
        <label class="app-field">Телефон
          <input name="phone" maxlength="20" required value="${esc(found?.phone || "")}" placeholder="+7 900 000-00-00">
        </label>
        <label class="app-field">Email
          <input name="email" type="email" maxlength="100" required value="${esc(found?.email || "")}" placeholder="client@example.com">
        </label>
      </div>
      ${found ? "" : `<div class="app-modal-note">Для клиента автоматически создастся доступ в личный кабинет. Временный пароль: <b>qwerty1234</b>. Автомобиль можно добавить позднее из кабинета клиента.</div>`}
      <div id="clientFormError" class="modal-error" hidden></div>
      <div class="app-modal-actions">
        <button type="button" class="action-btn" data-modal-close>Отмена</button>
        <button type="submit" class="action-btn action-btn-primary">${found ? "Сохранить" : "Добавить клиента"}</button>
      </div>
    </form>`;
  const modal = modalShell(
    found ? "Изменить клиента" : "Новый клиент",
    "Профиль и автоматическое создание доступа",
    body
  );
  const form = modal.querySelector("#clientEditorForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector("#clientFormError");
    errorBox.hidden = true;
    submit.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      await api(found ? `/api/clients/${found.client_id}` : "/api/clients", {
        method: found ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      modal.remove();
      await render();
      if (!found) alert("Клиент добавлен. Пароль первичного доступа указан в инструкции.");
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submit.disabled = false;
    }
  });
}

