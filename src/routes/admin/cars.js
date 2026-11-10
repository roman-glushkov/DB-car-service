const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const router = express.Router();
const { query } = require("../../config/db");
const { ROOT_DIR } = require("../../config/paths");
const { httpError, route, positiveId } = require("../../utils/validators");
const carPhotoUpload = require("../../middleware/car-upload");
const { car } = require("../../utils/record-validation");

router.post(
  "/cars/:id/photo",
  carPhotoUpload.single("photo"),
  route(async (req, res) => {
    const carId = positiveId(req.params.id, "автомобиля");
    if (!req.file) throw httpError(400, "Выберите изображение.");
    const rows = await query(
      "SELECT car_id, photo_path FROM cars WHERE car_id = ?",
      [carId]
    );
    if (!rows.length) throw httpError(404, "Автомобиль не найден.");
    const photoPath = `/uploads/cars/${req.file.filename}`;
    await query("UPDATE cars SET photo_path = ? WHERE car_id = ?", [
      photoPath,
      carId,
    ]);
    if (rows[0].photo_path?.startsWith("/uploads/cars/")) {
      const oldFile = path.join(
        ROOT_DIR,
        rows[0].photo_path.replace(/^\//, "")
      );
      fs.promises.unlink(oldFile).catch(() => {});
    }
    res.json({ ok: true, photo_path: photoPath });
  })
);

router.get(
  "/cars",
  route(async (_req, res) => {
    res.json(
      await query(`
    SELECT car.car_id, car.client_id, car.vin, car.license_plate, car.brand, car.model, car.year, car.photo_path, c.full_name AS client_name,
           (SELECT o.mileage FROM orders o WHERE o.car_id = car.car_id AND o.mileage IS NOT NULL ORDER BY o.created_at DESC, o.order_id DESC LIMIT 1) AS mileage
    FROM cars car JOIN clients c ON c.client_id = car.client_id ORDER BY car.brand, car.model
  `)
    );
  })
);

router.post("/cars", route(async (req, res) => {
  const data = car(req.body || {});
  const owner = await query("SELECT client_id FROM clients WHERE client_id = ?", [data.client_id]);
  if (!owner.length) throw httpError(404, "Клиент не найден.");
  const result = await query("INSERT INTO cars (client_id, brand, model, vin, license_plate, year) VALUES (?, ?, ?, ?, ?, ?)", [data.client_id, data.brand, data.model, data.vin, data.license_plate, data.year]);
  res.status(201).json({ ok: true, car_id: Number(result.insertId) });
}));
router.put("/cars/:id", route(async (req, res) => {
  const id = positiveId(req.params.id, "автомобиля");
  const data = car(req.body || {});
  const owner = await query("SELECT client_id FROM clients WHERE client_id = ?", [data.client_id]);
  if (!owner.length) throw httpError(404, "Клиент не найден.");
  const result = await query("UPDATE cars SET client_id=?, brand=?, model=?, vin=?, license_plate=?, year=? WHERE car_id=?", [data.client_id, data.brand, data.model, data.vin, data.license_plate, data.year, id]);
  if (!result.affectedRows) throw httpError(404, "Автомобиль не найден.");
  res.json({ ok: true });
}));
router.delete("/cars/:id/photo", route(async (req, res) => {
  const id = positiveId(req.params.id, "автомобиля");
  const rows = await query("SELECT photo_path FROM cars WHERE car_id=?", [id]);
  if (!rows.length) throw httpError(404, "Автомобиль не найден.");
  await query("UPDATE cars SET photo_path=NULL WHERE car_id=?", [id]);
  if (rows[0].photo_path?.startsWith("/uploads/cars/")) {
    const oldFile = path.join(ROOT_DIR, rows[0].photo_path.replace(/^\//, ""));
    await fs.promises.unlink(oldFile).catch(() => {});
  }
  res.json({ ok:true });
}));
router.delete("/cars/:id", route(async (req, res) => {
  const id = positiveId(req.params.id, "автомобиля");
  const linked = await query("SELECT order_id FROM orders WHERE car_id=? LIMIT 1", [id]);
  if (linked.length) throw httpError(409, "Удаление запрещено: у автомобиля есть заказы. Историю необходимо сохранять.");
  const rows = await query("SELECT photo_path FROM cars WHERE car_id=?", [id]);
  if (!rows.length) throw httpError(404, "Автомобиль не найден.");
  await query("DELETE FROM cars WHERE car_id=?", [id]);
  if (rows[0].photo_path?.startsWith("/uploads/cars/")) await fs.promises.unlink(path.join(ROOT_DIR, rows[0].photo_path.replace(/^\//,""))).catch(() => {});
  res.json({ ok:true });
}));
router.get("/car-clients", route(async (_req,res) => res.json(await query("SELECT client_id, full_name FROM clients ORDER BY full_name"))));
module.exports = router;
