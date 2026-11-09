const crypto = require("node:crypto");
const { query } = require("../config/db");

// ---------- Авторизация и роли ----------
const SESSION_COOKIE = "autopro_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET обязателен в production.");
}
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "local-development-secret-change-before-deployment";
const ROLE_PATHS = {
  admin: "/admin",
  client: "/client",
  employee: "/employee",
};

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(cookie.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function signSession(accountId, expiresAt) {
  const payload = Buffer.from(
    JSON.stringify({ accountId, expiresAt })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isSafeInteger(data.accountId) || data.expiresAt <= Date.now())
      return null;
    return data;
  } catch {
    return null;
  }
}

function writeSessionCookie(res, accountId) {
  const token = signSession(accountId, Date.now() + SESSION_TTL_SECONDS * 1000);
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
}

async function getSessionUser(req) {
  const token = verifySession(cookieValue(req, SESSION_COOKIE));
  if (!token) return null;
  const rows = await query(
    `SELECT a.account_id, a.email, a.role, a.client_id, a.employee_id, a.is_active,
            e.is_active AS employee_active,
            COALESCE(c.full_name, e.full_name, a.display_name, 'Администратор') AS name
       FROM user_accounts a
       LEFT JOIN clients c ON c.client_id = a.client_id
       LEFT JOIN employees e ON e.employee_id = a.employee_id
      WHERE a.account_id = ? AND a.is_active = 1`,
    [token.accountId]
  );
  return rows[0] || null;
}

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: "Войдите в систему." });
      if (!roles.includes(user.role)) {
        return res
          .status(403)
          .json({ error: "Недостаточно прав для этого раздела." });
      }
      if (user.role === "employee" && !Number(user.employee_active)) {
        return res.status(403).json({ error: "Профиль сотрудника неактивен." });
      }
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requirePageRole(role) {
  return async (req, res, next) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.redirect(`/${role}/login`);
      if (user.role !== role)
        return res.redirect(ROLE_PATHS[user.role] || "/login");
      if (user.role === "employee" && !Number(user.employee_active))
        return res.redirect("/employee/login");
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  ROLE_PATHS,
  getSessionUser,
  requireRole,
  requirePageRole,
  writeSessionCookie,
  clearSessionCookie,
};
