require("dotenv").config();

const express = require("express");
const path = require("node:path");
const authRoutes = require("./src/routes/auth");
const adminRoutes = require("./src/routes/admin");
const clientRoutes = require("./src/routes/client");
const employeeRoutes = require("./src/routes/employee");
const { requirePageRole } = require("./src/middleware/auth");
const errorHandler = require("./src/middleware/error-handler");
const { PUBLIC_DIR, UPLOADS_DIR } = require("./src/config/paths");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const sendPage = (filename) => (_req, res) => res.sendFile(path.join(PUBLIC_DIR, filename));

app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/api", authRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", (_req, res) => res.status(404).json({ error: "API-маршрут не найден." }));

app.get("/", (_req, res) => res.redirect("/login"));
app.get(["/login", "/login.html", "/admin/login", "/client/login", "/employee/login", "/staff/login"], sendPage("login.html"));
app.get(["/admin", "/admin.html", "/index.html"], requirePageRole("admin"), sendPage("admin.html"));
app.get(["/client", "/client.html"], requirePageRole("client"), sendPage("client.html"));
app.get(["/employee", "/employee.html"], requirePageRole("employee"), sendPage("employee.html"));

app.use(express.static(PUBLIC_DIR));
app.get("/{*splat}", (req, res) => res.status(404).send("Страница не найдена."));
app.use(errorHandler);

app.listen(PORT, () => console.log(`AutoPro: http://localhost:${PORT}`));
