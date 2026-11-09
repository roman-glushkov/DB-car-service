function httpError(status, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, details);
  return error;
}

function route(handler) {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch(next);
  };
}

function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw httpError(400, `Некорректный идентификатор: ${label}`);
  }
  return id;
}

function optionalId(value, label) {
  if (value === null || value === undefined || value === "") return null;
  return positiveId(value, label);
}

function cleanText(value, maxLength = 1000) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function parseDate(value, label, nullable = true) {
  if ((value === null || value === undefined || value === "") && nullable)
    return null;
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw httpError(400, `Некорректная дата: ${label}`);
  }
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw httpError(400, `Некорректная дата: ${label}`);
  }
  return date;
}

module.exports = { httpError, route, positiveId, optionalId, cleanText, parseDate };
