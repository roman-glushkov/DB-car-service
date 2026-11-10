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
        <div class="app-field app-field-full skill-picker">
          <div class="skill-picker-header">
            <div>
              <div class="skill-picker-title">Виды работ</div>
              <p>Отметьте работы, которые сотрудник умеет выполнять.</p>
            </div>
            <div class="skill-picker-actions">
              <button type="button" class="skill-picker-button" id="selectAllEmployeeSkills" ${options.workTypes.length ? "" : "disabled"}>Выбрать все</button>
              <button type="button" class="skill-picker-button skill-picker-button-muted" id="clearEmployeeSkills" ${options.workTypes.length ? "" : "disabled"}>Снять выбор</button>
            </div>
          </div>
          <div class="skill-list" role="group" aria-label="Доступные виды работ">
            ${options.workTypes.length
              ? options.workTypes.map((work) => `
              <label class="skill-option ${selectedSkills.has(Number(work.work_type_id)) ? "is-selected" : ""}">
                <input type="checkbox" name="work_type_ids" value="${Number(work.work_type_id)}" ${selectedSkills.has(Number(work.work_type_id)) ? "checked" : ""}>
                <span class="skill-option-name">${esc(work.name)}</span>
              </label>`).join("")
              : '<p class="skill-picker-empty">Виды работ пока не созданы. Добавьте их в разделе «Работы».</p>'}
          </div>
          <div class="skill-picker-footer" id="employeeSkillCount" aria-live="polite"></div>
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
  const skillBoxes = [...form.querySelectorAll('input[name="work_type_ids"]')];
  const skillCount = form.querySelector("#employeeSkillCount");
  const syncSkills = () => {
    const checkedCount = skillBoxes.filter((box) => box.checked).length;
    skillCount.textContent = `Выбрано ${checkedCount} из ${skillBoxes.length}`;
    skillBoxes.forEach((box) => {
      box.closest(".skill-option").classList.toggle("is-selected", box.checked);
    });
  };
  form.querySelector("#selectAllEmployeeSkills").addEventListener("click", () => {
    skillBoxes.forEach((box) => { box.checked = true; });
    syncSkills();
  });
  form.querySelector("#clearEmployeeSkills").addEventListener("click", () => {
    skillBoxes.forEach((box) => { box.checked = false; });
    syncSkills();
  });
  skillBoxes.forEach((box) => box.addEventListener("change", syncSkills));
  syncSkills();
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
        alert(`Сотрудник добавлен, доступ создан администратором.\nЛогин: ${payload.email}\nВременный пароль: ${result.temporary_password}\nСохраните его и передайте сотруднику. Пароль можно изменить в личном кабинете.`);
      }
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submitButton.disabled = false;
    }
  });
}

