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
      <td><label class="action-btn">Фото<input type="file" accept="image/jpeg,image/png,image/webp" data-car-photo="${Number(
        item.car_id
      )}" hidden></label></td>
    </tr>`
    )
    .join("");

  return page(
    "Машины",
    ["Автомобиль", "Госномер", "Год", "Последний пробег", "Владелец", "Фото"],
    rows,
    "",
    tableTools("Поиск по марке, VIN или госномеру")
  );
}

