async function openOrderModal(orderId = null) {
  const [options, detail] = await Promise.all([
    api("/api/order-options"),
    orderId ? api(`/api/orders/${orderId}`) : Promise.resolve(null),
  ]);
  const order = detail?.order || null;
  const activeEmployees = options.employees.filter((employee) => Number(employee.is_active));
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
          <select name="employee_id" id="eligibleEmployeeSelect">${employeeOptions(
            options.employees,
            order?.employee_id ?? "",
            create
          )}</select>
          <small id="employeeSkillHint" class="app-field-hint"></small>
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
  const masterSelect = modal.querySelector("#eligibleEmployeeSelect");
  const skillHint = modal.querySelector("#employeeSkillHint");
  const requiredSkills = () => create
    ? [...new Set([...workLines.querySelectorAll("[data-work-type]")].map((node) => Number(node.value)))]
    : [...new Set(detail.works.map((item) => Number(item.work_type_id)))];
  function updateEligibleEmployees() {
    const skills = requiredSkills();
    const eligible = activeEmployees.filter((employee) => {
      const owned = new Set(String(employee.skill_ids || "").split(",").map(Number));
      return skills.every((id) => owned.has(id));
    });
    const previous = masterSelect.value;
    masterSelect.innerHTML = eligible.map((employee) =>
      `<option value="${Number(employee.employee_id)}">${esc(employee.full_name)} · ${esc(employee.position)}</option>`
    ).join("") + (eligible.length
      ? '<option value="">Подобрать автоматически по загрузке</option>'
      : '<option value="" disabled selected>Нет подходящих мастеров</option>');
    if (previous && eligible.some((employee) => String(employee.employee_id) === previous)) masterSelect.value = previous;
    else if (!create && eligible.some((employee) => Number(employee.employee_id) === Number(order?.employee_id))) masterSelect.value = String(order.employee_id);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = !eligible.length;
    skillHint.textContent = eligible.length
      ? `Доступно мастеров с нужными навыками: ${eligible.length}`
      : 'Нет мастеров со всеми выбранными навыками. Настройте навыки сотрудников либо измените работы.';
    skillHint.style.color = eligible.length ? '' : '#aa493c';
    // Без квалифицированного мастера заказ не отправляем.
  }
  workLines?.addEventListener("change", (event) => {
    if (event.target.closest("[data-work-type]")) updateEligibleEmployees();
  });
  updateEligibleEmployees();
  modal.querySelector("#addWorkLine")?.addEventListener("click", () => {
    workLines.insertAdjacentHTML(
      "beforeend",
      workLineHtml(options.workTypes, {
        work_type_id: options.workTypes[0]?.work_type_id,
        quantity: 1,
      })
    );
    updateEligibleEmployees();
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
    updateEligibleEmployees();
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

