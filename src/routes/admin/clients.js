const express = require("express");
const router = express.Router();
const { pool, query } = require("../../config/db");
const { hashPassword } = require("../../utils/passwords");
const { httpError, route, cleanText } = require("../../utils/validators");

router.post(
  "/clients",
  route(async (req, res) => {
    const fullName = cleanText(req.body?.full_name, 150);
    const phone = cleanText(req.body?.phone, 20);
    const email = cleanText(req.body?.email, 100).toLowerCase();
    if (!fullName || !phone) {
      throw httpError(400, "Укажите ФИО и телефон клиента.");
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw httpError(400, "Укажите корректный email клиента.");
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const clientResult = await conn.query(
        "INSERT INTO clients (full_name, phone, email) VALUES (?, ?, ?)",
        [fullName, phone, email]
      );
      const clientId = Number(clientResult.insertId);
      await conn.query(
        `INSERT INTO user_accounts (email, password_hash, role, display_name, client_id)
         VALUES (?, ?, 'client', ?, ?)`,
        [email, hashPassword("qwerty1234"), fullName, clientId]
      );
      await conn.commit();
      res.status(201).json({
        ok: true,
        client_id: clientId,
        account_created: true,
        default_password: "qwerty1234",
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  })
);

router.get(
  "/clients",
  route(async (_req, res) => {
    res.json(
      await query(
        `SELECT c.client_id, c.full_name, c.phone, c.email, GROUP_CONCAT(CONCAT(car.brand, ' ', car.model, ' · ', COALESCE(car.license_plate, 'без номера')) ORDER BY car.car_id SEPARATOR ', ') AS cars FROM clients c LEFT JOIN cars car ON car.client_id = c.client_id GROUP BY c.client_id ORDER BY c.full_name`
      )
    );
  })
);

module.exports = router;
