const express = require("express");
const router = express.Router();
const { query } = require("../../config/db");
const { httpError, route, positiveId, cleanText } = require("../../utils/validators");

router.get(
  "/work-types",
  route(async (_req, res) => {
    res.json(
      await query(
        "SELECT work_type_id, name, default_price, estimated_duration FROM work_types ORDER BY name"
      )
    );
  })
);

router.post(
  "/work-types",
  route(async (req, res) => {
    const name = cleanText(req.body?.name, 150);
    const price = Number(req.body?.default_price);
    const duration =
      req.body?.estimated_duration === "" ||
      req.body?.estimated_duration == null
        ? null
        : Number(req.body.estimated_duration);
    if (!name) throw httpError(400, "Укажите название работы.");
    if (!Number.isFinite(price) || price < 0) {
      throw httpError(400, "Базовая цена должна быть неотрицательным числом.");
    }
    if (
      duration !== null &&
      (!Number.isSafeInteger(duration) || duration < 1)
    ) {
      throw httpError(400, "Время должно быть целым числом от 1 минуты.");
    }
    const result = await query(
      "INSERT INTO work_types (name, default_price, estimated_duration) VALUES (?, ?, ?)",
      [name, price, duration]
    );
    res.status(201).json({ ok: true, work_type_id: Number(result.insertId) });
  })
);

router.patch(
  "/work-types/:id",
  route(async (req, res) => {
    const workTypeId = positiveId(req.params.id, "вида работы");
    const existingRows = await query(
      "SELECT work_type_id, name, default_price, estimated_duration FROM work_types WHERE work_type_id = ?",
      [workTypeId]
    );
    if (!existingRows.length) throw httpError(404, "Работа не найдена.");
    const existing = existingRows[0];
    const name =
      req.body?.name === undefined
        ? existing.name
        : cleanText(req.body.name, 150);
    const price =
      req.body?.default_price === undefined
        ? Number(existing.default_price)
        : Number(req.body.default_price);
    const duration =
      req.body?.estimated_duration === undefined
        ? existing.estimated_duration == null
          ? null
          : Number(existing.estimated_duration)
        : req.body.estimated_duration === "" ||
          req.body.estimated_duration == null
        ? null
        : Number(req.body.estimated_duration);
    if (!name) throw httpError(400, "Укажите название работы.");
    if (!Number.isFinite(price) || price < 0) {
      throw httpError(400, "Базовая цена должна быть неотрицательным числом.");
    }
    if (
      duration !== null &&
      (!Number.isSafeInteger(duration) || duration < 1)
    ) {
      throw httpError(400, "Время должно быть целым числом от 1 минуты.");
    }
    await query(
      "UPDATE work_types SET name = ?, default_price = ?, estimated_duration = ? WHERE work_type_id = ?",
      [name, price, duration, workTypeId]
    );
    res.json({ ok: true, work_type_id: workTypeId });
  })
);

module.exports = router;
