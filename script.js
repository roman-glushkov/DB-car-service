const pages = {
  dashboard: { title: "Главная", render: dashboard },
  orders: { title: "Заказы", render: orders },
  clients: { title: "Клиенты", render: clients },
  cars: { title: "Машины", render: cars },
  employees: { title: "Сотрудники", render: employees },
  works: { title: "Работы", render: works },
  parts: { title: "Запчасти", render: parts },
  payments: { title: "Оплаты", render: payments },
  stats: { title: "Статистика", render: stats },
};

const imgs = [
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1525609004556-c46c7cf7cfca?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80",
];
const A = (i) => imgs[i % imgs.length];
const carPhoto = (x, i = 0) => x?.photo_path || A(i);
let current = "dashboard";
let cache = {
  clients: [],
  cars: [],
  employees: [],
  statuses: [],
  works: [],
  parts: [],
  orders: [],
};

function esc(v) {
  return String(v ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[
        c
      ])
  );
}
function money(v) {
  return `${Number(v || 0).toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  })} ₽`;
}
function dateFmt(v, withTime = false) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return esc(v);
  return d.toLocaleString(
    "ru-RU",
    withTime
      ? { dateStyle: "short", timeStyle: "short" }
      : { dateStyle: "short" }
  );
}
function statusClass(s) {
  if (s === "Готов" || s === "Выдан") return "s-done";
  if (s === "В работе") return "s-work";
  if (s === "Диагностика") return "s-diag";
  if (s === "Ожидание запчастей" || s === "Отменён") return "s-wait";
  return "s-new";
}
async function api(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const opts = {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  };
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
async function loadRefs() {
  const [clients, cars, employees, statuses, works, parts, orders] =
    await Promise.all([
      api("/api/clients"),
      api("/api/cars"),
      api("/api/employees"),
      api("/api/statuses"),
      api("/api/work-types"),
      api("/api/parts"),
      api("/api/orders"),
    ]);
  Object.assign(cache, {
    clients,
    cars,
    employees,
    statuses,
    works,
    parts,
    orders,
  });
}
function shell(inner, sub = "") {
  return `<div class="page"><div class="page-head"><div><div class="eyebrow">${esc(
    sub || "рабочее место администратора"
  )}</div><h1>${esc(
    pages[current].title
  )}</h1><div class="page-sub">Управление автосервисом · данные из MariaDB</div></div>${
    current !== "stats"
      ? `<button class="btn btn-lime" onclick="openCreate()">＋ Добавить</button>`
      : ""
  }</div>${inner}</div>`;
}
function metric(t, v, c, b, ic) {
  return `<div class="metric"><div class="metric-top"><span>${esc(
    t
  )}</span><span class="metric-icon">${esc(
    ic
  )}</span></div><div class="metric-value">${esc(
    v
  )}</div><div class="metric-bottom"><span>${esc(c)}</span> ${esc(
    b
  )}</div></div>`;
}
function emptyRow(cols, text = "Пока нет данных") {
  return `<tr><td colspan="${cols}" class="empty-cell">${esc(text)}</td></tr>`;
}

async function dashboard() {
  const d = await api("/api/dashboard");
  const rows = d.recent.length
    ? d.recent
        .map(
          (r, i) => `<tr>
    <td><div class="car-cell"><img class="car-thumb" src="${esc(
      carPhoto(r, i)
    )}"><div class="car-name"><strong>${esc(
            r.license_plate || "Без номера"
          )}</strong><span>${esc(r.brand)} ${esc(
            r.model
          )}</span></div></div></td>
    <td>${esc(r.client_name)}</td><td><span class="status ${statusClass(
            r.status_name
          )}">${esc(r.status_name)}</span></td>
    <td><b>${money(
      r.order_total
    )}</b></td><td><button class="tiny-btn" onclick="openOrder(${
            r.order_id
          })">Открыть</button></td></tr>`
        )
        .join("")
    : emptyRow(5);
  return `<div class="hero-mini"><div><h2>AutoPro подключён к базе</h2><p>Данные на этой странице формируются запросами к MariaDB.</p></div><div class="quick-actions"><button class="btn btn-lime" onclick="openCreate()">＋ Новый заказ</button><button class="btn btn-light" onclick="go('cars')">⌕ Найти автомобиль</button></div></div>
  <div class="cards">${metric(
    "Активные заказы",
    d.active_orders,
    `${d.ready_orders} готово`,
    "к выдаче",
    "▤"
  )}${metric(
    "Выручка за месяц",
    money(d.month_revenue),
    "по оплатам",
    "текущий месяц",
    "₽"
  )}${metric("Автомобили", d.cars, "в базе", "зарегистрировано", "▣")}${metric(
    "Низкий остаток",
    d.low_stock,
    "меньше 5 шт.",
    "запчасти",
    "◇"
  )}</div>
  <div class="panel section-space"><div class="panel-head"><div class="panel-title">Последние заказы</div><button class="panel-link" onclick="go('orders')">Все заказы →</button></div><table class="orders-table"><thead><tr><th>Автомобиль</th><th>Клиент</th><th>Статус</th><th>Сумма</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function orders() {
  const [list, statuses, employees] = await Promise.all([
    api("/api/orders"),
    api("/api/statuses"),
    api("/api/employees"),
  ]);
  cache.orders = list;
  cache.statuses = statuses;
  cache.employees = employees;
  return renderOrdersPage(list, statuses, employees);
}
function renderOrdersPage(
  list,
  statuses = cache.statuses,
  employees = cache.employees
) {
  const rows = list.length
    ? list
        .map(
          (r, i) => `<tr>
    <td><div class="car-cell"><img class="car-thumb" src="${esc(
      carPhoto(r, i)
    )}"><div class="car-name"><strong>${esc(
            r.license_plate || "Без номера"
          )}</strong><span>${esc(r.brand)} ${esc(
            r.model
          )}</span></div></div></td>
    <td>${esc(r.client_name)}</td><td><span class="status ${statusClass(
            r.status_name
          )}">${esc(r.status_name)}</span></td>
    <td><b>${money(r.order_total)}</b><div class="muted-mini">Оплачено: ${money(
            r.paid_total
          )}</div></td>
    <td><button class="tiny-btn" onclick="openOrder(${
      r.order_id
    })">Открыть</button></td></tr>`
        )
        .join("")
    : emptyRow(5);
  return `<div class="searchbar"><input id="ordersSearch" class="search" placeholder="⌕ Поиск по номеру, VIN или клиенту"><div class="filters"><select id="ordersStatus" class="select"><option value="">Все статусы</option>${statuses
    .map((x) => `<option value="${x.status_id}">${esc(x.name)}</option>`)
    .join(
      ""
    )}</select><select id="ordersEmployee" class="select"><option value="">Все мастера</option>${employees
    .map((x) => `<option value="${x.employee_id}">${esc(x.full_name)}</option>`)
    .join(
      ""
    )}</select></div></div><div class="panel data-panel"><table class="orders-table"><thead><tr><th>Автомобиль</th><th>Клиент</th><th>Статус</th><th>Сумма</th><th></th></tr></thead><tbody id="ordersBody">${rows}</tbody></table></div>`;
}

async function clients() {
  const data = await api("/api/clients");
  cache.clients = data;
  const rows = data.length
    ? data
        .map(
          (x) =>
            `<tr><td><div class="person"><div class="person-avatar">${esc(
              x.full_name
                .split(" ")
                .map((y) => y[0])
                .join("")
                .slice(0, 2)
            )}</div><b>${esc(x.full_name)}</b></div></td><td>${esc(
              x.phone
            )}</td><td>${esc(x.email || "—")}</td><td>${esc(
              x.cars || "—"
            )}</td><td><button class="tiny-btn" onclick="go('cars')">Машины: ${
              x.car_count
            }</button></td></tr>`
        )
        .join("")
    : emptyRow(5);
  return shell(
    `<div class="searchbar"><input id="clientsSearch" class="search" placeholder="⌕ Поиск по имени или телефону"></div><div class="panel data-panel"><table class="data-table"><thead><tr><th>Клиент</th><th>Телефон</th><th>Почта</th><th>Автомобили</th><th></th></tr></thead><tbody id="clientsBody">${rows}</tbody></table></div>`
  );
}

async function cars() {
  const data = await api("/api/cars");
  cache.cars = data;
  const rows = renderCarRows(data);
  return shell(
    `<div class="searchbar search-grid"><input id="carsSearch" class="search" placeholder="⌕ Госномер, марка или владелец"><input id="carsModelSearch" class="search" placeholder="Модель, например X5"><input id="carsVinSearch" class="search" maxlength="17" placeholder="VIN"></div><div class="panel data-panel"><table class="data-table"><thead><tr><th>Автомобиль</th><th>Госномер</th><th>Год</th><th>Последний пробег</th><th>Владелец</th><th></th></tr></thead><tbody id="carsBody">${rows}</tbody></table></div>`
  );
}
function renderCarRows(data) {
  return data.length
    ? data
        .map(
          (x, i) =>
            `<tr><td><div class="car-cell"><img class="car-thumb" src="${esc(
              carPhoto(x, i)
            )}" alt="${esc(
              `${x.brand} ${x.model}`
            )}"><div class="car-name"><strong>${esc(x.brand)} ${esc(
              x.model
            )}</strong><span>VIN: ${esc(
              x.vin || "—"
            )}</span></div></div></td><td><b>${esc(
              x.license_plate || "—"
            )}</b></td><td>${esc(x.year || "—")}</td><td>${
              x.mileage != null
                ? `${Number(x.mileage).toLocaleString("ru-RU")} км`
                : "—"
            }</td><td>${esc(
              x.client_name
            )}</td><td><div class="row-actions"><button class="tiny-btn" onclick="showCarHistory('${esc(
              x.license_plate || x.vin || x.brand
            )}')">История</button><button class="tiny-btn" onclick="changeCarPhoto(${
              x.car_id
            })">Фото</button></div></td></tr>`
        )
        .join("")
    : emptyRow(6);
}

async function employees() {
  const d = await api("/api/employees");
  cache.employees = d;
  const rows = d.length
    ? d
        .map(
          (x) =>
            `<tr><td><div class="person"><div class="person-avatar">${esc(
              x.full_name
                .split(" ")
                .map((y) => y[0])
                .join("")
                .slice(0, 2)
            )}</div><b>${esc(x.full_name)}</b></div></td><td>${esc(
              x.position
            )}</td><td>${esc(x.phone || "—")}</td><td><span class="status ${
              Number(x.is_active) ? "s-done" : "s-wait"
            }">${
              Number(x.is_active) ? "Работает" : "Неактивен"
            }</span></td><td></td></tr>`
        )
        .join("")
    : emptyRow(5);
  return shell(
    `<div class="panel data-panel"><table class="data-table"><thead><tr><th>Сотрудник</th><th>Должность</th><th>Телефон</th><th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

async function works() {
  const d = await api("/api/work-types");
  cache.works = d;
  const rows = d.length
    ? d
        .map(
          (x) =>
            `<tr><td><b>${esc(x.name)}</b></td><td>${money(
              x.default_price
            )}</td><td>${
              x.estimated_duration != null
                ? `${esc(x.estimated_duration)} мин`
                : "—"
            }</td><td></td></tr>`
        )
        .join("")
    : emptyRow(4);
  return shell(
    `<div class="panel data-panel"><table class="data-table"><thead><tr><th>Название работы</th><th>Базовая цена</th><th>Время</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

async function parts() {
  const d = await api("/api/parts");
  cache.parts = d;
  const rows = renderPartRows(d);
  return shell(
    `<div class="searchbar search-grid"><input id="partsNameSearch" class="search" placeholder="Название"><input id="partsTypeSearch" class="search" placeholder="Тип, например Фильтр"><input id="partsArticleSearch" class="search" placeholder="Артикул / номер"></div><div class="panel data-panel"><table class="data-table"><thead><tr><th>Запчасть</th><th>Тип</th><th>Артикул</th><th>Производитель</th><th>Остаток</th><th>Цена</th></tr></thead><tbody id="partsBody">${rows}</tbody></table></div>`
  );
}
function renderPartRows(data) {
  return data.length
    ? data
        .map(
          (x) =>
            `<tr><td><b>${esc(x.name)}</b></td><td>${esc(
              x.part_type || "—"
            )}</td><td>${esc(x.article || "—")}</td><td>${esc(
              x.manufacturer || "—"
            )}</td><td class="${
              Number(x.stock_quantity) < 5 ? "stock-low" : ""
            }">${esc(x.stock_quantity)} шт.</td><td>${money(x.price)}</td></tr>`
        )
        .join("")
    : emptyRow(6);
}

async function payments() {
  const d = await api("/api/payments");
  const today = new Date().toISOString().slice(0, 10);
  const todaySum = d
    .filter((x) => String(x.payment_date).slice(0, 10) === today)
    .reduce((s, x) => s + Number(x.amount), 0);
  const monthSum = d
    .filter((x) => String(x.payment_date).slice(0, 7) === today.slice(0, 7))
    .reduce((s, x) => s + Number(x.amount), 0);
  const rows = d.length
    ? d
        .map(
          (x) =>
            `<tr><td>${dateFmt(x.payment_date, true)}</td><td><b>#${
              x.order_id
            } · ${esc(x.license_plate || "Без номера")} · ${esc(x.brand)} ${esc(
              x.model
            )}</b><div class="muted-mini">${esc(
              x.client_name
            )}</div></td><td><b>${money(x.amount)}</b></td><td>${esc(
              x.payment_method || "—"
            )}</td></tr>`
        )
        .join("")
    : emptyRow(4);
  return shell(
    `<div class="cards">${metric(
      "За сегодня",
      money(todaySum),
      "факт",
      "по платежам",
      "₽"
    )}${metric(
      "За месяц",
      money(monthSum),
      "факт",
      "по платежам",
      "₽"
    )}</div><div class="panel data-panel"><table class="data-table"><thead><tr><th>Дата</th><th>Заказ</th><th>Сумма</th><th>Способ</th></tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

async function stats() {
  const d = await api("/api/stats");
  const months = d.months || [];
  const max = Math.max(1, ...months.map((x) => Number(x.revenue)));
  const bars = months.length
    ? months
        .map(
          (x) =>
            `<div class="bar" style="height:${Math.max(
              5,
              (Number(x.revenue) / max) * 100
            )}%"><span>${esc(x.month.slice(5))}</span></div>`
        )
        .join("")
    : `<div class="empty-chart">Нет оплат для графика</div>`;
  const works = d.popular_works?.length
    ? d.popular_works
        .map(
          (x, i) =>
            `<div class="rank-row"><b>0${i + 1}</b><span>${esc(
              x.name
            )}</span><strong>${Number(x.count_value).toLocaleString(
              "ru-RU"
            )}</strong></div>`
        )
        .join("")
    : `<div class="empty-cell">Пока нет выполненных работ</div>`;
  return shell(
    `<div class="cards">${metric(
      "Выручка",
      money(d.summary.revenue),
      "текущий месяц",
      "по оплатам",
      "₽"
    )}${metric(
      "Заказов",
      d.summary.orders_count,
      "текущий месяц",
      "создано",
      "▤"
    )}${metric(
      "Средний чек",
      money(d.summary.avg_check),
      "расчёт",
      "за заказ",
      "₽"
    )}</div><div class="panel section-space"><div class="panel-head"><div><div class="panel-title">Выручка по месяцам</div><div class="page-sub">Реальные данные из payments</div></div></div><div class="chart">${bars}</div></div><div class="panel section-space"><div class="panel-head"><div class="panel-title">Самые частые работы</div></div>${works}</div>`,
    "аналитика"
  );
}

async function render() {
  const content = document.getElementById("content");
  document.getElementById("pageTitle").textContent = pages[current].title;
  document
    .querySelectorAll(".nav-item")
    .forEach((x) => x.classList.toggle("active", x.dataset.page === current));
  content.innerHTML = `<div class="loading">Загрузка данных…</div>`;
  try {
    content.innerHTML = await pages[current].render();
    bindPageEvents();
  } catch (e) {
    content.innerHTML = `<div class="page"><div class="error-box"><b>Не удалось получить данные из API.</b><br>${esc(
      e.message
    )}<br><br>Проверь, что запущен <code>node server.js</code> и MariaDB.</div></div>`;
  }
}
function go(p) {
  current = p;
  render();
  document.getElementById("sidebar").classList.remove("open");
}

function debounce(fn, delay = 250) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), delay);
  };
}
function bindPageEvents() {
  const ordersSearch = document.getElementById("ordersSearch");
  const ordersStatus = document.getElementById("ordersStatus");
  const ordersEmployee = document.getElementById("ordersEmployee");
  if (ordersSearch) {
    const refresh = debounce(async () => {
      const qs = new URLSearchParams();
      if (ordersSearch.value) qs.set("q", ordersSearch.value);
      if (ordersStatus.value) qs.set("status_id", ordersStatus.value);
      if (ordersEmployee.value) qs.set("employee_id", ordersEmployee.value);
      const list = await api(`/api/orders?${qs}`);
      const tmp = document.createElement("div");
      tmp.innerHTML = renderOrdersPage(list);
      document.getElementById("ordersBody").innerHTML =
        tmp.querySelector("#ordersBody").innerHTML;
    });
    ordersSearch.addEventListener("input", refresh);
    ordersStatus.addEventListener("change", refresh);
    ordersEmployee.addEventListener("change", refresh);
  }
  const clientSearch = document.getElementById("clientsSearch");
  if (clientSearch)
    clientSearch.addEventListener(
      "input",
      debounce(async () => {
        const data = await api(
          `/api/clients?q=${encodeURIComponent(clientSearch.value)}`
        );
        document.getElementById("clientsBody").innerHTML = data.length
          ? data
              .map(
                (x) =>
                  `<tr><td><div class="person"><div class="person-avatar">${esc(
                    x.full_name.slice(0, 2)
                  )}</div><b>${esc(x.full_name)}</b></div></td><td>${esc(
                    x.phone
                  )}</td><td>${esc(x.email || "—")}</td><td>${esc(
                    x.cars || "—"
                  )}</td><td></td></tr>`
              )
              .join("")
          : emptyRow(5);
      })
    );

  const carInputs = ["carsSearch", "carsModelSearch", "carsVinSearch"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (carInputs.length) {
    const refreshCars = debounce(async () => {
      const qs = new URLSearchParams();
      const q = document.getElementById("carsSearch")?.value.trim();
      const model = document.getElementById("carsModelSearch")?.value.trim();
      const vin = document
        .getElementById("carsVinSearch")
        ?.value.trim()
        .toUpperCase();
      if (q) qs.set("q", q);
      if (model) qs.set("model", model);
      if (vin) qs.set("vin", vin);
      document.getElementById("carsBody").innerHTML = renderCarRows(
        await api(`/api/cars?${qs}`)
      );
    });
    carInputs.forEach((el) => el.addEventListener("input", refreshCars));
  }

  const partInputs = [
    "partsNameSearch",
    "partsTypeSearch",
    "partsArticleSearch",
  ]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (partInputs.length) {
    const refreshParts = debounce(async () => {
      const qs = new URLSearchParams();
      const name = document.getElementById("partsNameSearch")?.value.trim();
      const type = document.getElementById("partsTypeSearch")?.value.trim();
      const article = document
        .getElementById("partsArticleSearch")
        ?.value.trim();
      if (name) qs.set("name", name);
      if (type) qs.set("type", type);
      if (article) qs.set("article", article);
      document.getElementById("partsBody").innerHTML = renderPartRows(
        await api(`/api/parts?${qs}`)
      );
    });
    partInputs.forEach((el) => el.addEventListener("input", refreshParts));
  }
}

function field(label, name, type = "text", extra = "") {
  return `<div class="field"><label>${esc(label)}</label><input name="${esc(
    name
  )}" type="${esc(type)}" ${extra}></div>`;
}
function selectField(
  label,
  name,
  items,
  valueKey,
  textKey,
  placeholder = "Выберите",
  required = false
) {
  return `<div class="field"><label>${esc(label)}</label><select name="${esc(
    name
  )}" ${required ? "required" : ""}><option value="">${esc(
    placeholder
  )}</option>${items
    .map(
      (x) => `<option value="${esc(x[valueKey])}">${esc(x[textKey])}</option>`
    )
    .join("")}</select></div>`;
}
async function openCreate() {
  try {
    await loadRefs();
  } catch (e) {
    showToast(e.message);
    return;
  }
  let title = "",
    body = "";
  if (current === "dashboard" || current === "orders") {
    title = "Новый заказ";
    body = `${selectField(
      "Автомобиль",
      "car_id",
      cache.cars,
      "car_id",
      "license_plate",
      "Выберите автомобиль",
      true
    )}${selectField(
      "Ответственный",
      "employee_id",
      cache.employees.filter((x) => Number(x.is_active)),
      "employee_id",
      "full_name",
      "Не назначен"
    )}${selectField(
      "Статус",
      "status_id",
      cache.statuses,
      "status_id",
      "name",
      "Принят"
    )}${field("Пробег, км", "mileage", "number", 'min="0" step="1"')}${field(
      "Плановая дата",
      "planned_finish_date",
      "date"
    )}<div class="field full"><label>Жалоба клиента</label><textarea name="complaint" maxlength="3000"></textarea></div>`;
  } else if (current === "clients") {
    title = "Новый клиент";
    body = `${field(
      "ФИО",
      "full_name",
      "text",
      'required minlength="2" maxlength="150"'
    )}${field(
      "Телефон",
      "phone",
      "tel",
      'required minlength="7" maxlength="20" pattern="[+()0-9 -]{7,20}" title="Телефон: цифры, +, пробелы, скобки и дефисы"'
    )}${field("Email", "email", "email", 'maxlength="100"')}`;
  } else if (current === "cars") {
    const maxYear = new Date().getFullYear() + 1;
    title = "Новый автомобиль";
    body = `${selectField(
      "Владелец",
      "client_id",
      cache.clients,
      "client_id",
      "full_name",
      "Выберите владельца",
      true
    )}${field("Марка", "brand", "text", 'required maxlength="50"')}${field(
      "Модель",
      "model",
      "text",
      'required maxlength="50"'
    )}${field("Госномер", "license_plate", "text", 'maxlength="15"')}${field(
      "VIN",
      "vin",
      "text",
      'minlength="17" maxlength="17" pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" title="VIN: ровно 17 латинских букв/цифр, без I, O, Q" oninput="this.value=this.value.toUpperCase()"'
    )}${field(
      "Год",
      "year",
      "number",
      `min="1886" max="${maxYear}" step="1"`
    )}${field(
      "Фотография",
      "photo",
      "file",
      'accept="image/jpeg,image/png,image/webp"'
    )}`;
  } else if (current === "employees") {
    title = "Новый сотрудник";
    body = `${field(
      "ФИО",
      "full_name",
      "text",
      'required minlength="2" maxlength="150"'
    )}${field(
      "Должность",
      "position",
      "text",
      'required maxlength="50"'
    )}${field(
      "Телефон",
      "phone",
      "tel",
      'maxlength="20" pattern="[+()0-9 -]{7,20}"'
    )}<div class="field"><label>Статус</label><select name="is_active"><option value="1">Работает</option><option value="0">Неактивен</option></select></div>`;
  } else if (current === "works") {
    title = "Новый вид работы";
    body = `${field(
      "Название",
      "name",
      "text",
      'required maxlength="150"'
    )}${field(
      "Базовая цена",
      "default_price",
      "number",
      'min="0" step="0.01" required'
    )}${field(
      "Время, мин",
      "estimated_duration",
      "number",
      'min="1" step="1"'
    )}`;
  } else if (current === "parts") {
    title = "Новая запчасть";
    body = `${field(
      "Название",
      "name",
      "text",
      'required maxlength="150"'
    )}${field("Тип", "part_type", "text", 'maxlength="100"')}${field(
      "Артикул / номер",
      "article",
      "text",
      'maxlength="50"'
    )}${field(
      "Производитель",
      "manufacturer",
      "text",
      'maxlength="100"'
    )}${field(
      "Остаток",
      "stock_quantity",
      "number",
      'min="0" step="1" value="0"'
    )}${field("Цена", "price", "number", 'min="0" step="0.01" required')}`;
  } else if (current === "payments") {
    title = "Новая оплата";
    body = `${selectField(
      "Заказ",
      "order_id",
      cache.orders,
      "order_id",
      "order_id",
      "Выберите заказ",
      true
    )}${field(
      "Сумма",
      "amount",
      "number",
      'min="0.01" step="0.01" required'
    )}<div class="field"><label>Способ оплаты</label><select name="payment_method"><option>Банковская карта</option><option>Наличные</option><option>Перевод</option></select></div>`;
  } else return;
  document.getElementById("modalBody").innerHTML = `<h2>${esc(
    title
  )}</h2><form id="createForm"><div class="form-grid">${body}</div><div class="modal-actions"><button type="button" class="btn btn-light" onclick="closeModal()">Отмена</button><button class="btn btn-lime" type="submit">Сохранить</button></div></form>`;
  document.getElementById("modal").classList.add("open");
  document
    .getElementById("createForm")
    .addEventListener("submit", submitCreate);
}
async function submitCreate(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.reportValidity()) return;
  const fd = new FormData(form);
  const photo = current === "cars" ? fd.get("photo") : null;
  fd.delete("photo");
  const data = Object.fromEntries(fd.entries());
  let endpoint;
  if (current === "dashboard" || current === "orders") endpoint = "/api/orders";
  if (current === "clients") endpoint = "/api/clients";
  if (current === "cars") endpoint = "/api/cars";
  if (current === "employees") endpoint = "/api/employees";
  if (current === "works") endpoint = "/api/work-types";
  if (current === "parts") endpoint = "/api/parts";
  if (current === "payments") endpoint = "/api/payments";
  try {
    const created = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (current === "cars" && photo instanceof File && photo.size > 0) {
      if (photo.size > 5 * 1024 * 1024)
        throw new Error("Фотография должна быть не больше 5 МБ");
      const uploadData = new FormData();
      uploadData.append("photo", photo);
      await api(`/api/cars/${created.car_id}/photo`, {
        method: "POST",
        body: uploadData,
      });
    }
    closeModal();
    showToast("Запись сохранена в MariaDB");
    await render();
  } catch (err) {
    showToast(err.message);
  }
}

async function changeCarPhoto(carId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.onchange = async () => {
    const photo = input.files?.[0];
    if (!photo) return;
    if (photo.size > 5 * 1024 * 1024) {
      showToast("Фотография должна быть не больше 5 МБ");
      return;
    }
    const fd = new FormData();
    fd.append("photo", photo);
    try {
      await api(`/api/cars/${carId}/photo`, { method: "POST", body: fd });
      showToast("Фотография обновлена");
      await render();
    } catch (e) {
      showToast(e.message);
    }
  };
  input.click();
}

async function openOrder(id) {
  try {
    const [o, works, parts, employees] = await Promise.all([
      api(`/api/orders/${id}`),
      api("/api/work-types"),
      api("/api/parts"),
      api("/api/employees"),
    ]);
    const wRows = o.works.length
      ? o.works
          .map(
            (x) =>
              `<tr><td>${esc(x.name)}</td><td>${esc(
                x.quantity
              )}</td><td>${money(x.price)}</td><td>${money(
                Number(x.quantity) * Number(x.price)
              )}</td></tr>`
          )
          .join("")
      : emptyRow(4, "Работы не добавлены");
    const pRows = o.parts.length
      ? o.parts
          .map(
            (x) =>
              `<tr><td>${esc(x.name)}</td><td>${esc(
                x.quantity
              )}</td><td>${money(x.price)}</td><td>${money(
                Number(x.quantity) * Number(x.price)
              )}</td></tr>`
          )
          .join("")
      : emptyRow(4, "Запчасти не добавлены");
    const payRows = o.payments.length
      ? o.payments
          .map(
            (x) =>
              `<tr><td>${dateFmt(x.payment_date, true)}</td><td>${money(
                x.amount
              )}</td><td>${esc(x.payment_method || "—")}</td></tr>`
          )
          .join("")
      : emptyRow(3, "Оплат пока нет");
    document.getElementById(
      "modalBody"
    ).innerHTML = `<h2>Заказ #${id}</h2><p><b>${esc(
      o.license_plate || "Без номера"
    )} · ${esc(o.brand)} ${esc(o.model)}</b> · ${esc(
      o.client_name
    )}<br>Статус: <span class="status ${statusClass(o.status_name)}">${esc(
      o.status_name
    )}</span> · Пробег: ${
      o.mileage ? `${Number(o.mileage).toLocaleString("ru-RU")} км` : "—"
    }</p>
      <h3>Работы</h3><table class="data-table compact"><thead><tr><th>Работа</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${wRows}</tbody></table>
      <form class="inline-add" onsubmit="addOrderWork(event,${id})"><select name="work_type_id" required><option value="">Добавить работу…</option>${works
      .map(
        (x) =>
          `<option value="${x.work_type_id}" data-price="${
            x.default_price
          }">${esc(x.name)} · ${money(x.default_price)}</option>`
      )
      .join(
        ""
      )}</select><select name="employee_id"><option value="">Мастер не указан</option>${employees
      .filter((x) => Number(x.is_active))
      .map(
        (x) => `<option value="${x.employee_id}">${esc(x.full_name)}</option>`
      )
      .join(
        ""
      )}</select><input name="quantity" type="number" min="0.01" step="0.01" value="1"><button class="btn btn-lime">Добавить</button></form>
      <h3>Запчасти</h3><table class="data-table compact"><thead><tr><th>Запчасть</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${pRows}</tbody></table>
      <form class="inline-add" onsubmit="addOrderPart(event,${id})"><select name="part_id" required><option value="">Добавить запчасть…</option>${parts
      .map(
        (x) =>
          `<option value="${x.part_id}" data-price="${x.price}">${esc(
            x.name
          )} · ${x.stock_quantity} шт. · ${money(x.price)}</option>`
      )
      .join(
        ""
      )}</select><input name="quantity" type="number" min="1" value="1"><button class="btn btn-lime">Списать со склада</button></form>
      <h3>Оплаты</h3><table class="data-table compact"><thead><tr><th>Дата</th><th>Сумма</th><th>Способ</th></tr></thead><tbody>${payRows}</tbody></table>
      <form class="inline-add" onsubmit="addPayment(event,${id})"><input name="amount" type="number" min="0.01" step="0.01" placeholder="Сумма" required><select name="payment_method"><option>Банковская карта</option><option>Наличные</option><option>Перевод</option></select><button class="btn btn-lime">Оплатить</button></form>`;
    document.getElementById("modal").classList.add("open");
  } catch (e) {
    showToast(e.message);
  }
}
async function addOrderWork(e, id) {
  e.preventDefault();
  const f = e.target;
  const opt = f.work_type_id.selectedOptions[0];
  const data = Object.fromEntries(new FormData(f).entries());
  data.price = opt.dataset.price;
  try {
    await api(`/api/orders/${id}/works`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    await openOrder(id);
    showToast("Работа добавлена");
  } catch (err) {
    showToast(err.message);
  }
}
async function addOrderPart(e, id) {
  e.preventDefault();
  const f = e.target;
  const opt = f.part_id.selectedOptions[0];
  const data = Object.fromEntries(new FormData(f).entries());
  data.price = opt.dataset.price;
  try {
    await api(`/api/orders/${id}/parts`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    await openOrder(id);
    showToast("Запчасть списана");
  } catch (err) {
    showToast(err.message);
  }
}
async function addPayment(e, id) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.order_id = id;
  try {
    await api("/api/payments", { method: "POST", body: JSON.stringify(data) });
    await openOrder(id);
    showToast("Оплата сохранена");
  } catch (err) {
    showToast(err.message);
  }
}
async function showCarHistory(q) {
  try {
    const list = await api(`/api/orders?q=${encodeURIComponent(q)}`);
    document.getElementById(
      "modalBody"
    ).innerHTML = `<h2>История обслуживания</h2>${
      list.length
        ? list
            .map(
              (x) =>
                `<div class="history-card"><b>#${x.order_id} · ${dateFmt(
                  x.created_at
                )}</b><span class="status ${statusClass(x.status_name)}">${esc(
                  x.status_name
                )}</span><p>${esc(x.complaint || "Без описания")} · ${money(
                  x.order_total
                )}</p><button class="tiny-btn" onclick="openOrder(${
                  x.order_id
                })">Открыть</button></div>`
            )
            .join("")
        : "<p>Заказов пока нет.</p>"
    }`;
    document.getElementById("modal").classList.add("open");
  } catch (e) {
    showToast(e.message);
  }
}
function closeModal() {
  document.getElementById("modal").classList.remove("open");
}
function showToast(t) {
  const x = document.getElementById("toast");
  x.textContent = t;
  x.classList.add("show");
  setTimeout(() => x.classList.remove("show"), 2600);
}

document
  .querySelectorAll(".nav-item")
  .forEach((x) => x.addEventListener("click", () => go(x.dataset.page)));
document
  .getElementById("menuBtn")
  .addEventListener("click", () =>
    document.getElementById("sidebar").classList.toggle("open")
  );
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") closeModal();
});
render();
