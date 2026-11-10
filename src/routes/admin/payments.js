const express = require("express");
const router = express.Router();
const { query } = require("../../config/db");
const { httpError, positiveId } = require("../../utils/validators");
const { number } = require("../../utils/record-validation");
const { route } = require("../../utils/validators");

router.get(
  "/payments/stats",
  route(async (_req, res) => {
    const [monthRows, yearRows, monthSeries, workRanking] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(amount), 0) AS revenue
           FROM payments
          WHERE payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
            AND payment_date < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0) AS revenue
           FROM payments
          WHERE payment_date >= MAKEDATE(YEAR(CURDATE()), 1)
            AND payment_date < MAKEDATE(YEAR(CURDATE()) + 1, 1)`
      ),
      query(
        `WITH RECURSIVE months AS (
           SELECT DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH) AS month_start
           UNION ALL
           SELECT DATE_ADD(month_start, INTERVAL 1 MONTH)
             FROM months
            WHERE month_start < DATE_FORMAT(CURDATE(), '%Y-%m-01')
         )
         SELECT DATE_FORMAT(months.month_start, '%Y-%m') AS month_key,
                YEAR(months.month_start) AS year_number,
                MONTH(months.month_start) AS month_number,
                COALESCE(SUM(payments.amount), 0) AS revenue
           FROM months
           LEFT JOIN payments
             ON payments.payment_date >= months.month_start
            AND payments.payment_date < DATE_ADD(months.month_start, INTERVAL 1 MONTH)
          GROUP BY months.month_start
          ORDER BY months.month_start`
      ),
      query(
        `SELECT wt.work_type_id, wt.name,
                COALESCE(SUM(ow.quantity * ow.price), 0) AS revenue,
                COUNT(DISTINCT ow.order_id) AS order_count
           FROM order_works ow
           JOIN work_types wt ON wt.work_type_id = ow.work_type_id
          GROUP BY wt.work_type_id, wt.name
          ORDER BY revenue DESC, wt.name ASC
          LIMIT 7`
      ),
    ]);

    res.json({
      current_month_revenue: Number(monthRows[0]?.revenue || 0),
      current_year_revenue: Number(yearRows[0]?.revenue || 0),
      monthly_revenue: monthSeries.map((row) => ({
        month_key: row.month_key,
        year: Number(row.year_number),
        month: Number(row.month_number),
        revenue: Number(row.revenue),
      })),
      work_ranking: workRanking.map((row) => ({
        work_type_id: Number(row.work_type_id),
        name: row.name,
        revenue: Number(row.revenue),
        order_count: Number(row.order_count),
      })),
    });
  })
);

router.get(
  "/payments",
  route(async (_req, res) => {
    res.json(
      await query(`
    SELECT p.payment_id, p.order_id, p.amount, p.payment_date, p.payment_method, car.license_plate, car.brand, car.model, c.full_name AS client_name
    FROM payments p JOIN orders o ON o.order_id = p.order_id JOIN cars car ON car.car_id = o.car_id JOIN clients c ON c.client_id = car.client_id
    ORDER BY p.payment_date DESC, p.payment_id DESC
  `)
    );
  })
);

router.post("/payments", route(async (req,res)=>{
  const orderId=positiveId(req.body?.order_id,"заказа");
  const amount=number(req.body?.amount,"Сумма оплаты",{min:0.01,max:99999999});
  const method=String(req.body?.payment_method || "").trim();
  if(!["Наличные","Карта","Перевод"].includes(method))throw httpError(400,"Выберите способ оплаты.");
  const orders=await query("SELECT order_id FROM orders WHERE order_id=?",[orderId]);
  if(!orders.length)throw httpError(404,"Заказ не найден.");
  const r=await query("INSERT INTO payments (order_id,amount,payment_method) VALUES (?,?,?)",[orderId,amount,method]);
  res.status(201).json({ok:true,payment_id:Number(r.insertId)});
}));
router.delete("/payments/:id",route(async(req,res)=>{
  const id=positiveId(req.params.id,"оплаты");
  const r=await query("DELETE FROM payments WHERE payment_id=?",[id]);
  if(!r.affectedRows)throw httpError(404,"Оплата не найдена.");res.json({ok:true});
}));
module.exports = router;
