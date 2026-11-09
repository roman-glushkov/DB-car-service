async function orders() {
  const [list, options] = await Promise.all([
    api("/api/orders"),
    api("/api/order-options"),
  ]);
  const rows = list
    .map(
      (row) => `
    <tr data-search="${esc(
      [
        row.order_id,
        row.license_plate,
        row.vin,
        row.client_name,
        row.brand,
        row.model,
      ].join(" ")
    )}" data-status="${esc(row.status_name)}">
      <td>
        <div class="car-cell">
          ${
            row.photo_path
              ? `<img class="car-thumb" data-image-preview src="${esc(
                  row.photo_path
                )}" alt="${esc(`${row.brand} ${row.model}`)}">`
              : '<span class="car-thumb car-thumb-empty">▣</span>'
          }
          <div class="car-name">
            <strong>${esc(row.license_plate || "Без номера")}</strong>
            <span>${esc(row.brand)} ${esc(row.model)} · VIN: ${esc(
        row.vin || "—"
      )}</span>
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
  const statusOptions = options.statuses
    .map(
      (status) =>
        `<option value="${esc(status.name)}">${esc(status.name)}</option>`
    )
    .join("");
  return page(
    "Заказы",
    ["Автомобиль", "Клиент", "Мастер", "Статус", "Сумма", ""],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-order">+ Новый заказ</button>',
    tableTools(
      "Номер авто, VIN или имя клиента",
      `<label class="table-select"><span>Статус</span><select data-table-status><option value="">Все статусы</option>${statusOptions}</select></label><span class="table-count" id="tableCount">${list.length} заказов</span>`
    )
  );
}

