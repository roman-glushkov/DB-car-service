async function parts() {
  const list = await api("/api/parts");
  const rows = list
    .map(
      (item) => `
    <tr data-search="${esc(`${item.name} ${item.article || ""}`)}">
      <td><b>${esc(item.name)}</b></td>
      <td>${esc(item.part_type || "—")}</td>
      <td>${esc(item.article || "—")}</td>
      <td>${esc(item.manufacturer || "—")}</td>
      <td>${esc(item.stock_quantity)} шт.</td>
      <td>${money(item.price)}</td>
    </tr>`
    )
    .join("");

  return page(
    "Запчасти",
    ["Запчасть", "Тип", "Артикул", "Производитель", "Остаток", "Цена"],
    rows,
    "",
    tableTools("Поиск по названию или артикулу")
  );
}

