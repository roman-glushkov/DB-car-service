async function employees() {
  const list = await api("/api/employees");
  const rows = list
    .map(
      (item) => `
    <tr data-search="${esc(item.full_name)}">
      <td><b>${esc(item.full_name)}</b></td>
      <td>${esc(item.email || "—")}</td>
      <td>${esc(item.position)}</td>
      <td>${esc(item.phone || "—")}</td>
      <td>${esc(item.skills || "Навыки не указаны")}</td>
      <td><span class="status s-new">${
        Number(item.is_active) ? "Работает" : "Неактивен"
      }</span></td>
      <td><button class="action-btn" data-action="edit-employee" data-id="${Number(
        item.employee_id
      )}">Изменить</button></td>
    </tr>`
    )
    .join("");

  return page(
    "Сотрудники",
    [
      "Сотрудник",
      "Email для входа",
      "Должность",
      "Телефон",
      "Навыки",
      "Статус",
      "",
    ],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-employee">+ Добавить сотрудника</button>',
    tableTools("Поиск по ФИО")
  );
}


async function openEmployeeModal(employeeId = null) {
  const [options, employeesList] = await Promise.all([
    api("/api/order-options"),
    api("/api/employees"),
  ]);
  const employee = employeeId
    ? employeesList.find(
        (item) => Number(item.employee_id) === Number(employeeId)
      )
    : null;
  if (employeeId && !employee) throw new Error("Сотрудник не найден");

  const selectedSkills = new Set(
    String(employee?.skill_ids || "")
      .split(",")
      .filter(Boolean)
      .map(Number)
  );
  const body = `
    <form id="employeeEditorForm">
      <div class="app-form-grid">
        <label class="app-field app-field-full">ФИО
          <input name="full_name" maxlength="150" required value="${esc(
            employee?.full_name || ""
          )}">
        </label>
        <label class="app-field">Должность
          <input name="position" maxlength="50" required value="${esc(
            employee?.position || "Мастер"
          )}">
        </label>
        <label class="app-field">Телефон
          <input name="phone" maxlength="20" value="${esc(
            employee?.phone || ""
          )}">
        </label>
        <label class="app-field app-field-full">Email для входа
          <input name="email" type="email" maxlength="190" required value="${esc(
            employee?.email || ""
          )}" placeholder="master@example.com">
        </label>
        <label class="app-field app-field-full" style="flex-direction:row;align-items:center">
          <input name="is_active" type="checkbox" style="width:auto" ${
            employee && !Number(employee.is_active) ? "" : "checked"
          }>
          Сотрудник активен и может получать новые заказы
        </label>
        <div class="app-field app-field-full">
          <span>Навыки — виды работ, которые сотрудник может выполнять</span>
          <div class="skill-list">
            ${options.workTypes
              .map(
                (work) => `
              <label class="skill-option">
                <input type="checkbox" name="work_type_ids" value="${Number(
                  work.work_type_id
                )}" ${
                  selectedSkills.has(Number(work.work_type_id)) ? "checked" : ""
                }>
                <span>${esc(work.name)}</span>
              </label>`
              )
              .join("")}
          </div>
        </div>
      </div>
      <div class="app-modal-note">Автоматическое назначение заказа учитывает только активных сотрудников, у которых есть навыки для всех работ этого заказа. Сотрудник без выбранных навыков не будет автоматически назначаться.</div>
      <div id="employeeFormError" class="modal-error" hidden></div>
      <div class="app-modal-actions">
        <button type="button" class="action-btn" data-modal-close>Отмена</button>
        <button type="submit" class="action-btn action-btn-primary">Сохранить сотрудника</button>
      </div>
    </form>`;

  const modal = modalShell(
    employee ? "Редактирование сотрудника" : "Новый сотрудник",
    "Профиль и навыки сотрудника",
    body
  );
  const form = modal.querySelector("#employeeEditorForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector("#employeeFormError");
    submitButton.disabled = true;
    errorBox.hidden = true;
    const formData = new FormData(form);
    const payload = {
      full_name: formData.get("full_name"),
      position: formData.get("position"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      is_active: form.querySelector('[name="is_active"]').checked ? 1 : 0,
      work_type_ids: formData.getAll("work_type_ids").map(Number),
    };

    try {
      const result = await api(
        employee ? `/api/employees/${employee.employee_id}` : "/api/employees",
        {
          method: employee ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );
      modal.remove();
      await render();
      if (result.account_created) {
        alert(
          "Учётная запись сотрудника создана. Временный пароль: qwerty1234."
        );
      } else if (!employee) {
        alert(
          "Сотрудник добавлен. Доступ создан автоматически. Временный пароль: qwerty1234."
        );
      }
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submitButton.disabled = false;
    }
  });
}

