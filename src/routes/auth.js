const express = require("express");
const router = express.Router();
const { query } = require("../config/db");
const { hashPassword, verifyPassword } = require("../utils/passwords");
const { httpError, route, cleanText } = require("../utils/validators");
const {
  ROLE_PATHS,
  getSessionUser,
  requireRole,
  writeSessionCookie,
  clearSessionCookie,
} = require("../middleware/auth");

router.post(
  "/auth/login",
  route(async (req, res) => {
    const email = cleanText(req.body?.email, 190).toLowerCase();
    const password = String(req.body?.password || "");
    const expectedRole = cleanText(req.body?.role, 20);
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
      throw httpError(400, "Введите корректный email и пароль.");
    }
    const rows = await query(
      `SELECT a.account_id, a.email, a.password_hash, a.role, a.is_active, e.is_active AS employee_active
         FROM user_accounts a LEFT JOIN employees e ON e.employee_id = a.employee_id
        WHERE a.email = ? LIMIT 1`,
      [email]
    );
    const account = rows[0];
    if (
      !account ||
      !Number(account.is_active) ||
      (account.role === "employee" && !Number(account.employee_active)) ||
      !verifyPassword(password, account.password_hash)
    ) {
      throw httpError(401, "Неверный email или пароль.");
    }
    if (expectedRole && account.role !== expectedRole) {
      throw httpError(
        403,
        "Эта учётная запись предназначена для другого кабинета.",
        {
          redirect: ROLE_PATHS[account.role],
        }
      );
    }
    writeSessionCookie(res, Number(account.account_id));
    const userRows = await query(
      `SELECT a.account_id, a.email, a.role, a.client_id, a.employee_id,
              COALESCE(c.full_name, e.full_name, a.display_name, 'Администратор') AS name
         FROM user_accounts a
         LEFT JOIN clients c ON c.client_id = a.client_id
         LEFT JOIN employees e ON e.employee_id = a.employee_id
        WHERE a.account_id = ?`,
      [account.account_id]
    );
    res.json({
      ok: true,
      user: userRows[0],
      redirect: ROLE_PATHS[account.role],
    });
  })
);

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get(
  "/auth/me",
  route(async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) throw httpError(401, "Сессия завершена. Войдите снова.");
    res.json({ user });
  })
);

// ---------- Маршруты API ----------

router.get(
  "/health",
  route(async (_req, res) => {
    const rows = await query("SELECT DATABASE() AS db, VERSION() AS version");
    res.json({ ok: true, db: rows[0].db, version: rows[0].version });
  })
);

router.patch(
  "/account/password",
  requireRole("admin", "client", "employee"),
  route(async (req, res) => {
    const email = cleanText(req.body?.email, 190).toLowerCase();
    const sessionEmail = String(req.user.email || "");
    const password = String(req.body?.password || "");
    const passwordConfirmation = String(req.body?.password_confirmation || "");

    if (!email || email !== sessionEmail.toLowerCase()) {
      throw httpError(403, "Email должен совпадать с текущей учётной записью.");
    }
    if (password.length < 10) {
      throw httpError(
        400,
        "Новый пароль должен содержать минимум 10 символов."
      );
    }
    if (password !== passwordConfirmation) {
      throw httpError(400, "Пароли не совпадают.");
    }

    const result = await query(
      "UPDATE user_accounts SET password_hash = ? WHERE account_id = ? AND email = ? AND is_active = 1",
      [hashPassword(password), req.user.account_id, sessionEmail]
    );
    if (!result.affectedRows) {
      throw httpError(
        409,
        "Учётная запись изменилась. Обновите страницу и повторите попытку."
      );
    }
    res.json({ ok: true });
  })
);

module.exports = router;
