const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const router = express.Router();
const { query } = require("../../config/db");
const { ROOT_DIR } = require("../../config/paths");
const { httpError, route, positiveId } = require("../../utils/validators");
const carPhotoUpload = require("../../middleware/car-upload");

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
    SELECT car.car_id, car.vin, car.license_plate, car.brand, car.model, car.year, car.photo_path, c.full_name AS client_name,
           (SELECT o.mileage FROM orders o WHERE o.car_id = car.car_id AND o.mileage IS NOT NULL ORDER BY o.created_at DESC, o.order_id DESC LIMIT 1) AS mileage
    FROM cars car JOIN clients c ON c.client_id = car.client_id ORDER BY car.brand, car.model
  `)
    );
  })
);

module.exports = router;
