let ordersPage = 1;
const ORDERS_PAGE_SIZE = 25;

function applyTableFilters() {
  const content = document.getElementById("content");
  const searchInput = content.querySelector("[data-table-search]");
  const statusSelect = content.querySelector("[data-table-status]");
  const pagination = content.querySelector("#tablePagination");
  const tbody = content.querySelector(".data-table tbody");
  if (!tbody) return;

  if (pagination && !orderRowsCache.length) {
    orderRowsCache = [...tbody.querySelectorAll("tr[data-search]")];
  }
  const rows = pagination
    ? orderRowsCache
    : [...tbody.querySelectorAll("tr[data-search]")];
  const term = String(searchInput?.value || "")
    .trim()
    .toLocaleLowerCase("ru-RU");
  const status = statusSelect?.value || "";
  const matches = rows.filter((row) => {
    const searchMatch = String(row.dataset.search || "")
      .toLocaleLowerCase("ru-RU")
      .includes(term);
    const statusMatch = !status || row.dataset.status === status;
    return searchMatch && statusMatch;
  });

  if (pagination) {
    const pageCount = Math.max(1, Math.ceil(matches.length / ORDERS_PAGE_SIZE));
    ordersPage = Math.min(Math.max(1, ordersPage), pageCount);
    const startIndex = (ordersPage - 1) * ORDERS_PAGE_SIZE;
    const visibleRows = matches.slice(
      startIndex,
      startIndex + ORDERS_PAGE_SIZE
    );
    tbody.replaceChildren(...visibleRows);
    if (!matches.length && rows.length) {
      const emptyRow = document.createElement("tr");
      const cell = document.createElement("td");
      cell.className = "empty-cell";
      cell.colSpan = content.querySelectorAll(".data-table thead th").length;
      cell.textContent = "Заказы по заданным условиям не найдены";
      emptyRow.append(cell);
      tbody.append(emptyRow);
    }
    pagination.innerHTML = `
      <span>${
        matches.length
          ? `Показано ${startIndex + 1}–${Math.min(
              startIndex + ORDERS_PAGE_SIZE,
              matches.length
            )} из ${matches.length}`
          : "Заказы не найдены"
      }</span>
      <div class="pagination-buttons">
        <button type="button" data-page="${Math.max(1, ordersPage - 1)}" ${
      ordersPage === 1 ? "disabled" : ""
    }>Назад</button>
        <b>${ordersPage} / ${pageCount}</b>
        <button type="button" data-page="${Math.min(
          pageCount,
          ordersPage + 1
        )}" ${ordersPage === pageCount ? "disabled" : ""}>Вперёд</button>
      </div>`;
    const count = content.querySelector("#tableCount");
    if (count) count.textContent = `${matches.length} заказов`;
    return;
  }

  rows.forEach((row) => {
    row.hidden = !matches.includes(row);
  });
  let emptyRow = content.querySelector("[data-filter-empty]");
  if (!emptyRow && rows.length) {
    emptyRow = document.createElement("tr");
    emptyRow.dataset.filterEmpty = "true";
    const cell = document.createElement("td");
    cell.className = "empty-cell";
    cell.colSpan = content.querySelectorAll(".data-table thead th").length;
    cell.textContent = "По заданным условиям ничего не найдено";
    emptyRow.append(cell);
    tbody.append(emptyRow);
  }
  if (emptyRow) emptyRow.hidden = matches.length > 0 || rows.length === 0;
}

document.getElementById("content").addEventListener("input", (event) => {
  if (event.target.matches("[data-table-search]")) {
    ordersPage = 1;
    applyTableFilters();
  }
});
document.getElementById("content").addEventListener("change", (event) => {
  if (event.target.matches("[data-table-status]")) {
    ordersPage = 1;
    applyTableFilters();
  }
});
document.getElementById("content").addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton && !pageButton.disabled) {
    ordersPage = Number(pageButton.dataset.page) || 1;
    applyTableFilters();
  }
});


// Сортировка щелчком по заголовку: текст, сумма, дата, числа.
const sortState = {column:-1,ascending:true};
document.getElementById('content').addEventListener('click',event=>{
  const header=event.target.closest('.data-table thead th');
  if(!header)return;
  const table=header.closest('table'), tbody=table?.querySelector('tbody');
  if(!tbody)return;
  const headers=[...header.parentElement.children],column=headers.indexOf(header);
  if(column<0)return;
  sortState.ascending=sortState.column===column?!sortState.ascending:true;
  sortState.column=column;
  const rows=[...tbody.querySelectorAll('tr[data-search]')];
  const collator=new Intl.Collator('ru',{numeric:true,sensitivity:'base'});
  rows.sort((a,b)=>{
    const va=(a.children[column]?.textContent||'').trim(), vb=(b.children[column]?.textContent||'').trim();
    return (sortState.ascending?1:-1)*collator.compare(va,vb);
  });
  if(table.closest('.page')?.querySelector('#tablePagination')){orderRowsCache=rows;ordersPage=1;}
  tbody.replaceChildren(...rows);
  applyTableFilters();
  headers.forEach(h=>{h.removeAttribute('aria-sort');h.style.cursor='pointer';});
  header.setAttribute('aria-sort',sortState.ascending?'ascending':'descending');
});
