async function accounts() {
  const list = await api("/api/accounts");
  const roleNames = {
    admin: "Администратор",
    client: "Клиент",
    employee: "Сотрудник",
  };
  const rows = list
    .map(
      (item) => `
    <tr>
      <td><b>${esc(item.profile_name || "—")}</b><div class="muted-mini">${esc(
        item.email
      )}</div></td>
      <td>${esc(roleNames[item.role] || item.role)}</td>
      <td><span class="status ${
        Number(item.is_active) ? "s-new" : "s-muted"
      }">${Number(item.is_active) ? "Активна" : "Отключена"}</span></td>
      <td>${dateTime(item.created_at)}</td>
      <td><button class="action-btn" data-action="toggle-account" data-id="${Number(
        item.account_id
      )}" data-active="${Number(item.is_active) ? 0 : 1}">${
        Number(item.is_active) ? "Отключить" : "Включить"
      }</button></td>
    </tr>`
    )
    .join("");
  return page(
    "Доступы пользователей",
    ["Профиль / email", "Роль", "Состояние", "Создана", ""],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-account">+ Создать доступ</button>'
  );
}


async function openAccountModal() {
  const options = await api("/api/account-options");
  const body = `
    <form id="accountEditorForm">
      <div class="app-form-grid">
        <label class="app-field">Тип доступа
          <select name="role" id="accountRole" required>
            <option value="client">Клиент</option>
            <option value="employee">Сотрудник</option>
            <option value="admin">Администратор</option>
          </select>
        </label>
        <label class="app-field">Email для входа
          <input name="email" type="email" maxlength="190" required placeholder="name@example.com">
        </label>
        <label class="app-field app-field-full">Пароль
          <input name="password" type="password" minlength="10" required autocomplete="new-password" placeholder="Минимум 10 символов">
        </label>
        <label class="app-field app-field-full" id="accountClientField">Профиль клиента
          <select name="client_id"><option value="">Выберите клиента</option>${options.clients
            .map(
              (item) =>
                `<option value="${Number(item.client_id)}">${esc(
                  item.full_name
                )} · ${esc(item.phone)}</option>`
            )
            .join("")}</select>
        </label>
        <label class="app-field app-field-full" id="accountEmployeeField" hidden>Профиль сотрудника
          <select name="employee_id"><option value="">Выберите сотрудника</option>${options.employees
            .map(
              (item) =>
                `<option value="${Number(item.employee_id)}">${esc(
                  item.full_name
                )} · ${esc(item.position)}</option>`
            )
            .join("")}</select>
        </label>
        <label class="app-field app-field-full" id="accountAdminField" hidden>Имя администратора
          <input name="display_name" maxlength="150" placeholder="Например, Администратор сервиса">
        </label>
      </div>
      <div class="app-modal-note">Клиентская учётная запись привязывается к существующей записи в таблице clients. Учётная запись сотрудника — к профилю в employees. Один профиль может иметь только один аккаунт.</div>
      <div id="accountFormError" class="modal-error" hidden></div>
      <div class="app-modal-actions">
        <button type="button" class="action-btn" data-modal-close>Отмена</button>
        <button type="submit" class="action-btn action-btn-primary">Создать учётную запись</button>
      </div>
    </form>`;
  const modal = modalShell(
    "Новый доступ",
    "Создание отдельного входа в AutoPro",
    body
  );
  const form = modal.querySelector("#accountEditorForm");
  const roleSelect = form.querySelector("#accountRole");
  const clientField = form.querySelector("#accountClientField");
  const employeeField = form.querySelector("#accountEmployeeField");
  const adminField = form.querySelector("#accountAdminField");
  const clientSelect = clientField.querySelector("select");
  const employeeSelect = employeeField.querySelector("select");
  const updateRoleFields = () => {
    clientField.hidden = roleSelect.value !== "client";
    employeeField.hidden = roleSelect.value !== "employee";
    adminField.hidden = roleSelect.value !== "admin";
    clientSelect.required = roleSelect.value === "client";
    employeeSelect.required = roleSelect.value === "employee";
  };
  roleSelect.addEventListener("change", updateRoleFields);
  updateRoleFields();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorBox = form.querySelector("#accountFormError");
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const role = formData.get("role");
    const payload = {
      role,
      email: formData.get("email"),
      password: formData.get("password"),
      profile_id:
        role === "client"
          ? Number(formData.get("client_id"))
          : role === "employee"
          ? Number(formData.get("employee_id"))
          : null,
      display_name: formData.get("display_name"),
    };
    errorBox.hidden = true;
    submitButton.disabled = true;
    try {
      await api("/api/accounts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      modal.remove();
      await render();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submitButton.disabled = false;
    }
  });
}


async function toggleAccount(accountId, isActive) {
  await api(`/api/accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
  await render();
}

