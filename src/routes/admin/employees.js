const express = require("express");
const router = express.Router();
const { pool, query } = require("../../config/db");
const { hashPassword } = require("../../utils/passwords");
const { httpError, route, positiveId, cleanText } = require("../../utils/validators");

async function saveEmployee(req, res, employeeId = null) {
  const body = req.body || {};
  const fullName = cleanText(body.full_name, 150);
  const position = cleanText(body.position, 50);
  const phone = cleanText(body.phone, 20) || null;
  const email = cleanText(body.email, 190).toLowerCase();
  const isActive =
    body.is_active === false || Number(body.is_active) === 0 ? 0 : 1;
  const skillIds = [
    ...new Set(
      (Array.isArray(body.work_type_ids) ? body.work_type_ids : []).map(
        (value) => positiveId(value, "навыка")
      )
    ),
  ];

  if (!fullName || !position) throw httpError(400, "Укажите ФИО и должность.");
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw httpError(400, "Укажите корректный email сотрудника.");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (skillIds.length) {
      const placeholders = skillIds.map(() => "?").join(",");
      const valid = await conn.query(
        `SELECT work_type_id FROM work_types WHERE work_type_id IN (${placeholders})`,
        skillIds
      );
      if (valid.length !== skillIds.length) {
        throw httpError(
          400,
          "Одна или несколько выбранных работ не существуют."
        );
      }
    }

    let id = employeeId;
    let accountCreated = false;
    if (id) {
      const existing = await conn.query(
        "SELECT employee_id FROM employees WHERE employee_id = ? FOR UPDATE",
        [id]
      );
      if (!existing.length) throw httpError(404, "Сотрудник не найден.");
      await conn.query(
        "UPDATE employees SET full_name = ?, position = ?, phone = ?, is_active = ? WHERE employee_id = ?",
        [fullName, position, phone, isActive, id]
      );

      const accounts = await conn.query(
        "SELECT account_id FROM user_accounts WHERE employee_id = ? FOR UPDATE",
        [id]
      );
      if (accounts.length) {
        await conn.query(
          "UPDATE user_accounts SET email = ?, display_name = ? WHERE employee_id = ?",
          [email, fullName, id]
        );
      } else {
        await conn.query(
          `INSERT INTO user_accounts (email, password_hash, role, display_name, employee_id)
           VALUES (?, ?, 'employee', ?, ?)`,
          [email, hashPassword("qwerty1234"), fullName, id]
        );
        accountCreated = true;
      }
    } else {
      const result = await conn.query(
        "INSERT INTO employees (full_name, position, phone, is_active) VALUES (?, ?, ?, ?)",
        [fullName, position, phone, isActive]
      );
      id = Number(result.insertId);
      await conn.query(
        `INSERT INTO user_accounts (email, password_hash, role, display_name, employee_id)
         VALUES (?, ?, 'employee', ?, ?)`,
        [email, hashPassword("qwerty1234"), fullName, id]
      );
      accountCreated = true;
    }

    await conn.query("DELETE FROM employee_work_types WHERE employee_id = ?", [
      id,
    ]);
    for (const skillId of skillIds) {
      await conn.query(
        "INSERT INTO employee_work_types (employee_id, work_type_id) VALUES (?, ?)",
        [id, skillId]
      );
    }

    await conn.commit();
    res.status(employeeId ? 200 : 201).json({
      ok: true,
      employee_id: id,
      account_created: accountCreated,
      default_password: accountCreated ? "qwerty1234" : undefined,
    });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

router.get(
  "/employees",
  route(async (_req, res) => {
    res.json(
      await query(`
    SELECT e.employee_id, e.full_name, e.position, e.phone, e.is_active, a.email,
           (SELECT GROUP_CONCAT(w.name ORDER BY w.name SEPARATOR ', ') FROM employee_work_types ewt JOIN work_types w ON w.work_type_id = ewt.work_type_id WHERE ewt.employee_id = e.employee_id) AS skills,
           (SELECT GROUP_CONCAT(ewt.work_type_id ORDER BY ewt.work_type_id SEPARATOR ',') FROM employee_work_types ewt WHERE ewt.employee_id = e.employee_id) AS skill_ids
    FROM employees e LEFT JOIN user_accounts a ON a.employee_id = e.employee_id
    ORDER BY e.is_active DESC, e.full_name
  `)
    );
  })
);

router.post(
  "/employees",
  route((req, res) => saveEmployee(req, res))
);
router.put(
  "/employees/:id",
  route((req, res) =>
    saveEmployee(req, res, positiveId(req.params.id, "сотрудника"))
  )
);

module.exports = router;
