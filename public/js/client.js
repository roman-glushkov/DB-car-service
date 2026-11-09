const { api, esc, money, shortDate } = window;
const state = { user: null, data: null, tab: "overview" };
const content = document.getElementById("content");
const modalRoot = document.getElementById("modalRoot");

const initials = (name) =>
  String(name || "КЛ")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(
    () => toast.classList.remove("show"),
    2600
  );
}

function openModal(title, subtitle, body) {
  modalRoot.innerHTML = `
    <div class="portal-modal-backdrop" data-modal-backdrop>
      <section class="portal-modal" role="dialog" aria-modal="true">
        <div class="portal-modal-head"><div><h2>${esc(title)}</h2><p>${esc(
    subtitle || "AutoPro · личный кабинет"
  )}</p></div><button class="portal-modal-close" type="button" data-modal-close>×</button></div>
        ${body}
      </section>
    </div>`;
  modalRoot
    .querySelector("[data-modal-backdrop]")
    .addEventListener("click", (event) => {
      if (
        event.target.matches("[data-modal-backdrop]") ||
        event.target.closest("[data-modal-close]")
      )
        modalRoot.innerHTML = "";
    });
}

function statusClass(status) {
  if (["В работе", "Диагностика"].includes(status)) return "status-work";
  if (status === "Ожидание запчастей") return "status-wait";
  if (status === "Готов") return "status-ready";
  if (["Выдан", "Завершён"].includes(status)) return "status-done";
  if (status === "Отменён") return "status-cancel";
  return "";
}

function orderCard(order, compact = false) {
  return `
    <article class="portal-card portal-order-card">
      <div class="portal-order-top"><span class="portal-order-id">ЗАКАЗ №${Number(
        order.order_id
      )}</span><span class="portal-status ${statusClass(
    order.status_name
  )}">${esc(order.status_name)}</span></div>
      <h3>${esc(order.brand)} ${esc(
    order.model
  )} <span class="portal-order-subtitle">· ${esc(
    order.license_plate || "без номера"
  )}</span></h3>
      <div class="portal-order-subtitle">${esc(
        order.work_summary || "Работы уточняются"
      )}</div>
      ${
        compact
          ? ""
          : `<p class="portal-order-description">${esc(
              order.complaint || "Описание не добавлено"
            )}</p>`
      }
      <div class="portal-order-meta">
        <div><small>Мастер</small><b>${esc(
          order.employee_name || "Назначается"
        )}</b></div>
        <div><small>Плановое завершение</small><b>${esc(
          shortDate(order.planned_finish_date)
        )}</b></div>
      </div>
      <div class="portal-card-actions"><button class="portal-button" data-order-details="${Number(
        order.order_id
      )}">Подробнее о заказе</button></div>
    </article>`;
}

function carCard(car) {
  const photo = car.photo_path
    ? `<img class="portal-car-photo" data-image-preview src="${esc(
        car.photo_path
      )}" alt="${esc(`${car.brand} ${car.model}`)}" />`
    : `<div class="portal-car-placeholder">${esc(
        String(car.brand || "A")
          .slice(0, 1)
          .toUpperCase()
      )}</div>`;
  return `
    <article class="portal-card portal-car-card">
      ${photo}
      <div class="portal-car-details">
        <h3>${esc(car.brand)} ${esc(car.model)}</h3>
        <p>${esc(car.license_plate || "Госномер не указан")} · ${esc(
    car.year || "Год не указан"
  )}</p>
        <div class="portal-car-meta"><span class="portal-meta-chip">Пробег: ${
          car.mileage == null ? "—" : `${esc(car.mileage)} км`
        }</span><span class="portal-meta-chip">Заездов: ${
    state.data.orders.filter(
      (order) => Number(order.car_id) === Number(car.car_id)
    ).length
  }</span></div>
        <div class="portal-card-actions"><label class="portal-button">Фото автомобиля<input type="file" accept="image/jpeg,image/png,image/webp" data-upload-photo="${Number(
          car.car_id
        )}" hidden /></label></div>
      </div>
    </article>`;
}

function renderOverview() {
  const { client, cars, orders, events } = state.data;
  const active = orders.filter(
    (order) => !["Готов", "Выдан", "Отменён"].includes(order.status_name)
  );
  const completed = orders.filter((order) =>
    ["Выдан", "Готов"].includes(order.status_name)
  );
  const recentEvents = events.slice(0, 5);
  return `
    <div class="portal-page-heading"><div><h1>Здравствуйте, ${esc(
      client.full_name.split(" ")[0]
    )}!</h1><p>Здесь собраны ваши автомобили, заявки и история обслуживания.</p></div><button class="portal-button portal-button-primary" data-action="new-order">+ Создать заявку</button></div>
    <div class="portal-stats">
      <div class="portal-stat"><div class="portal-stat-top">Мои автомобили <span class="portal-stat-icon">▣</span></div><strong>${
        cars.length
      }</strong><small>Привязано к профилю</small></div>
      <div class="portal-stat"><div class="portal-stat-top">Активные заказы <span class="portal-stat-icon">◷</span></div><strong>${
        active.length
      }</strong><small>Находятся в работе</small></div>
      <div class="portal-stat"><div class="portal-stat-top">Завершённые <span class="portal-stat-icon">✓</span></div><strong>${
        completed.length
      }</strong><small>Готово или выдано</small></div>
      <div class="portal-stat"><div class="portal-stat-top">Всего обращений <span class="portal-stat-icon">▤</span></div><strong>${
        orders.length
      }</strong><small>За всё время</small></div>
    </div>
    <section class="portal-section"><div class="portal-section-heading"><h2>Мои автомобили</h2><button class="portal-button" data-action="new-car">+ Добавить автомобиль</button></div>
      ${
        cars.length
          ? `<div class="portal-grid">${cars
              .slice(0, 2)
              .map(carCard)
              .join("")}</div>`
          : emptyState(
              "Автомобили пока не добавлены",
              "Добавьте свой автомобиль, чтобы создавать заявки на обслуживание.",
              "new-car",
              "Добавить автомобиль"
            )
      }
    </section>
    <section class="portal-section"><div class="portal-section-heading"><h2>Текущие заказы</h2><span>${
      active.length
    } активных</span></div>
      ${
        active.length
          ? `<div class="portal-grid">${active
              .slice(0, 2)
              .map((order) => orderCard(order, true))
              .join("")}</div>`
          : emptyState(
              "Нет активных заказов",
              "Когда вы оформите заявку, её статус и ход обслуживания появятся здесь.",
              "new-order",
              "Создать заявку"
            )
      }
    </section>
    <section class="portal-section"><div class="portal-section-heading"><h2>Последние обновления</h2><span>История работ</span></div>
      ${
        recentEvents.length
          ? `<div class="portal-card portal-card-body portal-timeline">${recentEvents
              .map(
                (event) =>
                  `<div class="portal-timeline-item"><b>${esc(
                    event.message
                  )}</b><p>Заказ №${Number(event.order_id)} · ${esc(
                    event.actor_name
                  )}</p><small>${esc(
                    new Date(event.created_at).toLocaleString("ru-RU")
                  )}</small></div>`
              )
              .join("")}</div>`
          : `<div class="portal-empty"><strong>Обновлений пока нет</strong><p>Изменения по заказам будут отображаться в этом разделе.</p></div>`
      }
    </section>`;
}

function emptyState(title, description, action, label) {
  return `<div class="portal-empty"><strong>${esc(title)}</strong><p>${esc(
    description
  )}</p><button class="portal-button portal-button-primary" data-action="${action}">${esc(
    label
  )}</button></div>`;
}

function renderCars() {
  const cars = state.data.cars;
  return `<div class="portal-page-heading"><div><h1>Мои автомобили</h1><p>Автомобили, зарегистрированные на ваш профиль.</p></div><button class="portal-button portal-button-primary" data-action="new-car">+ Добавить автомобиль</button></div>
    ${
      cars.length
        ? `<div class="portal-grid">${cars.map(carCard).join("")}</div>`
        : emptyState(
            "В профиле пока нет автомобилей",
            "Добавьте автомобиль, чтобы создать первую заявку.",
            "new-car",
            "Добавить автомобиль"
          )
    }`;
}

function renderOrders() {
  const orders = state.data.orders;
  return `<div class="portal-page-heading"><div><h1>Мои заказы</h1><p>Статусы, сроки и информация по каждому обращению.</p></div><button class="portal-button portal-button-primary" data-action="new-order">+ Новая заявка</button></div>
    ${
      orders.length
        ? `<div class="portal-grid">${orders
            .map((order) => orderCard(order))
            .join("")}</div>`
        : emptyState(
            "Заказов пока нет",
            "Вы можете оформить заявку на любой свой автомобиль.",
            "new-order",
            "Создать заявку"
          )
    }`;
}

function renderHistory() {
  const { orders, events } = state.data;
  return `<div class="portal-page-heading"><div><h1>История обслуживания</h1><p>Хронология изменений по вашим заказам.</p></div></div>
    ${
      events.length
        ? `<div class="portal-card portal-card-body portal-timeline">${events
            .map((event) => {
              const order = orders.find(
                (item) => Number(item.order_id) === Number(event.order_id)
              );
              return `<div class="portal-timeline-item"><b>${esc(
                event.message
              )}</b><p>Заказ №${Number(event.order_id)}${
                order ? ` · ${esc(order.brand)} ${esc(order.model)}` : ""
              } · ${esc(event.actor_name)}</p><small>${esc(
                new Date(event.created_at).toLocaleString("ru-RU")
              )}</small></div>`;
            })
            .join("")}</div>`
        : `<div class="portal-empty"><strong>История пока пуста</strong><p>Здесь появятся изменения статусов, диагностика и обновления заказов.</p></div>`
    }`;
}

function render() {
  document
    .querySelectorAll("[data-tab]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.tab === state.tab)
    );
  const titles = {
    overview: "Обзор",
    cars: "Мои автомобили",
    orders: "Мои заказы",
    history: "История обслуживания",
  };
  document.getElementById("pageTitle").textContent = titles[state.tab];
  const views = {
    overview: renderOverview,
    cars: renderCars,
    orders: renderOrders,
    history: renderHistory,
  };
  content.innerHTML = views[state.tab]();
}

function openCarModal() {
  openModal(
    "Добавить автомобиль",
    "Привязка автомобиля к вашему профилю",
    `
    <form id="carForm"><div class="portal-form-grid">
      <label class="portal-field">Марка<input name="brand" maxlength="50" placeholder="Например, BMW" required /></label>
      <label class="portal-field">Модель<input name="model" maxlength="50" placeholder="Например, 320i" required /></label>
      <label class="portal-field">Госномер<input name="license_plate" maxlength="15" placeholder="А000АА" /></label>
      <label class="portal-field">Год выпуска<input name="year" type="number" min="1886" max="2100" placeholder="2020" /></label>
      <label class="portal-field portal-field-full">VIN<input name="vin" maxlength="17" minlength="17" placeholder="17 символов, если известен" /></label>
    </div><div class="portal-modal-actions"><button class="portal-button" type="button" data-modal-close>Отмена</button><button class="portal-button portal-button-primary" type="submit">Сохранить автомобиль</button></div></form>`
  );
  modalRoot
    .querySelector("#carForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        await api("/api/client/cars", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        modalRoot.innerHTML = "";
        await loadDashboard();
        showToast("Автомобиль добавлен в ваш профиль");
      } catch (error) {
        showModalError(form, error.message);
      }
    });
}

function openOrderModal() {
  if (!state.data.cars.length) {
    showToast("Сначала добавьте автомобиль");
    openCarModal();
    return;
  }
  const workOptions = state.data.workTypes
    .map(
      (work) => `
    <label class="portal-check"><input type="checkbox" name="work_type_ids" value="${Number(
      work.work_type_id
    )}" />
      <span>${esc(work.name)} <small>· ${money(
        work.default_price
      )}</small></span></label>`
    )
    .join("");
  openModal(
    "Новая заявка",
    "Выберите автомобиль и опишите, что необходимо проверить",
    `
    <form id="orderForm"><div class="portal-form-grid">
      <label class="portal-field portal-field-full">Автомобиль<select name="car_id" required>${state.data.cars
        .map(
          (car) =>
            `<option value="${Number(car.car_id)}">${esc(car.brand)} ${esc(
              car.model
            )} · ${esc(car.license_plate || "без номера")}</option>`
        )
        .join("")}</select></label>
      <div class="portal-field portal-field-full"><span>Какие работы нужны?</span><div class="portal-check-list">${
        workOptions || "Нет доступных работ. Обратитесь в автосервис."
      }</div></div>
      <label class="portal-field portal-field-full">Описание проблемы<textarea name="complaint" minlength="5" maxlength="5000" placeholder="Опишите симптомы, звуки или необходимое обслуживание…" required></textarea></label>
    </div><div id="orderFormError" class="portal-error" hidden></div><div class="portal-modal-actions"><button class="portal-button" type="button" data-modal-close>Отмена</button><button class="portal-button portal-button-primary" type="submit">Отправить заявку</button></div></form>`
  );
  modalRoot
    .querySelector("#orderForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const workIds = [
        ...form.querySelectorAll('[name="work_type_ids"]:checked'),
      ].map((input) => Number(input.value));
      const errorBox = form.querySelector("#orderFormError");
      if (!workIds.length) {
        errorBox.textContent = "Выберите хотя бы один вид работ.";
        errorBox.hidden = false;
        return;
      }
      const payload = {
        car_id: Number(form.car_id.value),
        complaint: form.complaint.value.trim(),
        works: workIds.map((work_type_id) => ({ work_type_id, quantity: 1 })),
      };
      try {
        await api("/api/client/orders", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        modalRoot.innerHTML = "";
        state.tab = "orders";
        await loadDashboard();
        showToast("Заявка отправлена. Вы можете отслеживать её статус.");
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
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
  openModal(
    "Настройки профиля",
    "Управление данными доступа",
    `
    <div class="settings-content">
      <div class="portal-settings-account"><span>Текущий аккаунт</span><b>${esc(
        state.user?.email || "—"
      )}</b></div>
      <p class="portal-settings-note">Email используется для входа в личный кабинет и подтверждается сервером при смене пароля.</p>
      <div class="portal-modal-actions"><button class="portal-button" type="button" data-modal-close>Закрыть</button><button class="portal-button portal-button-primary" type="button" data-open-password>Сменить пароль</button></div>
    </div>`
  );
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
          showToast("Пароль успешно изменён");
        } catch (requestError) {
          error.textContent = requestError.message;
          error.hidden = false;
          submit.disabled = false;
        }
      });
    });
}

function showModalError(form, message) {
  let error = form.querySelector(".portal-error");
  if (!error) {
    error = document.createElement("div");
    error.className = "portal-error";
    form.prepend(error);
  }
  error.textContent = message;
}

async function showOrderDetails(orderId) {
  try {
    const data = await api(`/api/client/orders/${orderId}`);
    const order = data.order;
    openModal(
      `Заказ №${order.order_id}`,
      `${order.brand} ${order.model} · ${order.license_plate || "без номера"}`,
      `
      <div class="portal-order-top"><span class="portal-order-id">${esc(
        order.created_at
          ? new Date(order.created_at).toLocaleDateString("ru-RU")
          : ""
      )}</span><span class="portal-status ${statusClass(
        order.status_name
      )}">${esc(order.status_name)}</span></div>
      <p class="portal-order-description">${esc(
        order.complaint || "Описание не добавлено"
      )}</p>
      <div class="portal-section"><div class="portal-section-heading"><h2>Состав заказа</h2><span>${money(
        data.works.reduce(
          (sum, work) => sum + Number(work.quantity) * Number(work.price),
          0
        )
      )}</span></div>
        ${
          data.works
            .map(
              (work) =>
                `<div class="portal-order-meta"><div><small>Работа</small><b>${esc(
                  work.work_name
                )}</b></div><div><small>Стоимость</small><b>${money(
                  Number(work.quantity) * Number(work.price)
                )}</b></div></div>`
            )
            .join("") || "Работы уточняются"
        }</div>
      <div class="portal-section"><div class="portal-section-heading"><h2>Информация</h2></div><div class="portal-order-meta"><div><small>Мастер</small><b>${esc(
        order.employee_name || "Назначается"
      )}</b></div><div><small>Плановое завершение</small><b>${esc(
        shortDate(order.planned_finish_date)
      )}</b></div><div><small>Диагностика</small><b>${esc(
        order.diagnosis || "Пока не заполнена"
      )}</b></div><div><small>Комментарий</small><b>${esc(
        order.comment || "—"
      )}</b></div></div></div>
      <div class="portal-section"><div class="portal-section-heading"><h2>История изменений</h2></div>${
        data.events.length
          ? `<div class="portal-timeline">${data.events
              .map(
                (event) =>
                  `<div class="portal-timeline-item"><b>${esc(
                    event.message
                  )}</b><p>${esc(event.actor_name)}</p><small>${esc(
                    new Date(event.created_at).toLocaleString("ru-RU")
                  )}</small></div>`
              )
              .join("")}</div>`
          : `<span class="portal-order-subtitle">История ещё не сформирована.</span>`
      }</div>
      <div class="portal-modal-actions"><button class="portal-button" type="button" data-modal-close>Закрыть</button></div>`
    );
  } catch (error) {
    showToast(error.message);
  }
}

async function loadDashboard() {
  content.innerHTML = '<div class="portal-loading">Обновление данных…</div>';
  state.data = await api("/api/client/dashboard");
  render();
}

document.querySelectorAll("[data-tab]").forEach((button) =>
  button.addEventListener("click", () => {
    state.tab = button.dataset.tab;
    render();
    document.getElementById("sidebar").classList.remove("open");
  })
);

document.getElementById("content").addEventListener("click", async (event) => {
  const preview = event.target.closest("[data-image-preview]");
  if (preview) {
    openImagePreview(preview.src, preview.alt);
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  const orderButton = event.target.closest("[data-order-details]");
  if (action === "new-car") openCarModal();
  if (action === "new-order") openOrderModal();
  if (orderButton) showOrderDetails(Number(orderButton.dataset.orderDetails));
});

document.getElementById("content").addEventListener("change", async (event) => {
  const input = event.target.closest("[data-upload-photo]");
  if (!input?.files?.[0]) return;
  const formData = new FormData();
  formData.append("photo", input.files[0]);
  try {
    await api(`/api/client/cars/${Number(input.dataset.uploadPhoto)}/photo`, {
      method: "POST",
      body: formData,
    });
    await loadDashboard();
    showToast("Фотография автомобиля обновлена");
  } catch (error) {
    showToast(error.message);
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
    if (user.role !== "client") return location.assign("/login");
    state.user = user;
    const initialsText = initials(user.name);
    document.getElementById("userInitials").textContent = initialsText;
    document.getElementById("topInitials").textContent = initialsText;
    document.getElementById("sidebarUserName").textContent = user.name;
    await loadDashboard();
  } catch (error) {
    content.innerHTML = `<div class="portal-error">${esc(error.message)}</div>`;
  }
})();
