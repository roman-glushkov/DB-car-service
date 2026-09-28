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
function shell(inner, sub = "") {
  return `<div class="page"><div class="page-head"><div><div class="eyebrow">${
    sub || "рабочее место администратора"
  }</div><h1>${
    pages[current].title
  }</h1><div class="page-sub">Управление автосервисом · данные демонстрационные</div></div>${
    current !== "stats"
      ? `<button class="btn btn-lime" onclick="openCreate()">＋ Добавить</button>`
      : ""
  }</div>${inner}</div>`;
}
function dashboard() {
  return `<div class="hero-mini"><div><h2>Доброе утро, Алексей</h2><p>Сегодня в работе 12 заказов. Два автомобиля готовы к выдаче.</p></div><div class="quick-actions"><button class="btn btn-lime" onclick="openCreate()">＋ Новый заказ</button><button class="btn btn-light" onclick="showToast('Открыт поиск')">⌕ Найти автомобиль</button></div></div>
<div class="cards">
${metric("Активные заказы", "12", "↗ 8%", "vs. прошлой недели", "▤")}
${metric("Выручка за месяц", "684 320 ₽", "↗ 12,4%", "vs. август", "₽")}
${metric("Автомобили", "186", "+14", "за текущий месяц", "▣")}
${metric("Низкий остаток", "4", "Требуют внимания", "запчасти", "◇")}
</div>
<div class="grid2">
<div class="panel"><div class="panel-head"><div class="panel-title">Последние заказы</div><button class="panel-link" onclick="go('orders')">Все заказы →</button></div>${orderTable(
    true
  )}</div>
<div class="panel"><div class="panel-head"><div class="panel-title">Сегодня</div><span class="panel-link">28 сентября</span></div><div class="schedule">
${event("09:00", "Диагностика", "BMW X5 · А991МР12", "Диагностика")}
${event("11:30", "Замена масла", "Kia Rio · К483КХ12", "В работе")}
${event("13:00", "Выдача автомобиля", "Toyota Camry · Т214РВ12", "Готов")}
${event("15:30", "Шиномонтаж", "Audi A6 · М712ТА12", "Новый")}
</div></div></div>
<div class="panel section-space"><div class="panel-head"><div><div class="panel-title">Недавние работы</div><div class="page-sub">Фото-заглушки для будущей истории выполненных работ</div></div><button class="panel-link" onclick="go('works')">Справочник →</button></div>
<div class="photo-strip">${[0, 1, 2, 3, 4]
    .map(
      (x, i) =>
        `<div class="work-photo" style="background-image:url('${A(
          i + 2
        )}')"><span class="photo-label">${
          [
            "Замена тормозов",
            "ТО и масло",
            "Диагностика",
            "Кузовные работы",
            "Подвеска",
          ][i]
        }</span></div>`
    )
    .join("")}</div></div>`;
}
function metric(t, v, c, b, ic) {
  return `<div class="metric"><div class="metric-top"><span>${t}</span><span class="metric-icon">${ic}</span></div><div class="metric-value">${v}</div><div class="metric-bottom"><span class="${
    c.includes("↗") ? "up" : ""
  }">${c}</span> ${b}</div></div>`;
}
function event(t, a, c, s) {
  return `<div class="event"><div class="event-time">${t}</div><div class="event-line"><strong>${a}</strong><span>${c}</span><span class="status ${
    s === "Готов"
      ? "s-done"
      : s === "В работе"
      ? "s-work"
      : s === "Диагностика"
      ? "s-diag"
      : "s-new"
  }">${s}</span></div></div>`;
}
function orderTable(short = false) {
  let rows = [
    [
      "А991МР12",
      "BMW X5",
      "Иванов Дмитрий",
      "Диагностика",
      "12 800 ₽",
      "s-diag",
    ],
    ["К483КХ12", "Kia Rio", "Смирнова Анна", "В работе", "8 450 ₽", "s-work"],
    [
      "Т214РВ12",
      "Toyota Camry",
      "Петров Алексей",
      "Готов",
      "46 200 ₽",
      "s-done",
    ],
    ["М712ТА12", "Audi A6", "Соколов Максим", "Принят", "5 900 ₽", "s-new"],
    [
      "О221ЕР12",
      "Mercedes E",
      "Кузнецов Илья",
      "Ожидание запчастей",
      "72 400 ₽",
      "s-wait",
    ],
  ];
  return `<table class="orders-table"><thead><tr><th>Автомобиль</th><th>Клиент</th><th>Статус</th><th>Сумма</th><th></th></tr></thead><tbody>${rows
    .slice(0, short ? 4 : 5)
    .map(
      (r, i) =>
        `<tr><td><div class="car-cell"><img class="car-thumb" src="${A(
          i
        )}"><div class="car-name"><strong>${r[0]}</strong><span>${
          r[1]
        }</span></div></div></td><td>${r[2]}</td><td><span class="status ${
          r[5]
        }">${r[3]}</span></td><td><b>${
          r[4]
        }</b></td><td><button class="tiny-btn" onclick="showToast('Открыт заказ ${
          r[0]
        }')">Открыть</button></td></tr>`
    )
    .join("")}</tbody></table>`;
}
function orders() {
  return `<div class="searchbar"><input class="search" placeholder="⌕  Поиск по номеру, VIN или клиенту"><div class="filters"><select class="select"><option>Все статусы</option><option>Принят</option><option>Диагностика</option><option>В работе</option><option>Готов</option></select><select class="select"><option>Все мастера</option><option>Петров А.</option><option>Соколов М.</option></select></div></div><div class="panel data-panel">${orderTable()}</div>`;
}
function clients() {
  let data = [
    [
      "Иванов Дмитрий",
      " +7 917 441-20-11",
      "d.ivanov@mail.ru",
      "BMW X5 · 2019",
    ],
    [
      "Смирнова Анна",
      "+7 902 318-72-44",
      "a.smirnova@mail.ru",
      "Kia Rio · 2021",
    ],
    [
      "Петров Алексей",
      "+7 927 510-33-12",
      "a.petrov@mail.ru",
      "Toyota Camry · 2020",
    ],
    [
      "Соколов Максим",
      "+7 905 802-11-08",
      "m.sokolov@mail.ru",
      "Audi A6 · 2018",
    ],
    [
      "Кузнецов Илья",
      "+7 917 120-49-01",
      "i.kuznetsov@mail.ru",
      "Mercedes E · 2022",
    ],
  ];
  return shell(
    `<div class="searchbar"><input class="search" placeholder="⌕  Поиск по имени или телефону"></div><div class="panel data-panel"><table class="data-table"><thead><tr><th>Клиент</th><th>Телефон</th><th>Почта</th><th>Автомобиль</th><th></th></tr></thead><tbody>${data
      .map(
        (x, i) =>
          `<tr><td><div class="person"><div class="person-avatar">${x[0]
            .split(" ")
            .map((y) => y[0])
            .join("")}</div><b>${x[0]}</b></div></td><td>${x[1]}</td><td>${
            x[2]
          }</td><td>${
            x[3]
          }</td><td><button class="tiny-btn" onclick="showToast('Карточка клиента открыта')">Карточка</button></td></tr>`
      )
      .join("")}</tbody></table></div>`
  );
}
function cars() {
  let data = [
    ["А991МР12", "BMW", "X5", "2019", "84 210 км", "Иванов Дмитрий"],
    ["К483КХ12", "Kia", "Rio", "2021", "52 400 км", "Смирнова Анна"],
    ["Т214РВ12", "Toyota", "Camry", "2020", "91 700 км", "Петров Алексей"],
    ["М712ТА12", "Audi", "A6", "2018", "126 300 км", "Соколов Максим"],
    [
      "О221ЕР12",
      "Mercedes-Benz",
      "E-Class",
      "2022",
      "38 500 км",
      "Кузнецов Илья",
    ],
    ["Н340ВС12", "Volkswagen", "Tiguan", "2020", "77 900 км", "Орлов Павел"],
  ];
  return shell(
    `<div class="searchbar"><input class="search" placeholder="⌕  Госномер или VIN"><select class="select"><option>Все марки</option><option>BMW</option><option>Kia</option><option>Toyota</option></select></div><div class="panel data-panel"><table class="data-table"><thead><tr><th>Автомобиль</th><th>Госномер</th><th>Год</th><th>Пробег</th><th>Владелец</th><th></th></tr></thead><tbody>${data
      .map(
        (x, i) =>
          `<tr><td><div class="car-cell"><img class="car-thumb" src="${A(
            i
          )}"><div class="car-name"><strong>${x[1]} ${
            x[2]
          }</strong><span>VIN: WBADEMO${
            100 + i
          }8</span></div></div></td><td><b>${x[0]}</b></td><td>${
            x[3]
          }</td><td>${x[4]}</td><td>${
            x[5]
          }</td><td><button class="tiny-btn">История</button></td></tr>`
      )
      .join("")}</tbody></table></div>`
  );
}
function employees() {
  let d = [
    ["Петров Алексей", "Мастер-приёмщик", "+7 917 440-11-22", true],
    ["Соколов Максим", "Автомеханик", "+7 902 220-31-12", true],
    ["Орлов Павел", "Автомеханик", "+7 927 330-42-08", true],
    ["Кузьмин Андрей", "Диагност", "+7 917 550-11-08", true],
    ["Васильев Роман", "Автомеханик", "+7 905 881-72-44", false],
  ];
  return shell(
    `<div class="panel data-panel"><table class="data-table"><thead><tr><th>Сотрудник</th><th>Должность</th><th>Телефон</th><th>Статус</th><th></th></tr></thead><tbody>${d
      .map(
        (x) =>
          `<tr><td><div class="person"><div class="person-avatar">${x[0]
            .split(" ")
            .map((y) => y[0])
            .join("")}</div><b>${x[0]}</b></div></td><td>${x[1]}</td><td>${
            x[2]
          }</td><td><span class="status ${x[3] ? "s-done" : "s-wait"}">${
            x[3] ? "Работает" : "Неактивен"
          }</span></td><td><button class="tiny-btn">Изменить</button></td></tr>`
      )
      .join("")}</tbody></table></div>`
  );
}
function works() {
  let d = [
    ["Замена моторного масла", "от 2 500 ₽", "1 ч 00 мин"],
    ["Диагностика ходовой части", "от 1 500 ₽", "45 мин"],
    ["Замена тормозных колодок", "от 3 200 ₽", "1 ч 30 мин"],
    ["Компьютерная диагностика", "от 1 800 ₽", "40 мин"],
    ["Замена свечей зажигания", "от 2 200 ₽", "1 ч 00 мин"],
    ["Развал-схождение", "от 2 900 ₽", "1 ч 30 мин"],
    ["Замена аккумулятора", "от 800 ₽", "30 мин"],
    ["ТО по регламенту", "от 6 500 ₽", "2 ч 30 мин"],
  ];
  return shell(
    `<div class="panel data-panel"><table class="data-table"><thead><tr><th>Название работы</th><th>Базовая цена</th><th>Время</th><th></th></tr></thead><tbody>${d
      .map(
        (x) =>
          `<tr><td><b>${x[0]}</b></td><td>${x[1]}</td><td>${x[2]}</td><td><button class="tiny-btn">Изменить</button></td></tr>`
      )
      .join("")}</tbody></table></div>`
  );
}
function parts() {
  let d = [
    ["Масло 5W-30 4L", "MOB-530-4", "Mobil", "18", "4 900 ₽"],
    ["Колодки передние BMW X5", "BP-5521", "Brembo", "3", "12 800 ₽"],
    ["Фильтр масляный", "OF-204", "Mann", "24", "1 100 ₽"],
    ["Свеча зажигания", "SP-884", "NGK", "6", "1 350 ₽"],
    ["Фильтр воздушный", "AF-120", "Mahle", "2", "1 700 ₽"],
    ["Антифриз G12+", "AFZ-5", "Liqui Moly", "31", "1 900 ₽"],
  ];
  return shell(
    `<div class="searchbar"><input class="search" placeholder="⌕  Поиск по названию или артикулу"><button class="btn btn-light" onclick="showToast('Открыт фильтр склада')">Низкий остаток</button></div><div class="panel data-panel"><table class="data-table"><thead><tr><th>Запчасть</th><th>Артикул</th><th>Производитель</th><th>Остаток</th><th>Цена</th><th></th></tr></thead><tbody>${d
      .map(
        (x) =>
          `<tr><td><b>${x[0]}</b></td><td>${x[1]}</td><td>${
            x[2]
          }</td><td class="${+x[3] < 5 ? "stock-low" : ""}">${
            x[3]
          } шт.</td><td>${
            x[4]
          }</td><td><button class="tiny-btn">Изменить</button></td></tr>`
      )
      .join("")}</tbody></table></div>`
  );
}
function payments() {
  let d = [
    ["28.09.2026", "Т214РВ12 · Toyota Camry", "46 200 ₽", "Банковская карта"],
    ["28.09.2026", "К483КХ12 · Kia Rio", "4 000 ₽", "Наличные"],
    ["27.09.2026", "О221ЕР12 · Mercedes E", "30 000 ₽", "Перевод"],
    ["26.09.2026", "А991МР12 · BMW X5", "12 800 ₽", "Банковская карта"],
    ["25.09.2026", "М712ТА12 · Audi A6", "5 900 ₽", "Наличные"],
  ];
  return shell(
    `<div class="cards">${metric(
      "За сегодня",
      "50 200 ₽",
      "↗ 9%",
      "5 платежей",
      "₽"
    )}${metric(
      "За сентябрь",
      "684 320 ₽",
      "↗ 12,4%",
      "vs. август",
      "₽"
    )}${metric(
      "Наличными",
      "182 400 ₽",
      "26,6%",
      "от общей суммы",
      "₽"
    )}${metric(
      "Картой",
      "381 920 ₽",
      "55,8%",
      "от общей суммы",
      "₽"
    )}</div><div class="panel data-panel"><table class="data-table"><thead><tr><th>Дата</th><th>Заказ</th><th>Сумма</th><th>Способ</th></tr></thead><tbody>${d
      .map(
        (x) =>
          `<tr><td>${x[0]}</td><td><b>${x[1]}</b></td><td><b>${x[2]}</b></td><td>${x[3]}</td></tr>`
      )
      .join("")}</tbody></table></div>`
  );
}
function stats() {
  let bars = [54, 68, 48, 82, 63, 88, 76, 95, 71, 84, 100, 91];
  return shell(
    `<div class="cards">${metric(
      "Выручка",
      "684 320 ₽",
      "↗ 12,4%",
      "сентябрь 2026",
      "₽"
    )}${metric("Заказов", "128", "↗ 7,6%", "за месяц", "▤")}${metric(
      "Средний чек",
      "5 346 ₽",
      "↗ 4,2%",
      "за заказ",
      "₽"
    )}${metric(
      "Выполнено",
      "91%",
      "↗ 3,1%",
      "без отмен",
      "✓"
    )}</div><div class="stats-grid section-space"><div class="panel"><div class="panel-head"><div><div class="panel-title">Выручка по месяцам</div><div class="page-sub">Демонстрационные данные</div></div></div><div class="chart">${bars
      .map(
        (v, i) =>
          `<div class="bar ${
            i === 11 ? "hot" : ""
          }" style="height:${v}%"><span>${
            ["О", "Н", "Д", "Я", "Ф", "М", "А", "М", "И", "И", "А", "С"][i]
          }</span></div>`
      )
      .join(
        ""
      )}</div><div class="legend">Показана динамика за последние 12 месяцев. После подключения БД график будет строиться автоматически.</div></div><div class="panel"><div class="panel-head"><div class="panel-title">Структура выручки</div></div><div class="donut-wrap"><div class="donut"></div></div><div class="legend-list"><div><i class="dot"></i> Работы — 48%</div><div><i class="dot two"></i> Запчасти — 24%</div><div><i class="dot three"></i> Диагностика — 15%</div></div></div></div><div class="panel section-space"><div class="panel-head"><div class="panel-title">Самые частые работы</div></div>${[
      "Замена масла",
      "Диагностика ходовой",
      "Тормозные колодки",
      "Компьютерная диагностика",
      "ТО по регламенту",
    ]
      .map(
        (x, i) =>
          `<div style="padding:12px 18px;border-bottom:1px solid #edf0ed;display:flex;align-items:center;gap:12px;font-size:10px"><b style="width:18px;color:#a0aaa5">0${
            i + 1
          }</b><span style="flex:1">${x}</span><div class="progress"><i style="width:${
            92 - i * 13
          }%"></i></div><b>${42 - i * 5}</b></div>`
      )
      .join("")}</div>`
  );
}
function openCreate() {
  document.getElementById("modalBody").innerHTML = `<h2>Новый ${
    current === "orders" || current === "dashboard"
      ? "заказ"
      : pages[current].title.toLowerCase().slice(0, -1)
  }</h2><p>Форма пока работает как визуальная заглушка. Позже поля будут связаны с базой данных.</p><div class="form-grid"><div class="field"><label>Клиент</label><input placeholder="ФИО клиента"></div><div class="field"><label>Телефон</label><input placeholder="+7 (___) ___-__-__"></div><div class="field"><label>Автомобиль</label><input placeholder="Марка и модель"></div><div class="field"><label>Госномер</label><input placeholder="А000АА12"></div><div class="field"><label>Ответственный мастер</label><select><option>Петров Алексей</option><option>Соколов Максим</option><option>Орлов Павел</option></select></div><div class="field"><label>Статус</label><select><option>Принят</option><option>Диагностика</option><option>В работе</option></select></div><div class="field full"><label>Жалоба клиента</label><textarea placeholder="Что беспокоит клиента..."></textarea></div></div><div class="modal-actions"><button class="btn btn-light" onclick="closeModal()">Отмена</button><button class="btn btn-lime" onclick="closeModal();showToast('Демо-запись создана')">Создать</button></div>`;
  document.getElementById("modal").classList.add("open");
}
function closeModal() {
  document.getElementById("modal").classList.remove("open");
}
function showToast(t) {
  const x = document.getElementById("toast");
  x.textContent = t;
  x.classList.add("show");
  setTimeout(() => x.classList.remove("show"), 1800);
}
let current = "dashboard";
function render() {
  document.getElementById("content").innerHTML = pages[current].render();
  document.getElementById("pageTitle").textContent = pages[current].title;
  document
    .querySelectorAll(".nav-item")
    .forEach((x) => x.classList.toggle("active", x.dataset.page === current));
}
function go(p) {
  current = p;
  render();
  document.getElementById("sidebar").classList.remove("open");
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
