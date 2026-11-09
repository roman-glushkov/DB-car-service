const express = require("express");
const router = express.Router();
const { query } = require("../../config/db");
const { hashPassword } = require("../../utils/passwords");
const { httpError, route, positiveId, optionalId, cleanText } = require("../../utils/validators");

router.get(
  "/accounts",
  route(async (_req, res) => {
    const rows = await query(
      `SELECT a.account_id, a.email, a.role, a.is_active, a.created_at, a.client_id, a.employee_id,
              COALESCE(c.full_name, e.full_name, a.display_name, 'Администратор') AS profile_name
         FROM user_accounts a
         LEFT JOIN clients c ON c.client_id = a.client_id
         LEFT JOIN employees e ON e.employee_id = a.employee_id
        ORDER BY a.created_at DESC, a.account_id DESC`
    );
    res.json(rows);
  })
);

router.get(
  "/account-options",
  route(async (_req, res) => {
    const [clients, employees] = await Promise.all([
      query(
        `SELECT c.client_id, c.full_name, c.email, c.phone
           FROM clients c LEFT JOIN user_accounts a ON a.client_id = c.client_id
          WHERE a.account_id IS NULL ORDER BY c.full_name`
      ),
      query(
        `SELECT e.employee_id, e.full_name, e.position, e.is_active
           FROM employees e LEFT JOIN user_accounts a ON a.employee_id = e.employee_id
          WHERE a.account_id IS NULL AND e.is_active = 1 ORDER BY e.full_name`
      ),
    ]);
    res.json({ clients, employees });
  })
);

router.post(
  "/accounts",
  route(async (req, res) => {
    const email = cleanText(req.body?.email, 190).toLowerCase();
    const password = String(req.body?.password || "");
    const role = cleanText(req.body?.role, 20);
    const profileId = optionalId(req.body?.profile_id, "профиля");
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw httpError(400, "Укажите корректный email.");
    if (password.length < 10)
      throw httpError(400, "Пароль должен содержать минимум 10 символов.");
    if (!["admin", "client", "employee"].includes(role))
      throw httpError(400, "Неизвестная роль.");
    let clientId = null;
    let employeeId = null;
    let displayName = cleanText(req.body?.display_name, 150) || null;
    if (role === "client") {
      if (!profileId) throw httpError(400, "Выберите клиента.");
      const rows = await query(
        "SELECT client_id, full_name FROM clients WHERE client_id = ?",
        [profileId]
      );
      if (!rows.length) throw httpError(404, "Клиент не найден.");
      clientId = profileId;
      displayName = rows[0].full_name;
    } else if (role === "employee") {
      if (!profileId) throw httpError(400, "Выберите сотрудника.");
      const rows = await query(
        "SELECT employee_id, full_name FROM employees WHERE employee_id = ?",
        [profileId]
      );
      if (!rows.length) throw httpError(404, "Сотрудник не найден.");
      employeeId = profileId;
      displayName = rows[0].full_name;
    } else if (profileId) {
      throw httpError(
        400,
        "Для администратора не выбирается профиль клиента или сотрудника."
      );
    }
    const result = await query(
      "INSERT INTO user_accounts (email, password_hash, role, display_name, client_id, employee_id) VALUES (?, ?, ?, ?, ?, ?)",
      [email, hashPassword(password), role, displayName, clientId, employeeId]
    );
    res.status(201).json({ ok: true, account_id: Number(result.insertId) });
  })
);

router.patch(
  "/accounts/:id",
  route(async (req, res) => {
    const accountId = positiveId(req.params.id, "учётной записи");
    const existing = await query(
      "SELECT account_id FROM user_accounts WHERE account_id = ?",
      [accountId]
    );
    if (!existing.length) throw httpError(404, "Учётная запись не найдена.");
    const updates = {};
    if (req.body?.is_active !== undefined) {
      const active = Number(req.body.is_active);
      if (![0, 1].includes(active))
        throw httpError(400, "Некорректный статус учётной записи.");
      if (accountId === req.user.account_id && active === 0)
        throw httpError(400, "Нельзя отключить собственную учётную запись.");
      updates.is_active = active;
    }
    if (req.body?.password !== undefined && String(req.body.password).length) {
      const password = String(req.body.password);
      if (password.length < 10)
        throw httpError(
          400,
          "Новый пароль должен содержать минимум 10 символов."
        );
      updates.password_hash = hashPassword(password);
    }
    if (!Object.keys(updates).length) throw httpError(400, "Нет изменений.");
    const fields = Object.keys(updates);
    await query(
      `UPDATE user_accounts SET ${fields
        .map((field) => `\`${field}\` = ?`)
        .join(", ")} WHERE account_id = ?`,
      [...fields.map((field) => updates[field]), accountId]
    );
    res.json({ ok: true });
  })
);

module.exports = router;
