const multer = require("multer");

function errorHandler(error, _req, res, _next) {
  console.error(error);
  const status =
    error.code === "ER_DUP_ENTRY"
      ? 409
      : error.status || (error instanceof multer.MulterError ? 400 : 500);
  res.status(status).json({
    error:
      error.code === "ER_DUP_ENTRY"
        ? "Email, VIN или госномер уже используется. Проверьте введённые данные."
        : error.message || "Внутренняя ошибка сервера",
    ...(error.redirect ? { redirect: error.redirect } : {}),
  });
}

module.exports = errorHandler;
