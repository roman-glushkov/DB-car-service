// ---------- утилиты ----------
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[
        c
      ])
  );

const api = (url) => fetch(url).then((r) => r.json());

// ---------- обёртка страницы ----------
function page(title, columns, rows) {
  return `
    <div class="page">
      <div class="page-head">
        <div><h1>${title}</h1></div>
      </div>
      <div class="panel data-panel">
        <table class="data-table">
          <thead>
            <tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ---------- ЗАКАЗЫ ----------
async function orders() {
  const list = await api("/api/orders");
  const rows = list.length
    ? list
        .map(
          (r) => `
        <tr>
          <td>
            <div class="car-cell">
              <img class="car-thumb" src="${esc(r.photo_path || "")}">
              <div class="car-name">
                <strong>${esc(r.license_plate || "Без номера")}</strong>
                <span>${esc(r.brand)} ${esc(r.model)}</span>
              </div>
            </div>
          </td>
          <td>${esc(r.client_name)}</td>
          <td><span class="status s-new">${esc(r.status_name)}</span></td>
          <td><b>${r.order_total} ₽</b></td>
        </tr>`
        )
        .join("")
    : "";

  return page("Заказы", ["Автомобиль", "Клиент", "Статус", "Сумма"], rows);
}

// ---------- КЛИЕНТЫ ----------
async function clients() {
  const list = await api("/api/clients");
  const rows = list.length
    ? list
        .map(
          (x) => `
        <tr>
          <td><b>${esc(x.full_name)}</b></td>
          <td>${esc(x.phone)}</td>
          <td>${esc(x.email || "—")}</td>
          <td>${esc(x.cars || "—")}</td>
        </tr>`
        )
        .join("")
    : "";

  return page("Клиенты", ["Клиент", "Телефон", "Почта", "Автомобили"], rows);
}

// ---------- МАШИНЫ ----------
async function cars() {
  const list = await api("/api/cars");
  const rows = list.length
    ? list
        .map(
          (x) => `
        <tr>
          <td>
            <div class="car-cell">
              <img class="car-thumb" src="${esc(x.photo_path || "")}">
              <div class="car-name">
                <strong>${esc(x.brand)} ${esc(x.model)}</strong>
                <span>VIN: ${esc(x.vin || "—")}</span>
              </div>
            </div>
          </td>
          <td><b>${esc(x.license_plate || "—")}</b></td>
          <td>${esc(x.year || "—")}</td>
          <td>${x.mileage != null ? `${x.mileage} км` : "—"}</td>
          <td>${esc(x.client_name)}</td>
        </tr>`
        )
        .join("")
    : "";

  return page(
    "Машины",
    ["Автомобиль", "Госномер", "Год", "Последний пробег", "Владелец"],
    rows
  );
}

// ---------- СОТРУДНИКИ ----------
async function employees() {
  const list = await api("/api/employees");
  const rows = list.length
    ? list
        .map(
          (x) => `
        <tr>
          <td><b>${esc(x.full_name)}</b></td>
          <td>${esc(x.position)}</td>
          <td>${esc(x.phone || "—")}</td>
          <td>
            <span class="status s-new">
              ${Number(x.is_active) ? "Работает" : "Неактивен"}
            </span>
          </td>
        </tr>`
        )
        .join("")
    : "";

  return page(
    "Сотрудники",
    ["Сотрудник", "Должность", "Телефон", "Статус"],
    rows
  );
}

// ---------- РАБОТЫ ----------
async function works() {
  const list = await api("/api/work-types");
  const rows = list.length
    ? list
        .map(
          (x) => `
        <tr>
          <td><b>${esc(x.name)}</b></td>
          <td>${x.default_price} ₽</td>
          <td>${
            x.estimated_duration != null ? `${x.estimated_duration} мин` : "—"
          }</td>
        </tr>`
        )
        .join("")
    : "";

  return page("Работы", ["Название работы", "Базовая цена", "Время"], rows);
}

// ---------- ЗАПЧАСТИ ----------
async function parts() {
  const list = await api("/api/parts");
  const rows = list.length
    ? list
        .map(
          (x) => `
        <tr>
          <td><b>${esc(x.name)}</b></td>
          <td>${esc(x.part_type || "—")}</td>
          <td>${esc(x.article || "—")}</td>
          <td>${esc(x.manufacturer || "—")}</td>
          <td>${esc(x.stock_quantity)} шт.</td>
          <td>${x.price} ₽</td>
        </tr>`
        )
        .join("")
    : "";

  return page(
    "Запчасти",
    ["Запчасть", "Тип", "Артикул", "Производитель", "Остаток", "Цена"],
    rows
  );
}

// ---------- ОПЛАТЫ ----------
async function payments() {
  const list = await api("/api/payments");
  const rows = list.length
    ? list
        .map(
          (x) => `
        <tr>
          <td>${x.payment_date ? x.payment_date.slice(0, 16) : "—"}</td>
          <td>
            <b>#${x.order_id} · ${esc(x.license_plate || "Без номера")} · ${esc(
            x.brand
          )} ${esc(x.model)}</b>
            <div class="muted-mini">${esc(x.client_name)}</div>
          </td>
          <td><b>${x.amount} ₽</b></td>
          <td>${esc(x.payment_method || "—")}</td>
        </tr>`
        )
        .join("")
    : "";

  return page("Оплаты", ["Дата", "Заказ", "Сумма", "Способ"], rows);
}

// ---------- роутинг ----------
const pages = { orders, clients, cars, employees, works, parts, payments };
let current = "orders";

async function render() {
  document
    .querySelectorAll(".nav-item")
    .forEach((x) => x.classList.toggle("active", x.dataset.page === current));

  const content = document.getElementById("content");
  content.innerHTML = `<div class="loading">Загрузка данных…</div>`;

  try {
    content.innerHTML = await pages[current]();
  } catch (e) {
    content.innerHTML = `
      <div class="page">
        <div class="error-box">${esc(e.message)}</div>
      </div>`;
  }
}

// ---------- старт ----------
document.querySelectorAll(".nav-item").forEach((x) =>
  x.addEventListener("click", () => {
    current = x.dataset.page;
    render();
    document.getElementById("sidebar").classList.remove("open");
  })
);

document
  .getElementById("menuBtn")
  .addEventListener("click", () =>
    document.getElementById("sidebar").classList.toggle("open")
  );

render();
