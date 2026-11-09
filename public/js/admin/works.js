async function works() {
  const list = await api("/api/work-types");
  const rows = list
    .map(
      (item) => `
    <tr data-search="${esc(item.name)}">
      <td><b>${esc(item.name)}</b></td>
      <td>${money(item.default_price)}</td>
      <td>${
        item.estimated_duration != null
          ? `${esc(item.estimated_duration)} мин`
          : "—"
      }</td>
      <td><button class="action-btn" data-action="edit-work" data-id="${Number(
        item.work_type_id
      )}">Редактировать</button></td>
    </tr>`
    )
    .join("");

  return page(
    "Работы",
    ["Название работы", "Базовая цена", "Время", ""],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-work">+ Добавить работу</button>',
    tableTools("Поиск по названию работы")
  );
}


async function openWorkModal(workTypeId = null) {
  const works = await api("/api/work-types");
  const work = workTypeId
    ? works.find((item) => Number(item.work_type_id) === Number(workTypeId))
    : null;
  if (workTypeId && !work) throw new Error("Работа не найдена.");
  const body = `
    <form id="workEditorForm">
      <div class="app-form-grid">
        <label class="app-field app-field-full">Название работы
          <input name="name" maxlength="150" required value="${esc(
            work?.name || ""
          )}" placeholder="Например, Замена масла">
        </label>
        <label class="app-field">Базовая цена, ₽
          <input name="default_price" type="number" min="0" step="0.01" required value="${esc(
            work?.default_price ?? ""
          )}" placeholder="0">
        </label>
        <label class="app-field">Время, мин
          <input name="estimated_duration" type="number" min="1" step="1" value="${esc(
            work?.estimated_duration ?? ""
          )}" placeholder="Не указано">
        </label>
      </div>
      <div id="workFormError" class="modal-error" hidden></div>
      <div class="app-modal-actions">
        <button type="button" class="action-btn" data-modal-close>Отмена</button>
        <button type="submit" class="action-btn action-btn-primary">${
          work ? "Сохранить" : "Добавить работу"
        }</button>
      </div>
    </form>`;
  const modal = modalShell(
    work ? "Редактировать работу" : "Новая работа",
    "Справочник видов работ",
    body
  );
  const form = modal.querySelector("#workEditorForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector("#workFormError");
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      default_price: Number(formData.get("default_price")),
      estimated_duration: formData.get("estimated_duration") || null,
    };
    submit.disabled = true;
    errorBox.hidden = true;
    try {
      await api(
        work ? `/api/work-types/${work.work_type_id}` : "/api/work-types",
        { method: work ? "PATCH" : "POST", body: JSON.stringify(payload) }
      );
      modal.remove();
      await render();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submit.disabled = false;
    }
  });
}

