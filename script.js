const esc = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[char])
  );

async function api(url, options = {}) {
  if (url.startsWith("/api/") && !url.startsWith("/api/auth/")) {
    url = url.replace("/api/", "/api/admin/");
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `Ошибка запроса: ${response.status}`);
  return data;
}

function money(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")} ₽`;
}

function dateForInput(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? esc(value)
    : date.toLocaleString("ru-RU");
}

function page(title, columns, rows, actions = "") {
  return `
    <div class="page">
      <div class="page-head">
        <div><h1>${title}</h1></div>
        ${actions ? `<div class="page-actions">${actions}</div>` : ""}
      </div>
      <div class="panel data-panel">
        <table class="data-table">
          <thead>
            <tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>
          </thead>
          <tbody>${
            rows ||
            `<tr><td class="empty-cell" colspan="${columns.length}">Нет данных</td></tr>`
          }</tbody>
        </table>
      </div>
    </div>`;
}

async function orders() {
  const list = await api("/api/orders");
  const rows = list
    .map(
      (row) => `
    <tr>
      <td>
        <div class="car-cell">
          <img class="car-thumb" src="${esc(row.photo_path || "")}" alt="">
          <div class="car-name">
            <strong>${esc(row.license_plate || "Без номера")}</strong>
            <span>${esc(row.brand)} ${esc(row.model)}</span>
          </div>
        </div>
      </td>
      <td>${esc(row.client_name)}</td>
      <td>${esc(row.employee_name || "Не назначен")}</td>
      <td><span class="status s-new">${esc(row.status_name)}</span></td>
      <td><b>${money(row.order_total)}</b></td>
      <td><button class="action-btn" data-action="edit-order" data-id="${Number(
        row.order_id
      )}">Открыть</button></td>
    </tr>`
    )
    .join("");

  return page(
    "Заказы",
    ["Автомобиль", "Клиент", "Мастер", "Статус", "Сумма", ""],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-order">+ Новый заказ</button>'
  );
}

async function clients() {
  const list = await api("/api/clients");
  const rows = list
    .map(
      (item) => `
    <tr>
      <td><b>${esc(item.full_name)}</b></td>
      <td>${esc(item.phone)}</td>
      <td>${esc(item.email || "—")}</td>
      <td>${esc(item.cars || "—")}</td>
    </tr>`
    )
    .join("");

  return page("Клиенты", ["Клиент", "Телефон", "Почта", "Автомобили"], rows);
}

async function cars() {
  const list = await api("/api/cars");
  const rows = list
    .map(
      (item) => `
    <tr>
      <td>
        <div class="car-cell">
          <img class="car-thumb" src="${esc(item.photo_path || "")}" alt="">
          <div class="car-name">
            <strong>${esc(item.brand)} ${esc(item.model)}</strong>
            <span>VIN: ${esc(item.vin || "—")}</span>
          </div>
        </div>
      </td>
      <td><b>${esc(item.license_plate || "—")}</b></td>
      <td>${esc(item.year || "—")}</td>
      <td>${item.mileage != null ? `${esc(item.mileage)} км` : "—"}</td>
      <td>${esc(item.client_name)}</td>
      <td><label class="action-btn">Фото<input type="file" accept="image/jpeg,image/png,image/webp" data-car-photo="${Number(item.car_id)}" hidden></label></td>
    </tr>`
    )
    .join("");

  return page(
    "Машины",
    ["Автомобиль", "Госномер", "Год", "Последний пробег", "Владелец", "Фото"],
    rows
  );
}

async function employees() {
  const list = await api("/api/employees");
  const rows = list
    .map(
      (item) => `
    <tr>
      <td><b>${esc(item.full_name)}</b></td>
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
    ["Сотрудник", "Должность", "Телефон", "Навыки", "Статус", ""],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-employee">+ Добавить сотрудника</button>'
  );
}

async function works() {
  const list = await api("/api/work-types");
  const rows = list
    .map(
      (item) => `
    <tr>
      <td><b>${esc(item.name)}</b></td>
      <td>${money(item.default_price)}</td>
      <td>${
        item.estimated_duration != null
          ? `${esc(item.estimated_duration)} мин`
          : "—"
      }</td>
    </tr>`
    )
    .join("");

  return page("Работы", ["Название работы", "Базовая цена", "Время"], rows);
}

async function parts() {
  const list = await api("/api/parts");
  const rows = list
    .map(
      (item) => `
    <tr>
      <td><b>${esc(item.name)}</b></td>
      <td>${esc(item.part_type || "—")}</td>
      <td>${esc(item.article || "—")}</td>
      <td>${esc(item.manufacturer || "—")}</td>
      <td>${esc(item.stock_quantity)} шт.</td>
      <td>${money(item.price)}</td>
    </tr>`
    )
    .join("");

  return page(
    "Запчасти",
    ["Запчасть", "Тип", "Артикул", "Производитель", "Остаток", "Цена"],
    rows
  );
}

async function payments() {
  const list = await api("/api/payments");
  const rows = list
    .map(
      (item) => `
    <tr>
      <td>${item.payment_date ? dateTime(item.payment_date) : "—"}</td>
      <td>
        <b>#${esc(item.order_id)} · ${esc(
        item.license_plate || "Без номера"
      )} · ${esc(item.brand)} ${esc(item.model)}</b>
        <div class="muted-mini">${esc(item.client_name)}</div>
      </td>
      <td><b>${money(item.amount)}</b></td>
      <td>${esc(item.payment_method || "—")}</td>
    </tr>`
    )
    .join("");

  return page("Оплаты", ["Дата", "Заказ", "Сумма", "Способ"], rows);
}

async function accounts() {
  const list = await api("/api/accounts");
  const roleNames = { admin: "Администратор", client: "Клиент", employee: "Сотрудник" };
  const rows = list.map((item) => `
    <tr>
      <td><b>${esc(item.profile_name || "—")}</b><div class="muted-mini">${esc(item.email)}</div></td>
      <td>${esc(roleNames[item.role] || item.role)}</td>
      <td><span class="status ${Number(item.is_active) ? "s-new" : "s-muted"}">${Number(item.is_active) ? "Активна" : "Отключена"}</span></td>
      <td>${dateTime(item.created_at)}</td>
      <td><button class="action-btn" data-action="toggle-account" data-id="${Number(item.account_id)}" data-active="${Number(item.is_active) ? 0 : 1}">${Number(item.is_active) ? "Отключить" : "Включить"}</button></td>
    </tr>`).join("");
  return page(
    "Доступы пользователей",
    ["Профиль / email", "Роль", "Состояние", "Создана", ""],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-account">+ Создать доступ</button>'
  );
}

const pages = { orders, clients, cars, employees, works, parts, payments, accounts };
let current = "orders";

async function render() {
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
          <select name="client_id"><option value="">Выберите клиента</option>${options.clients.map((item) => `<option value="${Number(item.client_id)}">${esc(item.full_name)} · ${esc(item.phone)}</option>`).join("")}</select>
        </label>
        <label class="app-field app-field-full" id="accountEmployeeField" hidden>Профиль сотрудника
          <select name="employee_id"><option value="">Выберите сотрудника</option>${options.employees.map((item) => `<option value="${Number(item.employee_id)}">${esc(item.full_name)} · ${esc(item.position)}</option>`).join("")}</select>
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
  const modal = modalShell("Новый доступ", "Создание отдельного входа в AutoPro", body);
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
      profile_id: role === "client" ? Number(formData.get("client_id")) : role === "employee" ? Number(formData.get("employee_id")) : null,
      display_name: formData.get("display_name"),
    };
    errorBox.hidden = true;
    submitButton.disabled = true;
    try {
      await api("/api/accounts", { method: "POST", body: JSON.stringify(payload) });
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

document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === current);
  });

  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Загрузка данных…</div>';
  try {
    content.innerHTML = await pages[current]();
  } catch (error) {
    content.innerHTML = `<div class="page"><div class="error-box">${esc(
      error.message
    )}</div></div>`;
  }
}

function ensureUpgradeStyles() {
  if (document.getElementById("upgradeStyles")) return;
  const style = document.createElement("style");
  style.id = "upgradeStyles";
  style.textContent = `
    .page-actions{display:flex;gap:10px;align-items:center}
    .action-btn{border:1px solid #dfe6df;background:#fff;color:#30443a;border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;white-space:nowrap}
    .action-btn:hover{border-color:#a9bd35;background:#f8faed}
    .action-btn-primary{background:#d9f34a;border-color:#d9f34a;color:#17201d}
    .modal-backdrop{position:fixed;inset:0;background:rgba(17,27,22,.58);z-index:100;display:grid;place-items:center;padding:18px;overflow:auto}
    .app-modal{width:min(760px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.25);padding:24px}
    .app-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:20px}
    .app-modal-head h2{margin:0;font:800 22px Manrope,Inter,sans-serif;color:#1c2a23}
    .app-modal-head p{margin:6px 0 0;font-size:11px;color:#839088}
    .app-modal-close{border:0;background:#f1f4f0;border-radius:9px;width:34px;height:34px;font-size:20px;color:#4c5d53}
    .app-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
    .app-field{display:flex;flex-direction:column;gap:6px;min-width:0;font-size:11px;font-weight:700;color:#4a5c51}
    .app-field-full{grid-column:1/-1}
    .app-field input,.app-field select,.app-field textarea{width:100%;border:1px solid #dfe6df;border-radius:8px;padding:10px 11px;background:#fff;color:#27372e;font:12px Inter,Arial,sans-serif;outline:none}
    .app-field textarea{min-height:80px;resize:vertical}
    .app-field input:focus,.app-field select:focus,.app-field textarea:focus{border-color:#a3bc36;box-shadow:0 0 0 3px rgba(217,243,74,.2)}
    .app-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px;padding-top:16px;border-top:1px solid #edf0ed}
    .app-modal-note{background:#f6f8f2;padding:11px 13px;border-radius:9px;color:#68776c;font-size:11px;line-height:1.5;margin:12px 0}
    .work-lines{display:grid;gap:8px}
    .work-line{display:grid;grid-template-columns:minmax(0,1fr) 90px 34px;gap:8px;align-items:center}
    .work-line select,.work-line input{width:100%;border:1px solid #dfe6df;border-radius:8px;padding:9px;background:#fff;font:12px Inter,Arial,sans-serif}
    .work-line-remove{height:34px;border:0;border-radius:8px;background:#fbeeea;color:#a84c37;font-weight:800}
    .skill-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:5px}
    .skill-option{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #e5ebe4;border-radius:8px;font-size:11px;color:#425247;font-weight:500}
    .status.s-muted{background:#edf0ed;color:#7d8980}
    .history-list{display:grid;gap:9px;margin-top:12px}
    .history-item{border-left:2px solid #d9f34a;padding:3px 0 3px 11px;font-size:11px;color:#3f5045}
    .history-item small{display:block;color:#89968d;margin-top:4px}
    .modal-error{background:#fff0ed;border:1px solid #f2c8be;color:#8c3e2d;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:11px}
    @media(max-width:620px){.app-modal{padding:18px}.app-form-grid{grid-template-columns:1fr}.app-field-full{grid-column:auto}.skill-list{grid-template-columns:1fr}.work-line{grid-template-columns:minmax(0,1fr) 74px 32px}.page-actions{width:100%}.page-head{align-items:flex-start;flex-direction:column}}
  `;
  document.head.append(style);
}

function modalShell(title, subtitle, body) {
  ensureUpgradeStyles();
  const wrapper = document.createElement("div");
  wrapper.className = "modal-backdrop";
  wrapper.innerHTML = `
    <section class="app-modal" role="dialog" aria-modal="true">
      <div class="app-modal-head">
        <div><h2>${esc(title)}</h2><p>${esc(
    subtitle || "AutoPro · панель автосервиса"
  )}</p></div>
        <button type="button" class="app-modal-close" data-modal-close aria-label="Закрыть">×</button>
      </div>
      ${body}
    </section>`;
  document.body.append(wrapper);
  wrapper.addEventListener("click", (event) => {
    if (event.target === wrapper || event.target.closest("[data-modal-close]"))
      wrapper.remove();
  });
  return wrapper;
}

function employeeOptions(employees, selectedId = "", includeAuto = false) {
  const active = employees.filter((employee) => Number(employee.is_active));
  const selectedInactive = employees.find(
    (employee) =>
      Number(employee.employee_id) === Number(selectedId) &&
      !Number(employee.is_active)
  );
  const visibleEmployees = selectedInactive
    ? [...active, selectedInactive]
    : active;
  return `${
    includeAuto
      ? '<option value="">Автоматически по навыку и загрузке</option>'
      : '<option value="">Не назначен</option>'
  }
    ${visibleEmployees
      .map(
        (employee) => `
      <option value="${Number(employee.employee_id)}" ${
          Number(selectedId) === Number(employee.employee_id) ? "selected" : ""
        }>
        ${esc(employee.full_name)} · ${esc(employee.position)}
      </option>`
      )
      .join("")}`;
}

function workOptions(workTypes, selectedId = "") {
  return workTypes
    .map(
      (work) => `
    <option value="${Number(work.work_type_id)}" ${
        Number(selectedId) === Number(work.work_type_id) ? "selected" : ""
      }>
      ${esc(work.name)} — ${money(work.default_price)}
    </option>`
    )
    .join("");
}

function workLineHtml(workTypes, item = {}) {
  return `
    <div class="work-line" data-work-row>
      <select data-work-type required>${workOptions(
        workTypes,
        item.work_type_id
      )}</select>
      <input data-work-quantity type="number" min="0.1" max="100" step="0.1" value="${esc(
        item.quantity ?? 1
      )}" aria-label="Количество">
      <button class="work-line-remove" type="button" data-remove-work aria-label="Удалить работу">×</button>
    </div>`;
}

async function openOrderModal(orderId = null) {
  const [options, detail] = await Promise.all([
    api("/api/order-options"),
    orderId ? api(`/api/orders/${orderId}`) : Promise.resolve(null),
  ]);
  const order = detail?.order || null;
  const activeEmployees = options.employees.filter((employee) =>
    Number(employee.is_active)
  );
  if (!orderId && !options.cars.length) {
    alert(
      "В базе пока нет автомобилей. Сначала добавьте автомобиль в таблицу cars и привяжите его к клиенту."
    );
    return;
  }
  if (!orderId && !options.workTypes.length) {
    alert("В справочнике work_types пока нет работ.");
    return;
  }

  const create = !orderId;
  const workRows = create
    ? workLineHtml(options.workTypes, {
        work_type_id: options.workTypes[0]?.work_type_id,
        quantity: 1,
      })
    : detail.works.length
    ? detail.works
        .map(
          (item) =>
            `<div class="app-modal-note">${esc(item.work_name)} · ${esc(
              item.quantity
            )} × ${money(item.price)}</div>`
        )
        .join("")
    : '<div class="app-modal-note">В заказе пока не указаны работы.</div>';

  const body = `
    <form id="orderEditorForm">
      <div class="app-form-grid">
        ${
          create
            ? `
          <label class="app-field app-field-full">Автомобиль
            <select name="car_id" required>
              ${options.cars
                .map(
                  (car) => `
                <option value="${Number(car.car_id)}">${esc(car.brand)} ${esc(
                    car.model
                  )} · ${esc(car.license_plate || "без номера")} · ${esc(
                    car.client_name
                  )}</option>`
                )
                .join("")}
            </select>
          </label>
          <div class="app-field app-field-full">
            <span>Работы в заказе</span>
            <div class="work-lines" id="workLines">${workRows}</div>
            <button type="button" class="action-btn" id="addWorkLine" style="margin-top:8px">+ Добавить работу</button>
          </div>`
            : `
          <div class="app-field app-field-full">
            <span>Автомобиль и клиент</span>
            <div class="app-modal-note"><b>${esc(order.brand)} ${esc(
                order.model
              )}</b> · ${esc(order.license_plate || "без номера")} · ${esc(
                order.client_name
              )}</div>
            <span>Состав заказа</span>${workRows}
          </div>
          <label class="app-field">Статус
            <select name="status_id" required>
              ${options.statuses
                .map(
                  (status) => `
                <option value="${Number(status.status_id)}" ${
                    Number(status.status_id) === Number(order.status_id)
                      ? "selected"
                      : ""
                  }>${esc(status.name)}</option>`
                )
                .join("")}
            </select>
          </label>`
        }
        <label class="app-field">Ответственный сотрудник
          <select name="employee_id">${employeeOptions(
            options.employees,
            order?.employee_id ?? "",
            create
          )}</select>
        </label>
        <label class="app-field">Плановая дата завершения
          <input name="planned_finish_date" type="date" value="${esc(
            dateForInput(order?.planned_finish_date)
          )}">
        </label>
        <label class="app-field">Пробег, км
          <input name="mileage" type="number" min="0" step="1" value="${esc(
            order?.mileage ?? ""
          )}" placeholder="Например, 68450">
        </label>
        <label class="app-field app-field-full">Жалоба / описание проблемы
          <textarea name="complaint" minlength="5" maxlength="5000" required>${esc(
            order?.complaint || ""
          )}</textarea>
        </label>
        ${
          !create
            ? `
          <label class="app-field app-field-full">Результат диагностики
            <textarea name="diagnosis" maxlength="10000">${esc(
              order?.diagnosis || ""
            )}</textarea>
          </label>
          <label class="app-field app-field-full">Комментарий
            <textarea name="comment" maxlength="10000">${esc(
              order?.comment || ""
            )}</textarea>
          </label>`
            : ""
        }
      </div>
      ${
        create
          ? '<div class="app-modal-note">Мастер будет подобран автоматически по навыкам и количеству активных заказов. Чтобы автоматическое назначение работало, у сотрудников должны быть настроены навыки.</div>'
          : `
        <div class="history-list">
          <b>История изменений</b>
          ${
            detail.events.length
              ? detail.events
                  .map(
                    (event) => `
            <div class="history-item">${esc(event.message)}<small>${esc(
                      event.actor_name
                    )} · ${dateTime(event.created_at)}</small></div>`
                  )
                  .join("")
              : '<div class="muted-mini">История пока пуста.</div>'
          }
        </div>`
      }
      <div id="orderFormError" class="modal-error" hidden></div>
      <div class="app-modal-actions">
        <button type="button" class="action-btn" data-modal-close>Отмена</button>
        <button type="submit" class="action-btn action-btn-primary">${
          create ? "Создать заказ" : "Сохранить изменения"
        }</button>
      </div>
    </form>`;

  const modal = modalShell(
    create ? "Новый заказ" : `Заказ №${order.order_id}`,
    create
      ? "Создание заказа в MariaDB autoservice"
      : `Клиент: ${order.client_name} · ${order.status_name}`,
    body
  );

  const form = modal.querySelector("#orderEditorForm");
  const workLines = modal.querySelector("#workLines");
  modal.querySelector("#addWorkLine")?.addEventListener("click", () => {
    workLines.insertAdjacentHTML(
      "beforeend",
      workLineHtml(options.workTypes, {
        work_type_id: options.workTypes[0]?.work_type_id,
        quantity: 1,
      })
    );
  });
  modal.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-work]");
    if (!removeButton) return;
    const rows = workLines.querySelectorAll("[data-work-row]");
    if (rows.length <= 1) {
      alert("В заказе должна остаться хотя бы одна работа.");
      return;
    }
    removeButton.closest("[data-work-row]").remove();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector("#orderFormError");
    submitButton.disabled = true;
    submitButton.textContent = "Сохранение…";
    errorBox.hidden = true;

    const formData = new FormData(form);
    const payload = {
      employee_id: formData.get("employee_id") || null,
      planned_finish_date: formData.get("planned_finish_date") || null,
      mileage: formData.get("mileage") || null,
      complaint: formData.get("complaint"),
      actor_name: "Администратор AutoPro",
    };

    try {
      if (create) {
        payload.car_id = Number(formData.get("car_id"));
        payload.works = [...workLines.querySelectorAll("[data-work-row]")].map(
          (row) => ({
            work_type_id: Number(row.querySelector("[data-work-type]").value),
            quantity: Number(row.querySelector("[data-work-quantity]").value),
          })
        );
        await api("/api/orders", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        payload.status_id = Number(formData.get("status_id"));
        payload.diagnosis = formData.get("diagnosis");
        payload.comment = formData.get("comment");
        await api(`/api/orders/${orderId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      modal.remove();
      await render();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = create
        ? "Создать заказ"
        : "Сохранить изменения";
    }
  });
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
      is_active: form.querySelector('[name="is_active"]').checked ? 1 : 0,
      work_type_ids: formData.getAll("work_type_ids").map(Number),
    };

    try {
      await api(
        employee ? `/api/employees/${employee.employee_id}` : "/api/employees",
        {
          method: employee ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );
      modal.remove();
      await render();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submitButton.disabled = false;
    }
  });
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    current = item.dataset.page;
    render();
    document.getElementById("sidebar").classList.remove("open");
  });
});

document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document.getElementById("content").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  try {
    if (button.dataset.action === "create-order") await openOrderModal();
    if (button.dataset.action === "edit-order")
      await openOrderModal(Number(button.dataset.id));
    if (button.dataset.action === "create-employee") await openEmployeeModal();
    if (button.dataset.action === "edit-employee")
      await openEmployeeModal(Number(button.dataset.id));
    if (button.dataset.action === "create-account") await openAccountModal();
    if (button.dataset.action === "toggle-account")
      await toggleAccount(Number(button.dataset.id), Number(button.dataset.active));
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("content").addEventListener("change", async (event) => {
  const input = event.target.closest("[data-car-photo]");
  if (!input?.files?.[0]) return;
  const formData = new FormData();
  formData.append("photo", input.files[0]);
  try {
    await api(`/api/cars/${Number(input.dataset.carPhoto)}/photo`, {
      method: "POST",
      body: formData,
    });
    await render();
    alert("Фотография автомобиля обновлена.");
  } catch (error) {
    alert(error.message);
  }
});

const logoutButton = document.getElementById("logoutBtn");
logoutButton?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  location.assign("/login");
});

(async function initializeAdmin() {
  try {
    const { user } = await api("/api/auth/me");
    if (user.role !== "admin") return location.assign("/login");
    if (logoutButton) logoutButton.textContent = initialsForAdmin(user.name);
    if (logoutButton) logoutButton.title = `Выйти · ${user.name}`;
    const date = document.querySelector(".date");
    if (date) date.textContent = new Date().toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    await render();
  } catch {
    location.assign("/admin/login");
  }
})();

function initialsForAdmin(name) {
  return String(name || "АП").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}
