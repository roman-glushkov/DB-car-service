async function parts() {
  const list = await api("/api/parts");
  const rows = list
    .map(
      (item) => `
    <tr data-search="${esc(`${item.name} ${item.part_type || ""} ${item.article || ""} ${item.manufacturer || ""}`)}">
      <td><b>${esc(item.name)}</b></td>
      <td>${esc(item.part_type || "—")}</td>
      <td>${esc(item.article || "—")}</td>
      <td>${esc(item.manufacturer || "—")}</td>
      <td>${esc(item.stock_quantity)} шт.</td>
      <td>${money(item.price)}</td><td><button class="action-btn" data-action="edit-part" data-id="${Number(item.part_id)}">Изменить</button><button class="action-btn" data-action="delete-record" data-kind="parts" data-id="${Number(item.part_id)}">Удалить</button></td>
    </tr>`
    )
    .join("");

  return page(
    "Запчасти",
    ["Запчасть", "Тип", "Артикул", "Производитель", "Остаток", "Цена", "Действия"],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-part">+ Добавить запчасть</button>',
    tableTools("Поиск по названию, типу, артикулу или производителю")
  );
}

