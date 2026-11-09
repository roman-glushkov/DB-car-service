const express = require("express");
const router = express.Router();
const { pool } = require("../../config/db");
const { httpError, route, positiveId, optionalId, cleanText, parseDate } = require("../../utils/validators");
const { addOrderEvent, validateEmployeeSkills, findLeastLoadedEmployee } = require("../../services/order-service");

router.post(
  "/orders",
  route(async (req, res) => {
    const body = req.body || {};
    const carId = positiveId(body.car_id, "автомобиля");
    const complaint = cleanText(body.complaint, 5000);
    if (complaint.length < 5)
      throw httpError(400, "Опишите проблему минимум пятью символами");
    const rawWorks = Array.isArray(body.works) ? body.works : [];
    if (!rawWorks.length)
      throw httpError(400, "Добавьте хотя бы одну работу в заказ");
    const works = rawWorks.map((item) => {
      const workTypeId = positiveId(item.work_type_id, "вида работы");
      const quantity = Number(item.quantity ?? 1);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100)
        throw httpError(400, "Некорректное количество");
      return { workTypeId, quantity };
    });
    const workTypeIds = [...new Set(works.map((item) => item.workTypeId))];
    const requestedEmployeeId = optionalId(body.employee_id, "сотрудника");
    const mileage =
      body.mileage === "" || body.mileage == null ? null : Number(body.mileage);
    if (mileage !== null && (!Number.isSafeInteger(mileage) || mileage < 0))
      throw httpError(400, "Пробег должен быть неотрицательным");
    const plannedFinishDate = parseDate(
      body.planned_finish_date,
      "плановой даты"
    );

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const carRows = await conn.query(
        "SELECT car_id FROM cars WHERE car_id = ?",
        [carId]
      );
      if (!carRows.length) throw httpError(404, "Автомобиль не найден");
      const placeholders = workTypeIds.map(() => "?").join(",");
      const workTypeRows = await conn.query(
        `SELECT work_type_id, default_price FROM work_types WHERE work_type_id IN (${placeholders})`,
        workTypeIds
      );
      if (workTypeRows.length !== workTypeIds.length)
        throw httpError(400, "Один или несколько видов работ не найдены");
      const workTypeMap = new Map(
        workTypeRows.map((row) => [Number(row.work_type_id), row])
      );
      const statusRows = await conn.query(
        "SELECT status_id FROM order_statuses WHERE name = ? LIMIT 1",
        ["Принят"]
      );
      if (!statusRows.length) throw httpError(400, "Нет статуса «Принят»");
      const employeeId =
        requestedEmployeeId ||
        (await findLeastLoadedEmployee(conn, workTypeIds));
      await validateEmployeeSkills(conn, employeeId, workTypeIds);
      const insertResult = await conn.query(
        "INSERT INTO orders (car_id, employee_id, status_id, planned_finish_date, mileage, complaint) VALUES (?, ?, ?, ?, ?, ?)",
        [
          carId,
          employeeId,
          statusRows[0].status_id,
          plannedFinishDate,
          mileage,
          complaint,
        ]
      );
      const orderId = Number(insertResult.insertId);
      for (const item of works) {
        const workType = workTypeMap.get(item.workTypeId);
        await conn.query(
          "INSERT INTO order_works (order_id, work_type_id, employee_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
          [
            orderId,
            item.workTypeId,
            employeeId,
            item.quantity,
            workType.default_price,
          ]
        );
      }
      await addOrderEvent(
        conn,
        orderId,
        req.user.name,
        employeeId
          ? `Заказ создан. Назначен сотрудник #${employeeId}.`
          : "Заказ создан.",
        "created"
      );
      await conn.commit();
      res
        .status(201)
        .json({ ok: true, order_id: orderId, employee_id: employeeId });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  })
);

router.patch(
  "/orders/:id",
  route(async (req, res) => {
    const orderId = positiveId(req.params.id, "заказа");
    const body = req.body || {};
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const orderRows = await conn.query(
        "SELECT o.*, s.name AS status_name FROM orders o JOIN order_statuses s ON s.status_id = o.status_id WHERE o.order_id = ? FOR UPDATE",
        [orderId]
      );
      if (!orderRows.length) throw httpError(404, "Заказ не найден");
      const current = orderRows[0];
      const updates = {};
      if (body.status_id !== undefined) {
        const statusId = positiveId(body.status_id, "статуса");
        const statusRows = await conn.query(
          "SELECT status_id, name FROM order_statuses WHERE status_id = ?",
          [statusId]
        );
        if (!statusRows.length) throw httpError(400, "Статус не существует");
        updates.status_id = statusId;
      }
      if (body.employee_id !== undefined) {
        updates.employee_id = optionalId(body.employee_id, "сотрудника");
        const lineRows = await conn.query(
          "SELECT DISTINCT work_type_id FROM order_works WHERE order_id = ?",
          [orderId]
        );
        await validateEmployeeSkills(
          conn,
          updates.employee_id,
          lineRows.map((row) => Number(row.work_type_id))
        );
      }
      if (body.complaint !== undefined) {
        const value = cleanText(body.complaint, 5000);
        if (value.length < 5)
          throw httpError(400, "Описание проблемы слишком короткое");
        updates.complaint = value;
      }
      if (body.diagnosis !== undefined)
        updates.diagnosis = cleanText(body.diagnosis, 10000) || null;
      if (body.comment !== undefined)
        updates.comment = cleanText(body.comment, 10000) || null;
      if (body.planned_finish_date !== undefined)
        updates.planned_finish_date = parseDate(
          body.planned_finish_date,
          "плановой даты"
        );
      if (body.mileage !== undefined) {
        const value =
          body.mileage === "" || body.mileage === null
            ? null
            : Number(body.mileage);
        if (value !== null && (!Number.isSafeInteger(value) || value < 0))
          throw httpError(400, "Некорректный пробег");
        updates.mileage = value;
      }
      if (!Object.keys(updates).length)
        throw httpError(400, "Нет полей для изменения");
      const fields = Object.keys(updates);
      const values = fields.map((field) => updates[field]);
      let newStatusName = current.status_name;
      if (updates.status_id !== undefined) {
        const rows = await conn.query(
          "SELECT name FROM order_statuses WHERE status_id = ?",
          [updates.status_id]
        );
        newStatusName = rows[0].name;
      }
      if (["Готов", "Выдан"].includes(newStatusName)) {
        await conn.query(
          `UPDATE orders SET ${fields
            .map((field) => `\`${field}\` = ?`)
            .join(
              ", "
            )}, finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP) WHERE order_id = ?`,
          [...values, orderId]
        );
      } else {
        await conn.query(
          `UPDATE orders SET ${fields
            .map((field) => `\`${field}\` = ?`)
            .join(", ")} WHERE order_id = ?`,
          [...values, orderId]
        );
      }
      if (updates.employee_id !== undefined) {
        await conn.query(
          "UPDATE order_works SET employee_id = ? WHERE order_id = ?",
          [updates.employee_id, orderId]
        );
      }
      const messages = [];
      if (
        updates.status_id !== undefined &&
        newStatusName !== current.status_name
      )
        messages.push(`Статус: «${current.status_name}» → «${newStatusName}»`);
      if (
        updates.employee_id !== undefined &&
        updates.employee_id !== current.employee_id
      )
        messages.push(
          updates.employee_id
            ? `Назначен сотрудник #${updates.employee_id}`
            : "Сотрудник снят"
        );
      if (updates.diagnosis !== undefined) messages.push("Диагностика");
      if (updates.complaint !== undefined) messages.push("Описание проблемы");
      if (updates.planned_finish_date !== undefined)
        messages.push("Плановая дата");
      if (updates.mileage !== undefined) messages.push("Пробег");
      if (updates.comment !== undefined) messages.push("Комментарий");
      await addOrderEvent(
        conn,
        orderId,
        req.user.name,
        messages.join(". ") || "Заказ обновлён",
        "updated"
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
