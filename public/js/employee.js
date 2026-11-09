const { api, esc, money, shortDate } = window;
const state = { user: null, data: null, tab: "overview" };
const content = document.getElementById("content");
const modalRoot = document.getElementById("modalRoot");

const initials = (name) =>
  String(name || "МА")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
const today = new Date();
today.setHours(0, 0, 0, 0);

function toast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove("show"), 2600);
}

function statusClass(status) {
  if (["В работе", "Диагностика"].includes(status)) return "status-work";
  if (status === "Ожидание запчастей") return "status-wait";
  if (status === "Готов") return "status-ready";
  if (["Выдан"].includes(status)) return "status-done";
  if (status === "Отменён") return "status-cancel";
  return "";
}

function dateValue(value) {
  if (!value) return null;
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) return null;
  result.setHours(0, 0, 0, 0);
  return result;
}

function orderBucket(order) {
  if (["Готов", "Выдан", "Отменён"].includes(order.status_name))
    return "completed";
  if (
    dateValue(order.planned_finish_date) &&
    dateValue(order.planned_finish_date) >= today
  )
    return "upcoming";
  return "active";
}

function orderCard(order) {
  const assignedWorks = state.data.works.filter(
    (work) => Number(work.order_id) === Number(order.order_id)
  );
  return `
    <article class="portal-card portal-order-card">
      <div class="portal-order-top"><span class="portal-order-id">ЗАКАЗ №${Number(
        order.order_id
      )}</span><span class="portal-status ${statusClass(
    order.status_name
  )}">${esc(order.status_name)}</span></div>
      ${
        order.photo_path
          ? `<img class="portal-order-car-photo" data-image-preview src="${esc(
              order.photo_path
            )}" alt="${esc(`${order.brand} ${order.model}`)}">`
          : ""
      }
      <h3>${esc(order.brand)} ${esc(
    order.model
  )} <span class="portal-order-subtitle">· ${esc(
    order.license_plate || "без номера"
  )}</span></h3>
      <div class="portal-order-subtitle">${esc(order.client_name)} · ${esc(
    order.client_phone || "телефон не указан"
  )}</div>
      <p class="portal-order-description">${esc(
        order.complaint || "Описание не добавлено"
      )}</p>
      <div class="portal-order-meta"><div><small>Работы</small><b>${
        assignedWorks.length || 0
      } поз.</b></div><div><small>Срок</small><b>${esc(
    shortDate(order.planned_finish_date)
  )}</b></div></div>
      <div class="portal-card-actions"><button class="portal-button portal-button-primary" data-edit-order="${Number(
        order.order_id
      )}">Открыть заказ</button></div>
    </article>`;
}

function emptyState(title, text) {
  return `<div class="portal-empty"><strong>${esc(title)}</strong><p>${esc(
    text
  )}</p></div>`;
}

function renderOverview() {
  const { employee, orders } = state.data;
  const active = orders.filter(
    (order) =>
      orderBucket(order) === "active" || orderBucket(order) === "upcoming"
  );
  const upcoming = orders.filter((order) => orderBucket(order) === "upcoming");
  const completed = orders.filter(
    (order) => orderBucket(order) === "completed"
  );
  const todayOrders = orders.filter(
    (order) =>
      dateValue(order.planned_finish_date)?.getTime() === today.getTime()
  );
  return `
    <div class="portal-page-heading"><div><h1>Добрый день, ${esc(
      employee.full_name.split(" ")[0]
    )}!</h1><p>${esc(
    employee.position
  )} · Ваши назначенные заказы и ближайшие задачи.</p></div><span class="portal-status">Рабочее место активно</span></div>
    <div class="portal-stats">
      <div class="portal-stat"><div class="portal-stat-top">Всего назначено <span class="portal-stat-icon">▤</span></div><strong>${
        orders.length
      }</strong><small>Заказов в системе</small></div>
      <div class="portal-stat"><div class="portal-stat-top">В работе <span class="portal-stat-icon">⚙</span></div><strong>${
        active.length
      }</strong><small>Требуют внимания</small></div>
      <div class="portal-stat"><div class="portal-stat-top">На сегодня <span class="portal-stat-icon">◷</span></div><strong>${
        todayOrders.length
      }</strong><small>Плановый срок сегодня</small></div>
      <div class="portal-stat"><div class="portal-stat-top">Завершено <span class="portal-stat-icon">✓</span></div><strong>${
        completed.length
      }</strong><small>Готово, выдано или отменено</small></div>
    </div>
    <section class="portal-section"><div class="portal-section-heading"><h2>Ближайшие работы</h2><span>${
      upcoming.length
    } предстоящих</span></div>
      ${
        upcoming.length
          ? `<div class="portal-grid">${upcoming
              .slice(0, 2)
              .map(orderCard)
              .join("")}</div>`
          : emptyState(
              "Нет предстоящих заказов",
              "Новые назначенные работы появятся здесь автоматически."
            )
      }
    </section>
    <section class="portal-section"><div class="portal-section-heading"><h2>Активные заказы</h2><span>${
      active.length
    } в работе</span></div>
      ${
        active.length
          ? `<div class="portal-grid">${active
              .slice(0, 4)
              .map(orderCard)
              .join("")}</div>`
          : emptyState(
              "Активных заказов нет",
              "Все текущие задачи завершены или пока не назначены."
            )
      }
    </section>`;
}

function renderOrders(filter) {
  const filtered = state.data.orders.filter(
    (order) => filter === "all" || orderBucket(order) === filter
  );
  return `<div class="portal-page-heading"><div><h1>${
    filter === "upcoming"
      ? "Предстоящие работы"
      : filter === "completed"
      ? "Завершённые заказы"
      : filter === "active"
      ? "Активные заказы"
      : "Все мои заказы"
  }</h1><p>Открывайте заказ, чтобы обновить статус или добавить результат диагностики.</p></div>
    <div class="portal-filter"><button class="${
      filter === "active" ? "active" : ""
    }" data-filter="active">Активные</button><button class="${
    filter === "upcoming" ? "active" : ""
  }" data-filter="upcoming">Предстоящие</button><button class="${
    filter === "completed" ? "active" : ""
  }" data-filter="completed">Готовые</button><button class="${
    filter === "all" ? "active" : ""
  }" data-filter="all">Все</button></div></div>
    ${
      filtered.length
        ? `<div class="portal-grid">${filtered.map(orderCard).join("")}</div>`
        : emptyState(
            "Заказов в этом разделе нет",
            "Здесь появятся заказы, назначенные вам администратором."
          )
    }`;
}

function render() {
  const titles = {
    overview: "Мой день",
    active: "Активные заказы",
    upcoming: "Предстоящие работы",
    completed: "Завершённые",
    all: "Все мои заказы",
  };
  document.getElementById("pageTitle").textContent =
    titles[state.tab] || "Мой день";
  document
    .querySelectorAll("[data-tab]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.tab === state.tab)
    );
  content.innerHTML =
    state.tab === "overview" ? renderOverview() : renderOrders(state.tab);
}

function openOrderEditor(orderId) {
  const order = state.data.orders.find(
    (item) => Number(item.order_id) === Number(orderId)
  );
  if (!order) return;
  const events = state.data.events.filter(
    (event) => Number(event.order_id) === Number(orderId)
  );
  const works = state.data.works.filter(
    (work) => Number(work.order_id) === Number(orderId)
  );
  modalRoot.innerHTML = `
    <div class="portal-modal-backdrop" data-modal-backdrop><section class="portal-modal" role="dialog" aria-modal="true">
      <div class="portal-modal-head"><div><h2>Заказ №${Number(
        order.order_id
      )}</h2><p>${esc(order.brand)} ${esc(order.model)} · ${esc(
    order.license_plate || "без номера"
  )}</p></div><button class="portal-modal-close" data-modal-close type="button">×</button></div>
      <div class="portal-order-top"><span class="portal-order-id">${esc(
        order.client_name
      )} · ${esc(
    order.client_phone || "телефон не указан"
  )}</span><span class="portal-status ${statusClass(order.status_name)}">${esc(
    order.status_name
  )}</span></div>
      <div class="portal-section"><div class="portal-section-heading"><h2>Задача клиента</h2><span>${esc(
        shortDate(order.planned_finish_date)
      )}</span></div><p class="portal-order-description">${esc(
    order.complaint || "Описание не добавлено"
  )}</p></div>
      <div class="portal-section"><div class="portal-section-heading"><h2>Работы в заказе</h2></div>${
        works
          .map(
            (work) =>
              `<div class="portal-order-meta"><div><small>Вид работы</small><b>${esc(
                work.work_name
              )}</b></div><div><small>Количество</small><b>${esc(
                work.quantity
              )}</b></div></div>`
          )
          .join("") || "Работы не назначены"
      }</div>
      <form id="orderUpdateForm" data-order-id="${Number(order.order_id)}">
        <div class="portal-form-grid">
          <label class="portal-field portal-field-full">Статус работы<select name="status_id">${state.data.statuses
            .filter(
              (status) =>
                [
                  "Принят",
                  "Диагностика",
                  "В работе",
                  "Ожидание запчастей",
                  "Готов",
                ].includes(status.name) || status.name === order.status_name
            )
            .map(
              (status) =>
                `<option value="${Number(status.status_id)}" ${
                  Number(status.status_id) === Number(order.status_id)
                    ? "selected"
                    : ""
                }>${esc(status.name)}</option>`
            )
            .join("")}</select></label>
          <label class="portal-field portal-field-full">Результат диагностики<textarea name="diagnosis" maxlength="10000" placeholder="Что обнаружено и какие действия выполнены…">${esc(
            order.diagnosis || ""
          )}</textarea></label>
          <label class="portal-field portal-field-full">Комментарий мастера<textarea name="comment" maxlength="10000" placeholder="Дополнительная информация по заказу…">${esc(
            order.comment || ""
          )}</textarea></label>
        </div>
        <div id="orderUpdateError" class="portal-error" hidden></div>
        <div class="portal-modal-actions"><button class="portal-button" type="button" data-modal-close>Отмена</button><button class="portal-button portal-button-primary" type="submit">Сохранить изменения</button></div>
      </form>
      <div class="portal-section"><div class="portal-section-heading"><h2>История заказа</h2></div>${
        events.length
          ? `<div class="portal-timeline">${events
              .map(
                (event) =>
                  `<div class="portal-timeline-item"><b>${esc(
                    event.message
                  )}</b><p>${esc(event.actor_name)}</p><small>${esc(
                    new Date(event.created_at).toLocaleString("ru-RU")
                  )}</small></div>`
              )
              .join("")}</div>`
          : emptyState(
              "История пока пуста",
              "Изменения будут записываться автоматически."
            )
      }</div>
    </section></div>`;
  modalRoot
    .querySelector("[data-modal-backdrop]")
    .addEventListener("click", (event) => {
      if (
        event.target.matches("[data-modal-backdrop]") ||
        event.target.closest("[data-modal-close]")
      )
        modalRoot.innerHTML = "";
    });
  modalRoot
    .querySelector("#orderUpdateForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.status_id = Number(payload.status_id);
      const error = form.querySelector("#orderUpdateError");
      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      error.hidden = true;
      try {
        await api(`/api/employee/orders/${Number(order.order_id)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        modalRoot.innerHTML = "";
        await loadDashboard();
        toast("Изменения по заказу сохранены");
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
        submit.disabled = false;
      }
    });
}

function openImagePreview(src, alt = "Фотография автомобиля") {
  modalRoot.innerHTML = `
    <div class="portal-image-viewer-backdrop" data-image-viewer>
      <button class="portal-image-viewer-close" type="button" aria-label="Закрыть">×</button>
      <img src="${esc(src)}" alt="${esc(alt)}">
    </div>`;
  const viewer = modalRoot.querySelector("[data-image-viewer]");
  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };
  const close = () => {
    modalRoot.innerHTML = "";
    document.removeEventListener("keydown", onKeyDown);
  };
  viewer.addEventListener("click", (event) => {
    if (
      event.target === viewer ||
      event.target.closest(".portal-image-viewer-close")
    )
      close();
  });
  document.addEventListener("keydown", onKeyDown);
}

function openSettingsModal() {
  modalRoot.innerHTML = `
    <div class="portal-modal-backdrop" data-modal-backdrop>
      <section class="portal-modal" role="dialog" aria-modal="true">
        <div class="portal-modal-head"><div><h2>Настройки профиля</h2><p>Управление данными доступа</p></div><button class="portal-modal-close" type="button" data-modal-close>×</button></div>
        <div class="settings-content">
          <div class="portal-settings-account"><span>Текущий аккаунт</span><b>${esc(
            state.user?.email || "—"
          )}</b></div>
          <p class="portal-settings-note">Email проверяется сервером и должен совпадать с текущей учётной записью.</p>
          <div class="portal-modal-actions"><button class="portal-button" type="button" data-modal-close>Закрыть</button><button class="portal-button portal-button-primary" type="button" data-open-password>Сменить пароль</button></div>
        </div>
      </section>
    </div>`;
  const backdrop = modalRoot.querySelector("[data-modal-backdrop]");
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop || event.target.closest("[data-modal-close]"))
      modalRoot.innerHTML = "";
  });
  modalRoot
    .querySelector("[data-open-password]")
    .addEventListener("click", () => {
      modalRoot.querySelector(".settings-content").innerHTML = `
      <form id="passwordChangeForm">
        <div class="portal-form-grid">
          <label class="portal-field portal-field-full">Email текущей учётной записи
            <input name="email" type="email" maxlength="190" required value="${esc(
              state.user?.email || ""
            )}" autocomplete="username">
          </label>
          <label class="portal-field portal-field-full">Новый пароль
            <input name="password" type="password" minlength="10" required autocomplete="new-password" placeholder="Не менее 10 символов">
          </label>
          <label class="portal-field portal-field-full">Повторите новый пароль
            <input name="password_confirmation" type="password" minlength="10" required autocomplete="new-password">
          </label>
        </div>
        <div class="portal-error" id="passwordChangeError" hidden></div>
        <div class="portal-modal-actions"><button class="portal-button" type="button" data-modal-close>Отмена</button><button class="portal-button portal-button-primary" type="submit">Сохранить пароль</button></div>
      </form>`;
      const form = modalRoot.querySelector("#passwordChangeForm");
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
          modalRoot.innerHTML = "";
          toast("Пароль успешно изменён");
        } catch (requestError) {
          error.textContent = requestError.message;
          error.hidden = false;
          submit.disabled = false;
        }
      });
    });
}

async function loadDashboard() {
  content.innerHTML = '<div class="portal-loading">Обновление заказов…</div>';
  state.data = await api("/api/employee/dashboard");
  render();
}

document.querySelectorAll("[data-tab]").forEach((button) =>
  button.addEventListener("click", () => {
    state.tab = button.dataset.tab;
    render();
    document.getElementById("sidebar").classList.remove("open");
  })
);

document.getElementById("content").addEventListener("click", (event) => {
  const preview = event.target.closest("[data-image-preview]");
  if (preview) {
    openImagePreview(preview.src, preview.alt);
    return;
  }
  const orderButton = event.target.closest("[data-edit-order]");
  const filterButton = event.target.closest("[data-filter]");
  if (orderButton) openOrderEditor(Number(orderButton.dataset.editOrder));
  if (filterButton) {
    state.tab = filterButton.dataset.filter;
    render();
  }
});

document
  .getElementById("menuBtn")
  .addEventListener("click", () =>
    document.getElementById("sidebar").classList.toggle("open")
  );
document
  .getElementById("settingsBtn")
  .addEventListener("click", openSettingsModal);
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  location.assign("/login");
});
document.getElementById("todayLabel").textContent =
  new Date().toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });

(async function init() {
  try {
    const { user } = await api("/api/auth/me");
    if (user.role !== "employee") return location.assign("/login");
    state.user = user;
    const text = initials(user.name);
    document.getElementById("userInitials").textContent = text;
    document.getElementById("topInitials").textContent = text;
    document.getElementById("sidebarUserName").textContent = user.name;
    const data = await api("/api/employee/dashboard");
    state.data = data;
    document.getElementById("sidebarPosition").textContent =
      data.employee.position;
    render();
  } catch (error) {
    content.innerHTML = `<div class="portal-error">${esc(error.message)}</div>`;
  }
})();
