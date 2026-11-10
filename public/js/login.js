const roleConfig = {
  admin: {
    title: "Вход администратора",
    description: "Управление заказами, клиентами и работой автосервиса.",
    label: "АДМИНИСТРАТОР",
  },
  client: {
    title: "Кабинет клиента",
    description: "Ваши автомобили, заявки и история обслуживания.",
    label: "КЛИЕНТ",
  },
  employee: {
    title: "Вход сотрудника",
    description: "Назначенные заказы и предстоящие работы.",
    label: "СОТРУДНИК",
  },
  staff: {
    title: "Вход для персонала",
    description: "Вход только по учётной записи, созданной администратором.",
    label: "СОТРУДНИКИ И АДМИНИСТРАТОРЫ",
  },
};

const roleMatch = location.pathname.match(/^\/(admin|client|employee|staff)\/login$/);
const role = roleMatch?.[1] || null;
const chooser = document.getElementById("roleChooser");
const formPanel = document.getElementById("loginFormPanel");

if (role && roleConfig[role]) {
  chooser.hidden = true;
  formPanel.hidden = false;
  if (role === "client") document.getElementById("clientRegisterLink").hidden = false;
  document.getElementById("roleEyebrow").textContent = roleConfig[role].label;
  document.getElementById("loginTitle").textContent = roleConfig[role].title;
  document.getElementById("loginDescription").textContent =
    roleConfig[role].description;
}

document.getElementById("togglePassword")?.addEventListener("click", () => {
  const password = document.getElementById("password");
  const visible = password.type === "text";
  password.type = visible ? "password" : "text";
  document.getElementById("togglePassword").textContent = visible
    ? "Показать"
    : "Скрыть";
});

document
  .getElementById("loginForm")
  ?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const error = document.getElementById("loginError");
    error.hidden = true;
    button.disabled = true;
    button.querySelector("span").textContent = "Проверка данных…";
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: form.email.value.trim(),
          password: form.password.value,
          role: role === "staff" ? null : role,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status === 403 && data.redirect) {
        location.assign(data.redirect === "/client" ? "/client/login" : "/staff/login");
        return;
      }
      if (!response.ok)
        throw new Error(data.error || "Не удалось выполнить вход.");
      location.assign(data.redirect || "/login");
    } catch (requestError) {
      error.textContent = requestError.message;
      error.hidden = false;
      button.disabled = false;
      button.querySelector("span").textContent = "Войти в кабинет";
    }
  });

const registrationPanel = document.getElementById("registrationPanel");
document.getElementById("showRegister")?.addEventListener("click", () => {
  formPanel.hidden = true;
  registrationPanel.hidden = false;
});
document.getElementById("backToLogin")?.addEventListener("click", () => {
  registrationPanel.hidden = true;
  formPanel.hidden = false;
});
document.getElementById("registrationForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById("registerError");
  const button = form.querySelector('button[type="submit"]');
  error.hidden = true;
  if (form.password.value !== form.password_confirmation.value) {
    error.textContent = "Пароли не совпадают.";
    error.hidden = false;
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не удалось зарегистрироваться.");
    location.assign(data.redirect || "/client");
  } catch (requestError) {
    error.textContent = requestError.message;
    error.hidden = false;
    button.disabled = false;
  }
});
