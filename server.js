require('dotenv').config();
const express = require('express');
const mariadb = require('mariadb');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'autoservice',
  connectionLimit: 5,
  charset: 'utf8mb4',
});

app.use(express.json());
app.use(express.static(__dirname));

function cleanRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const obj = { ...row };
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === 'bigint') obj[key] = Number(obj[key]);
    });
    return obj;
  });
}

async function query(sql, params = []) {
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(sql, params);
    return cleanRows(result);
  } finally {
    if (conn) conn.release();
  }
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  const rows = await query('SELECT VERSION() AS version, DATABASE() AS database_name');
  res.json({ ok: true, ...rows[0] });
}));

app.get('/api/statuses', asyncRoute(async (_req, res) => {
  res.json(await query('SELECT status_id, name FROM order_statuses ORDER BY status_id'));
}));

app.get('/api/clients', asyncRoute(async (req, res) => {
  const search = `%${req.query.q || ''}%`;
  const rows = await query(`
    SELECT c.client_id, c.full_name, c.phone, c.email, c.created_at,
           COUNT(car.car_id) AS car_count,
           GROUP_CONCAT(CONCAT(car.brand, ' ', car.model, ' · ', COALESCE(car.license_plate, 'без номера'))
                        ORDER BY car.car_id SEPARATOR ', ') AS cars
    FROM clients c
    LEFT JOIN cars car ON car.client_id = c.client_id
    WHERE c.full_name LIKE ? OR c.phone LIKE ? OR COALESCE(c.email, '') LIKE ?
    GROUP BY c.client_id
    ORDER BY c.full_name
  `, [search, search, search]);
  res.json(rows);
}));

app.post('/api/clients', asyncRoute(async (req, res) => {
  const { full_name, phone, email = null } = req.body;
  if (!full_name || !phone) return res.status(400).json({ error: 'ФИО и телефон обязательны' });
  const result = await query('INSERT INTO clients(full_name, phone, email) VALUES (?, ?, ?)', [full_name, phone, email || null]);
  res.status(201).json({ client_id: Number(result.insertId) });
}));

app.put('/api/clients/:id', asyncRoute(async (req, res) => {
  const { full_name, phone, email = null } = req.body;
  await query('UPDATE clients SET full_name=?, phone=?, email=? WHERE client_id=?', [full_name, phone, email || null, req.params.id]);
  res.json({ ok: true });
}));

app.delete('/api/clients/:id', asyncRoute(async (req, res) => {
  await query('DELETE FROM clients WHERE client_id=?', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/cars', asyncRoute(async (req, res) => {
  const search = `%${req.query.q || ''}%`;
  const rows = await query(`
    SELECT car.car_id, car.client_id, car.vin, car.license_plate, car.brand, car.model, car.year,
           c.full_name AS client_name,
           (SELECT o.mileage FROM orders o WHERE o.car_id = car.car_id AND o.mileage IS NOT NULL
            ORDER BY o.created_at DESC, o.order_id DESC LIMIT 1) AS mileage
    FROM cars car
    JOIN clients c ON c.client_id = car.client_id
    WHERE COALESCE(car.license_plate,'') LIKE ? OR COALESCE(car.vin,'') LIKE ?
       OR car.brand LIKE ? OR car.model LIKE ? OR c.full_name LIKE ?
    ORDER BY car.brand, car.model
  `, [search, search, search, search, search]);
  res.json(rows);
}));

app.post('/api/cars', asyncRoute(async (req, res) => {
  const { client_id, vin = null, license_plate = null, brand, model, year = null } = req.body;
  if (!client_id || !brand || !model) return res.status(400).json({ error: 'Владелец, марка и модель обязательны' });
  const result = await query(
    'INSERT INTO cars(client_id, vin, license_plate, brand, model, year) VALUES (?, ?, ?, ?, ?, ?)',
    [client_id, vin || null, license_plate || null, brand, model, year || null]
  );
  res.status(201).json({ car_id: Number(result.insertId) });
}));

app.put('/api/cars/:id', asyncRoute(async (req, res) => {
  const { client_id, vin = null, license_plate = null, brand, model, year = null } = req.body;
  await query(`UPDATE cars SET client_id=?, vin=?, license_plate=?, brand=?, model=?, year=? WHERE car_id=?`,
    [client_id, vin || null, license_plate || null, brand, model, year || null, req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/employees', asyncRoute(async (_req, res) => {
  res.json(await query('SELECT employee_id, full_name, position, phone, is_active FROM employees ORDER BY is_active DESC, full_name'));
}));

app.post('/api/employees', asyncRoute(async (req, res) => {
  const { full_name, position, phone = null, is_active = 1 } = req.body;
  if (!full_name || !position) return res.status(400).json({ error: 'ФИО и должность обязательны' });
  const result = await query('INSERT INTO employees(full_name, position, phone, is_active) VALUES (?, ?, ?, ?)', [full_name, position, phone || null, Number(Boolean(Number(is_active)))]);
  res.status(201).json({ employee_id: Number(result.insertId) });
}));

app.put('/api/employees/:id', asyncRoute(async (req, res) => {
  const { full_name, position, phone = null, is_active = 1 } = req.body;
  await query('UPDATE employees SET full_name=?, position=?, phone=?, is_active=? WHERE employee_id=?', [full_name, position, phone || null, Number(Boolean(Number(is_active))), req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/work-types', asyncRoute(async (_req, res) => {
  res.json(await query('SELECT work_type_id, name, default_price, estimated_duration FROM work_types ORDER BY name'));
}));

app.post('/api/work-types', asyncRoute(async (req, res) => {
  const { name, default_price, estimated_duration = null } = req.body;
  if (!name || default_price === undefined) return res.status(400).json({ error: 'Название и цена обязательны' });
  const result = await query('INSERT INTO work_types(name, default_price, estimated_duration) VALUES (?, ?, ?)', [name, default_price, estimated_duration || null]);
  res.status(201).json({ work_type_id: Number(result.insertId) });
}));

app.put('/api/work-types/:id', asyncRoute(async (req, res) => {
  const { name, default_price, estimated_duration = null } = req.body;
  await query('UPDATE work_types SET name=?, default_price=?, estimated_duration=? WHERE work_type_id=?', [name, default_price, estimated_duration || null, req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/parts', asyncRoute(async (req, res) => {
  const search = `%${req.query.q || ''}%`;
  res.json(await query(`SELECT part_id, name, article, manufacturer, stock_quantity, price
                        FROM parts
                        WHERE name LIKE ? OR COALESCE(article,'') LIKE ? OR COALESCE(manufacturer,'') LIKE ?
                        ORDER BY name`, [search, search, search]));
}));

app.post('/api/parts', asyncRoute(async (req, res) => {
  const { name, article = null, manufacturer = null, stock_quantity = 0, price } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Название и цена обязательны' });
  const result = await query('INSERT INTO parts(name, article, manufacturer, stock_quantity, price) VALUES (?, ?, ?, ?, ?)', [name, article || null, manufacturer || null, stock_quantity || 0, price]);
  res.status(201).json({ part_id: Number(result.insertId) });
}));

app.put('/api/parts/:id', asyncRoute(async (req, res) => {
  const { name, article = null, manufacturer = null, stock_quantity = 0, price } = req.body;
  await query('UPDATE parts SET name=?, article=?, manufacturer=?, stock_quantity=?, price=? WHERE part_id=?', [name, article || null, manufacturer || null, stock_quantity || 0, price, req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/orders', asyncRoute(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.q) {
    const s = `%${req.query.q}%`;
    where.push(`(COALESCE(car.license_plate,'') LIKE ? OR COALESCE(car.vin,'') LIKE ? OR c.full_name LIKE ? OR car.brand LIKE ? OR car.model LIKE ?)`);
    params.push(s, s, s, s, s);
  }
  if (req.query.status_id) { where.push('o.status_id=?'); params.push(req.query.status_id); }
  if (req.query.employee_id) { where.push('o.employee_id=?'); params.push(req.query.employee_id); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(`
    SELECT o.order_id, o.car_id, o.employee_id, o.status_id, o.created_at, o.planned_finish_date,
           o.mileage, o.finished_at, o.complaint, o.diagnosis, o.comment,
           car.vin, car.license_plate, car.brand, car.model, car.year,
           c.client_id, c.full_name AS client_name,
           e.full_name AS employee_name, s.name AS status_name,
           COALESCE((SELECT SUM(ow.quantity * ow.price) FROM order_works ow WHERE ow.order_id=o.order_id), 0) AS works_total,
           COALESCE((SELECT SUM(op.quantity * op.price) FROM order_parts op WHERE op.order_id=o.order_id), 0) AS parts_total,
           COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.order_id), 0) AS paid_total
    FROM orders o
    JOIN cars car ON car.car_id=o.car_id
    JOIN clients c ON c.client_id=car.client_id
    LEFT JOIN employees e ON e.employee_id=o.employee_id
    JOIN order_statuses s ON s.status_id=o.status_id
    ${clause}
    ORDER BY o.created_at DESC, o.order_id DESC
  `, params);
  res.json(rows.map(r => ({ ...r, order_total: Number(r.works_total) + Number(r.parts_total) })));
}));

app.get('/api/orders/:id', asyncRoute(async (req, res) => {
  const orders = await query(`
    SELECT o.*, car.vin, car.license_plate, car.brand, car.model, c.full_name AS client_name,
           e.full_name AS employee_name, s.name AS status_name
    FROM orders o JOIN cars car ON car.car_id=o.car_id JOIN clients c ON c.client_id=car.client_id
    LEFT JOIN employees e ON e.employee_id=o.employee_id JOIN order_statuses s ON s.status_id=o.status_id
    WHERE o.order_id=?`, [req.params.id]);
  if (!orders.length) return res.status(404).json({ error: 'Заказ не найден' });
  const works = await query(`SELECT ow.order_work_id, ow.work_type_id, wt.name, ow.employee_id, e.full_name AS employee_name, ow.quantity, ow.price
                             FROM order_works ow JOIN work_types wt ON wt.work_type_id=ow.work_type_id
                             LEFT JOIN employees e ON e.employee_id=ow.employee_id WHERE ow.order_id=? ORDER BY ow.order_work_id`, [req.params.id]);
  const parts = await query(`SELECT op.order_part_id, op.part_id, p.name, p.article, op.quantity, op.price
                             FROM order_parts op JOIN parts p ON p.part_id=op.part_id WHERE op.order_id=? ORDER BY op.order_part_id`, [req.params.id]);
  const payments = await query('SELECT payment_id, amount, payment_date, payment_method FROM payments WHERE order_id=? ORDER BY payment_date', [req.params.id]);
  res.json({ ...orders[0], works, parts, payments });
}));

app.post('/api/orders', asyncRoute(async (req, res) => {
  const { car_id, employee_id = null, status_id = 1, planned_finish_date = null, mileage = null, complaint = null, diagnosis = null, comment = null } = req.body;
  if (!car_id) return res.status(400).json({ error: 'Автомобиль обязателен' });
  const result = await query(`INSERT INTO orders(car_id, employee_id, status_id, planned_finish_date, mileage, complaint, diagnosis, comment)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [car_id, employee_id || null, status_id, planned_finish_date || null, mileage || null, complaint || null, diagnosis || null, comment || null]);
  res.status(201).json({ order_id: Number(result.insertId) });
}));

app.put('/api/orders/:id', asyncRoute(async (req, res) => {
  const { car_id, employee_id = null, status_id, planned_finish_date = null, mileage = null, finished_at = null, complaint = null, diagnosis = null, comment = null } = req.body;
  await query(`UPDATE orders SET car_id=?, employee_id=?, status_id=?, planned_finish_date=?, mileage=?, finished_at=?, complaint=?, diagnosis=?, comment=? WHERE order_id=?`,
    [car_id, employee_id || null, status_id, planned_finish_date || null, mileage || null, finished_at || null, complaint || null, diagnosis || null, comment || null, req.params.id]);
  res.json({ ok: true });
}));

app.post('/api/orders/:id/works', asyncRoute(async (req, res) => {
  const { work_type_id, employee_id = null, quantity = 1, price } = req.body;
  if (!work_type_id || price === undefined) return res.status(400).json({ error: 'Работа и цена обязательны' });
  const result = await query('INSERT INTO order_works(order_id, work_type_id, employee_id, quantity, price) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, work_type_id, employee_id || null, quantity, price]);
  res.status(201).json({ order_work_id: Number(result.insertId) });
}));

app.post('/api/orders/:id/parts', asyncRoute(async (req, res) => {
  const { part_id, quantity = 1, price } = req.body;
  if (!part_id || price === undefined || Number(quantity) <= 0) return res.status(400).json({ error: 'Запчасть, количество и цена обязательны' });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const stock = await conn.query('SELECT stock_quantity FROM parts WHERE part_id=? FOR UPDATE', [part_id]);
    if (!stock.length) throw Object.assign(new Error('Запчасть не найдена'), { statusCode: 404 });
    if (Number(stock[0].stock_quantity) < Number(quantity)) throw Object.assign(new Error('Недостаточно запчастей на складе'), { statusCode: 409 });
    const result = await conn.query('INSERT INTO order_parts(order_id, part_id, quantity, price) VALUES (?, ?, ?, ?)', [req.params.id, part_id, quantity, price]);
    await conn.query('UPDATE parts SET stock_quantity=stock_quantity-? WHERE part_id=?', [quantity, part_id]);
    await conn.commit();
    res.status(201).json({ order_part_id: Number(result.insertId) });
  } catch (e) {
    if (conn) await conn.rollback();
    throw e;
  } finally {
    if (conn) conn.release();
  }
}));

app.get('/api/payments', asyncRoute(async (_req, res) => {
  res.json(await query(`
    SELECT p.payment_id, p.order_id, p.amount, p.payment_date, p.payment_method,
           car.license_plate, car.brand, car.model, c.full_name AS client_name
    FROM payments p JOIN orders o ON o.order_id=p.order_id JOIN cars car ON car.car_id=o.car_id
    JOIN clients c ON c.client_id=car.client_id
    ORDER BY p.payment_date DESC, p.payment_id DESC
  `));
}));

app.post('/api/payments', asyncRoute(async (req, res) => {
  const { order_id, amount, payment_method = null } = req.body;
  if (!order_id || amount === undefined || Number(amount) < 0) return res.status(400).json({ error: 'Заказ и корректная сумма обязательны' });
  const result = await query('INSERT INTO payments(order_id, amount, payment_method) VALUES (?, ?, ?)', [order_id, amount, payment_method || null]);
  res.status(201).json({ payment_id: Number(result.insertId) });
}));

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const [active] = await query(`SELECT COUNT(*) AS value FROM orders o JOIN order_statuses s ON s.status_id=o.status_id WHERE s.name NOT IN ('Выдан','Отменён')`);
  const [ready] = await query(`SELECT COUNT(*) AS value FROM orders o JOIN order_statuses s ON s.status_id=o.status_id WHERE s.name='Готов'`);
  const [cars] = await query('SELECT COUNT(*) AS value FROM cars');
  const [low] = await query('SELECT COUNT(*) AS value FROM parts WHERE stock_quantity < 5');
  const [month] = await query(`SELECT COALESCE(SUM(amount),0) AS value FROM payments WHERE YEAR(payment_date)=YEAR(CURRENT_DATE()) AND MONTH(payment_date)=MONTH(CURRENT_DATE())`);
  const recent = await query(`
    SELECT o.order_id, car.license_plate, car.brand, car.model, c.full_name AS client_name, s.name AS status_name,
      COALESCE((SELECT SUM(ow.quantity*ow.price) FROM order_works ow WHERE ow.order_id=o.order_id),0)
      + COALESCE((SELECT SUM(op.quantity*op.price) FROM order_parts op WHERE op.order_id=o.order_id),0) AS order_total
    FROM orders o JOIN cars car ON car.car_id=o.car_id JOIN clients c ON c.client_id=car.client_id
    JOIN order_statuses s ON s.status_id=o.status_id ORDER BY o.created_at DESC LIMIT 5
  `);
  res.json({ active_orders: Number(active.value), ready_orders: Number(ready.value), cars: Number(cars.value), low_stock: Number(low.value), month_revenue: Number(month.value), recent });
}));

app.get('/api/stats', asyncRoute(async (_req, res) => {
  const summary = await query(`
    SELECT
      COALESCE(SUM(p.amount),0) AS revenue,
      COUNT(DISTINCT o.order_id) AS orders_count,
      CASE WHEN COUNT(DISTINCT o.order_id)=0 THEN 0 ELSE COALESCE(SUM(p.amount),0)/COUNT(DISTINCT o.order_id) END AS avg_check
    FROM orders o LEFT JOIN payments p ON p.order_id=o.order_id
    WHERE YEAR(o.created_at)=YEAR(CURRENT_DATE()) AND MONTH(o.created_at)=MONTH(CURRENT_DATE())
  `);
  const months = await query(`
    SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month, SUM(amount) AS revenue
    FROM payments WHERE payment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 11 MONTH)
    GROUP BY DATE_FORMAT(payment_date, '%Y-%m') ORDER BY month
  `);
  const works = await query(`
    SELECT wt.name, SUM(ow.quantity) AS count_value
    FROM order_works ow JOIN work_types wt ON wt.work_type_id=ow.work_type_id
    GROUP BY wt.work_type_id, wt.name ORDER BY count_value DESC LIMIT 5
  `);
  res.json({ summary: summary[0], months, popular_works: works });
}));

app.get('/{*splat}', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.statusCode || (err.code === 'ER_DUP_ENTRY' ? 409 : 500);
  let message = err.message || 'Ошибка сервера';
  if (err.code === 'ER_ROW_IS_REFERENCED_2') message = 'Запись нельзя удалить: на неё ссылаются другие данные';
  if (err.code === 'ER_DUP_ENTRY') message = 'Такая запись уже существует (проверь уникальные поля)';
  res.status(status).json({ error: message });
});

app.listen(PORT, async () => {
  console.log(`AutoPro: http://localhost:${PORT}`);
  try {
    const rows = await query('SELECT VERSION() AS version');
    console.log(`MariaDB connected: ${rows[0].version}`);
  } catch (e) {
    console.error('MariaDB connection failed:', e.message);
  }
});
