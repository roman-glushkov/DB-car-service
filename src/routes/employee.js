const express = require("express");
const router = express.Router();
const { pool, query } = require("../config/db");
const { httpError, route, positiveId, cleanText } = require("../utils/validators");
const { requireRole } = require("../middleware/auth");
const { addOrderEvent } = require("../services/order-service");

router.get(
  "/dashboard",
  requireRole("employee"),
  route(async (req, res) => {
    const employeeRows = await query(
      "SELECT employee_id, full_name, position, phone, is_active FROM employees WHERE employee_id = ?",
      [req.user.employee_id]
    );
    if (!employeeRows.length || !Number(employeeRows[0].is_active))
      throw httpError(403, "Профиль сотрудника неактивен.");
    const [orders, statuses] = await Promise.all([
      query(
        `SELECT o.order_id, o.car_id, o.status_id, o.created_at, o.planned_finish_date, o.mileage,
                o.finished_at, o.complaint, o.diagnosis, o.comment, car.brand, car.model,
                car.license_plate, car.photo_path, c.full_name AS client_name, c.phone AS client_phone,
                s.name AS status_name,
                (SELECT GROUP_CONCAT(wt.name ORDER BY wt.name SEPARATOR ', ')
                   FROM order_works ow2 JOIN work_types wt ON wt.work_type_id = ow2.work_type_id
                  WHERE ow2.order_id = o.order_id
                    AND (ow2.employee_id = ? OR (o.employee_id = ? AND ow2.employee_id IS NULL))) AS work_summary,
                COALESCE((SELECT SUM(ow3.quantity * ow3.price) FROM order_works ow3 WHERE ow3.order_id = o.order_id), 0)
                + COALESCE((SELECT SUM(op.quantity * op.price) FROM order_parts op WHERE op.order_id = o.order_id), 0) AS order_total
           FROM orders o JOIN cars car ON car.car_id = o.car_id
           JOIN clients c ON c.client_id = car.client_id
           JOIN order_statuses s ON s.status_id = o.status_id
          WHERE o.employee_id = ? OR EXISTS (
            SELECT 1 FROM order_works assigned_work
             WHERE assigned_work.order_id = o.order_id AND assigned_work.employee_id = ?
          )
          ORDER BY o.planned_finish_date IS NULL, o.planned_finish_date, o.created_at DESC`,
        [
          req.user.employee_id,
          req.user.employee_id,
          req.user.employee_id,
          req.user.employee_id,
        ]
      ),
      query("SELECT status_id, name FROM order_statuses ORDER BY status_id"),
    ]);
    const orderIds = orders.map((order) => Number(order.order_id));
    const [works, events] = orderIds.length
      ? await Promise.all([
          query(
            `SELECT ow.order_id, ow.order_work_id, ow.quantity, ow.price, wt.name AS work_name
               FROM order_works ow JOIN work_types wt ON wt.work_type_id = ow.work_type_id
               JOIN orders assigned_order ON assigned_order.order_id = ow.order_id
              WHERE ow.order_id IN (${orderIds.map(() => "?").join(",")})
                AND (ow.employee_id = ? OR (assigned_order.employee_id = ? AND ow.employee_id IS NULL))
              ORDER BY ow.order_id, ow.order_work_id`,
            [...orderIds, req.user.employee_id, req.user.employee_id]
          ),
          query(
            `SELECT event_id, order_id, actor_name, event_type, message, created_at
               FROM order_events WHERE order_id IN (${orderIds
                 .map(() => "?")
                 .join(",")})
              ORDER BY created_at DESC, event_id DESC`,
            orderIds
          ),
        ])
      : [[], []];
    res.json({ employee: employeeRows[0], orders, works, events, statuses });
  })
);

router.patch(
  "/orders/:id",
  requireRole("employee"),
  route(async (req, res) => {
    const orderId = positiveId(req.params.id, "заказа");
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const rows = await conn.query(
        `SELECT o.*, s.name AS status_name FROM orders o
          JOIN order_statuses s ON s.status_id = o.status_id
         WHERE o.order_id = ? AND (o.employee_id = ? OR EXISTS (
           SELECT 1 FROM order_works ow WHERE ow.order_id = o.order_id AND ow.employee_id = ?
         )) FOR UPDATE`,
        [orderId, req.user.employee_id, req.user.employee_id]
      );
      if (!rows.length)
        throw httpError(404, "Заказ не найден или не назначен вам.");
      const current = rows[0];
      const updates = {};
      let nextStatusName = current.status_name;
      if (req.body?.status_id !== undefined) {
        const statusId = positiveId(req.body.status_id, "статуса");
        const statusRows = await conn.query(
          "SELECT status_id, name FROM order_statuses WHERE status_id = ?",
          [statusId]
        );
        if (!statusRows.length) throw httpError(400, "Статус не найден.");
        const allowed = [
          "Диагностика",
          "В работе",
          "Ожидание запчастей",
          "Готов",
        ];
        if (
          statusRows[0].name !== current.status_name &&
          !allowed.includes(statusRows[0].name)
        ) {
          throw httpError(403, "Сотруднику нельзя установить этот статус.");
        }
        updates.status_id = statusId;
        nextStatusName = statusRows[0].name;
      }
      if (req.body?.diagnosis !== undefined)
        updates.diagnosis = cleanText(req.body.diagnosis, 10000) || null;
      if (req.body?.comment !== undefined)
        updates.comment = cleanText(req.body.comment, 10000) || null;
      if (!Object.keys(updates).length)
        throw httpError(400, "Нет данных для обновления.");
      const fields = Object.keys(updates);
      const values = fields.map((field) => updates[field]);
      const finishSql =
        nextStatusName === "Готов"
          ? ", finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP)"
          : "";
      await conn.query(
        `UPDATE orders SET ${fields
          .map((field) => `\`${field}\` = ?`)
          .join(", ")}${finishSql} WHERE order_id = ?`,
        [...values, orderId]
      );
      const changes = [];
      if (
        updates.status_id !== undefined &&
        nextStatusName !== current.status_name
      )
        changes.push(`Статус: «${current.status_name}» → «${nextStatusName}»`);
      if (updates.diagnosis !== undefined)
        changes.push("Обновлена диагностика");
      if (updates.comment !== undefined)
        changes.push("Обновлен комментарий мастера");
      await addOrderEvent(
        conn,
        orderId,
        req.user.name,
        changes.join(". "),
        "employee_update"
      );
      await conn.commit();
      res.json({ ok: true, order_id: orderId });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
