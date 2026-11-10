async function payments() {
  const [list, stats] = await Promise.all([
    api("/api/payments"),
    api("/api/payments/stats"),
  ]);
  const rows = list
    .map(
      (item) => `
    <tr data-search="${esc(
      `${item.order_id} ${item.license_plate || ""} ${item.client_name} ${
        item.brand
      } ${item.model}`
    )}">
      <td>${item.payment_date ? dateTime(item.payment_date) : "—"}</td>
      <td>
        <b>#${esc(item.order_id)} · ${esc(
        item.license_plate || "Без номера"
      )} · ${esc(item.brand)} ${esc(item.model)}</b>
        <div class="muted-mini">${esc(item.client_name)}</div>
      </td>
      <td><b>${money(item.amount)}</b></td>
      <td>${esc(item.payment_method || "—")}</td><td><button class="action-btn" data-action="delete-record" data-kind="payments" data-id="${Number(item.payment_id)}">Удалить</button></td>
    </tr>`
    )
    .join("");

  const highestMonth = Math.max(
    1,
    ...stats.monthly_revenue.map((item) => Number(item.revenue))
  );
  const chart = stats.monthly_revenue
    .map((item) => {
      const monthLabel = new Date(item.year, item.month - 1, 1)
        .toLocaleDateString("ru-RU", { month: "short" })
        .replace(".", "");
      const height = Math.max(2, (Number(item.revenue) / highestMonth) * 100);
      return `<div class="revenue-month" title="${esc(
        `${monthLabel} ${item.year}: ${money(item.revenue)}`
      )}">
        <div class="revenue-bar-track"><span class="revenue-bar" style="height:${height}%"></span></div>
        <small>${esc(monthLabel)}</small>
      </div>`;
    })
    .join("");
  const ranking = stats.work_ranking.length
    ? stats.work_ranking
        .map(
          (item, index) => `<li>
            <span class="work-rank-number">${index + 1}</span>
            <span class="work-rank-name">${esc(item.name)}<small>${Number(
            item.order_count
          )} заказов</small></span>
            <b>${money(item.revenue)}</b>
          </li>`
        )
        .join("")
    : '<li class="work-rank-empty">Пока нет данных о выполненных работах</li>';
  const analytics = `
    <section class="payments-analytics">
      <div class="payment-kpis">
        <article class="payment-kpi"><span>Выручка за текущий месяц</span><strong>${money(
          stats.current_month_revenue
        )}</strong></article>
        <article class="payment-kpi"><span>Выручка за текущий год</span><strong>${money(
          stats.current_year_revenue
        )}</strong></article>
      </div>
      <div class="payment-analytics-grid">
        <article class="payment-chart-card">
          <div class="payment-card-heading"><h2>Выручка по месяцам</h2><span>Последние 12 месяцев</span></div>
          <div class="revenue-chart">${chart}</div>
        </article>
        <article class="payment-ranking-card">
          <div class="payment-card-heading"><h2>Доходные работы</h2><span>По сумме работ</span></div>
          <ol class="work-ranking">${ranking}</ol>
          <p class="payment-chart-note">Суммы рассчитаны по стоимости работ в заказ-нарядах, без вычета себестоимости запчастей и расходов.</p>
        </article>
      </div>
    </section>`;

  return page(
    "Оплаты",
    ["Дата", "Заказ", "Сумма", "Способ", "Действия"],
    rows,
    '<button class="action-btn action-btn-primary" data-action="create-payment">+ Внести оплату</button>',
    tableTools("Поиск по заказу, автомобилю или клиенту"),
    analytics
  );
}

