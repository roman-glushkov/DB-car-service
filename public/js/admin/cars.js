async function cars() {
  const list = await api("/api/cars");
  const rows = list
    .map(
      (item) => `
    <tr data-search="${esc(
      `${item.brand} ${item.model} ${item.vin || ""} ${
        item.license_plate || ""
      }`
    )}">
      <td>
        <div class="car-cell">
          ${
            item.photo_path
              ? `<img class="car-thumb" data-image-preview src="${esc(
                  item.photo_path
                )}" alt="${esc(`${item.brand} ${item.model}`)}">`
              : '<span class="car-thumb car-thumb-empty">▣</span>'
          }
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
      <td><button class="action-btn" data-action="edit-car" data-id="${Number(item.car_id)}">Изменить</button>
      <button class="action-btn" data-action="delete-record" data-kind="cars" data-id="${Number(item.car_id)}">Удалить</button>
      ${item.photo_path ? `<button class="action-btn" data-action="remove-photo" data-id="${Number(item.car_id)}">Убрать фото</button>` : ""}
      <label class="action-btn">Фото<input type="file" accept="image/jpeg,image/png,image/webp" data-car-photo="${Number(
        item.car_id
      )}" hidden></label></td>
    </tr>`
    )
    .join("");

  return page(
    "Машины",
    ["Автомобиль", "Госномер", "Год", "Последний пробег", "Владелец", "Действия"],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-car">+ Добавить машину</button>',
    tableTools("Поиск по модели, VIN, госномеру, марке или владельцу")
  );
}

