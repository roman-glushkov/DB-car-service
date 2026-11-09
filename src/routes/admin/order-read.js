const express = require("express");
const router = express.Router();
const { query } = require("../../config/db");
const { httpError, route, positiveId } = require("../../utils/validators");

router.get(
  "/order-options",
  route(async (_req, res) => {
    const [cars, statuses, employees, workTypes] = await Promise.all([
      query(
        `SELECT car.car_id, car.brand, car.model, car.license_plate, c.client_id, c.full_name AS client_name FROM cars car JOIN clients c ON c.client_id = car.client_id ORDER BY car.brand, car.model`
      ),
      query(`SELECT status_id, name FROM order_statuses ORDER BY status_id`),
      query(`SELECT e.employee_id, e.full_name, e.position, e.is_active,
            (SELECT GROUP_CONCAT(w.name ORDER BY w.name SEPARATOR ', ') FROM employee_work_types ewt JOIN work_types w ON w.work_type_id = ewt.work_type_id WHERE ewt.employee_id = e.employee_id) AS skills,
            (SELECT GROUP_CONCAT(ewt.work_type_id ORDER BY ewt.work_type_id SEPARATOR ',') FROM employee_work_types ewt WHERE ewt.employee_id = e.employee_id) AS skill_ids
           FROM employees e ORDER BY e.is_active DESC, e.full_name`),
      query(
        `SELECT work_type_id, name, default_price, estimated_duration FROM work_types ORDER BY name`
      ),
    ]);
    res.json({ cars, statuses, employees, workTypes });
  })
);

router.get(
  "/orders",
  route(async (_req, res) => {
    const rows = await query(`
    SELECT o.order_id, o.car_id, o.employee_id, o.status_id, o.created_at, o.planned_finish_date, o.mileage, o.finished_at, o.complaint, o.diagnosis, o.comment,
           car.license_plate, car.vin, car.brand, car.model, car.photo_path, c.full_name AS client_name, e.full_name AS employee_name, s.name AS status_name,
           COALESCE((SELECT SUM(ow.quantity * ow.price) FROM order_works ow WHERE ow.order_id = o.order_id), 0) + COALESCE((SELECT SUM(op.quantity * op.price) FROM order_parts op WHERE op.order_id = o.order_id), 0) AS order_total
    FROM orders o
    JOIN cars car ON car.car_id = o.car_id
    JOIN clients c ON c.client_id = car.client_id
    LEFT JOIN employees e ON e.employee_id = o.employee_id
    JOIN order_statuses s ON s.status_id = o.status_id
    ORDER BY o.created_at DESC, o.order_id DESC
  `);
    res.json(
      rows.map((row) => ({ ...row, order_total: Number(row.order_total) }))
    );
  })
);

router.get(
  "/orders/:id",
  route(async (req, res) => {
    const id = positiveId(req.params.id, "order_id");
    const [orders, works, parts, events] = await Promise.all([
      query(
        `SELECT o.*, car.brand, car.model, car.license_plate, c.full_name AS client_name, e.full_name AS employee_name, s.name AS status_name
           FROM orders o JOIN cars car ON car.car_id = o.car_id JOIN clients c ON c.client_id = car.client_id
           LEFT JOIN employees e ON e.employee_id = o.employee_id JOIN order_statuses s ON s.status_id = o.status_id WHERE o.order_id = ?`,
        [id]
      ),
      query(
        `SELECT ow.*, wt.name AS work_name FROM order_works ow JOIN work_types wt ON wt.work_type_id = ow.work_type_id WHERE ow.order_id = ?`,
        [id]
      ),
      query(
        `SELECT op.*, p.name AS part_name FROM order_parts op JOIN parts p ON p.part_id = op.part_id WHERE op.order_id = ?`,
        [id]
      ),
      query(
        `SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC, event_id DESC`,
        [id]
      ),
    ]);
    if (!orders.length) throw httpError(404, "Заказ не найден");
    res.json({ order: orders[0], works, parts, events });
  })
);

module.exports = router;
