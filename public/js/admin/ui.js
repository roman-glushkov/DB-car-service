function page(
  title,
  columns,
  rows,
  actions = "",
  toolbar = "",
  beforeTable = ""
) {
  return `
    <div class="page">
      <div class="page-head">
        <div><h1>${title}</h1></div>
        ${actions ? `<div class="page-actions">${actions}</div>` : ""}
      </div>
      ${beforeTable}
      ${toolbar}
      <div class="panel data-panel">
        <table class="data-table">
          <thead>
            <tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>
          </thead>
          <tbody>${
            rows ||
            `<tr><td class="empty-cell" colspan="${columns.length}">Нет данных</td></tr>`
          }
          </tbody>
        </table>
        ${
          title === "Заказы"
            ? '<div class="table-pagination" id="tablePagination"></div>'
            : ""
        }
      </div>
    </div>`;
}

function tableTools(placeholder, extra = "") {
  return `
    <div class="table-toolbar">
      <label class="table-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" data-table-search placeholder="${esc(
          placeholder
        )}" autocomplete="off">
      </label>
      ${extra}
    </div>`;
}


function ensureUpgradeStyles() {
  if (document.getElementById("upgradeStyles")) return;
  const style = document.createElement("style");
  style.id = "upgradeStyles";
  style.textContent = `
    .page-actions{display:flex;gap:10px;align-items:center}
    .action-btn{border:1px solid #dfe6df;background:#fff;color:#30443a;border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;white-space:nowrap}
    .action-btn:hover{border-color:#a9bd35;background:#f8faed}
    .action-btn-primary{background:#d9f34a;border-color:#d9f34a;color:#17201d}
    .modal-backdrop{position:fixed;inset:0;background:rgba(17,27,22,.58);z-index:100;display:grid;place-items:center;padding:18px;overflow:auto}
    .app-modal{width:min(760px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.25);padding:24px}
    .app-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:20px}
    .app-modal-head h2{margin:0;font:800 22px Manrope,Inter,sans-serif;color:#1c2a23}
    .app-modal-head p{margin:6px 0 0;font-size:11px;color:#839088}
    .app-modal-close{border:0;background:#f1f4f0;border-radius:9px;width:34px;height:34px;font-size:20px;color:#4c5d53}
    .app-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
    .app-field{display:flex;flex-direction:column;gap:6px;min-width:0;font-size:11px;font-weight:700;color:#4a5c51}
    .app-field-full{grid-column:1/-1}
    .app-field input,.app-field select,.app-field textarea{width:100%;border:1px solid #dfe6df;border-radius:8px;padding:10px 11px;background:#fff;color:#27372e;font:12px Inter,Arial,sans-serif;outline:none}
    .app-field textarea{min-height:80px;resize:vertical}
    .app-field input:focus,.app-field select:focus,.app-field textarea:focus{border-color:#a3bc36;box-shadow:0 0 0 3px rgba(217,243,74,.2)}
    .app-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px;padding-top:16px;border-top:1px solid #edf0ed}
    .app-modal-note{background:#f6f8f2;padding:11px 13px;border-radius:9px;color:#68776c;font-size:11px;line-height:1.5;margin:12px 0}
    .work-lines{display:grid;gap:8px}
    .work-line{display:grid;grid-template-columns:minmax(0,1fr) 90px 34px;gap:8px;align-items:center}
    .work-line select,.work-line input{width:100%;border:1px solid #dfe6df;border-radius:8px;padding:9px;background:#fff;font:12px Inter,Arial,sans-serif}
    .work-line-remove{height:34px;border:0;border-radius:8px;background:#fbeeea;color:#a84c37;font-weight:800}
    .skill-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:5px}
    .skill-option{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #e5ebe4;border-radius:8px;font-size:11px;color:#425247;font-weight:500}
    .status.s-muted{background:#edf0ed;color:#7d8980}
    .history-list{display:grid;gap:9px;margin-top:12px}
    .history-item{border-left:2px solid #d9f34a;padding:3px 0 3px 11px;font-size:11px;color:#3f5045}
    .history-item small{display:block;color:#89968d;margin-top:4px}
    .modal-error{background:#fff0ed;border:1px solid #f2c8be;color:#8c3e2d;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:11px}
    @media(max-width:620px){.app-modal{padding:18px}.app-form-grid{grid-template-columns:1fr}.app-field-full{grid-column:auto}.skill-list{grid-template-columns:1fr}.work-line{grid-template-columns:minmax(0,1fr) 74px 32px}.page-actions{width:100%}.page-head{align-items:flex-start;flex-direction:column}}
  `;
  document.head.append(style);
}

function modalShell(title, subtitle, body) {
  ensureUpgradeStyles();
  const wrapper = document.createElement("div");
  wrapper.className = "modal-backdrop";
  wrapper.innerHTML = `
    <section class="app-modal" role="dialog" aria-modal="true">
      <div class="app-modal-head">
        <div><h2>${esc(title)}</h2><p>${esc(
    subtitle || "AutoPro · панель автосервиса"
  )}</p></div>
        <button type="button" class="app-modal-close" data-modal-close aria-label="Закрыть">×</button>
      </div>
      ${body}
    </section>`;
  document.body.append(wrapper);
  wrapper.addEventListener("click", (event) => {
    if (event.target === wrapper || event.target.closest("[data-modal-close]"))
      wrapper.remove();
  });
  return wrapper;
}

function employeeOptions(employees, selectedId = "", includeAuto = false) {
  const active = employees.filter((employee) => Number(employee.is_active));
  const selectedInactive = employees.find(
    (employee) =>
      Number(employee.employee_id) === Number(selectedId) &&
      !Number(employee.is_active)
  );
  const visibleEmployees = selectedInactive
    ? [...active, selectedInactive]
    : active;
  return `${
    includeAuto
      ? '<option value="">Автоматически по навыку и загрузке</option>'
      : '<option value="">Не назначен</option>'
  }
    ${visibleEmployees
      .map(
        (employee) => `
      <option value="${Number(employee.employee_id)}" ${
          Number(selectedId) === Number(employee.employee_id) ? "selected" : ""
        }>
        ${esc(employee.full_name)} · ${esc(employee.position)}
      </option>`
      )
      .join("")}`;
}

function workOptions(workTypes, selectedId = "") {
  return workTypes
    .map(
      (work) => `
    <option value="${Number(work.work_type_id)}" ${
        Number(selectedId) === Number(work.work_type_id) ? "selected" : ""
      }>
      ${esc(work.name)} — ${money(work.default_price)}
    </option>`
    )
    .join("");
}

function workLineHtml(workTypes, item = {}) {
  return `
    <div class="work-line" data-work-row>
      <select data-work-type required>${workOptions(
        workTypes,
        item.work_type_id
      )}</select>
      <input data-work-quantity type="number" min="0.1" max="100" step="0.1" value="${esc(
        item.quantity ?? 1
      )}" aria-label="Количество">
      <button class="work-line-remove" type="button" data-remove-work aria-label="Удалить работу">×</button>
    </div>`;
}

