const { httpError, cleanText } = require("../utils/validators");

async function addOrderEvent(
  conn,
  orderId,
  actor,
  message,
  eventType = "update"
) {
  await conn.query(
    `INSERT INTO order_events (order_id, actor_name, event_type, message) VALUES (?, ?, ?, ?)`,
    [
      orderId,
      cleanText(actor || "Панель автосервиса", 150),
      eventType,
      cleanText(message, 2000),
    ]
  );
}

async function validateEmployeeSkills(conn, employeeId, workTypeIds) {
  if (!employeeId) return;
  const employeeRows = await conn.query(
    "SELECT employee_id, is_active FROM employees WHERE employee_id = ?",
    [employeeId]
  );
  const employee = employeeRows[0];
  if (!employee || !Number(employee.is_active)) {
    throw httpError(400, "Выбранный сотрудник не найден или неактивен");
  }
  if (!workTypeIds.length) return;
  const placeholders = workTypeIds.map(() => "?").join(",");
  const skillRows = await conn.query(
    `SELECT work_type_id FROM employee_work_types WHERE employee_id = ? AND work_type_id IN (${placeholders})`,
    [employeeId, ...workTypeIds]
  );
  const found = new Set(skillRows.map((row) => Number(row.work_type_id)));
  if (workTypeIds.some((id) => !found.has(id))) {
    throw httpError(
      400,
      "У сотрудника нет необходимых навыков для этого заказа"
    );
  }
}

async function findLeastLoadedEmployee(conn, workTypeIds) {
  if (!workTypeIds.length) return null;
  const placeholders = workTypeIds.map(() => "?").join(",");
  const rows = await conn.query(
    `SELECT e.employee_id, COUNT(DISTINCT ewt.work_type_id) AS matched_skills,
       (SELECT COUNT(*) FROM orders active_order
        JOIN order_statuses active_status ON active_status.status_id = active_order.status_id
        WHERE active_order.employee_id = e.employee_id
          AND active_status.name NOT IN ('Готов', 'Выдан', 'Отменён')) AS active_orders
     FROM employees e
     JOIN employee_work_types ewt ON ewt.employee_id = e.employee_id
     WHERE e.is_active = 1 AND ewt.work_type_id IN (${placeholders})
     GROUP BY e.employee_id
     HAVING COUNT(DISTINCT ewt.work_type_id) = ?
     ORDER BY active_orders ASC, e.employee_id ASC LIMIT 1`,
    [...workTypeIds, workTypeIds.length]
  );
  return rows.length ? Number(rows[0].employee_id) : null;
}

module.exports = { addOrderEvent, validateEmployeeSkills, findLeastLoadedEmployee };
