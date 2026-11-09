(() => {
  const scope = document.body.dataset.apiScope || document.documentElement.dataset.apiScope || "public";

  function esc(value) {
    return String(value ?? "").replace(/[&<>\'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    }[char]));
  }

  async function api(url, options = {}) {
    if (scope === "admin" && url.startsWith("/api/") && !url.startsWith("/api/auth/") && url !== "/api/account/password") {
      url = url.replace("/api/", "/api/admin/");
    }

    const response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && ["admin", "client", "employee"].includes(scope)) {
      const loginPath = scope === "admin" ? "/admin/login" : `/${scope}/login`;
      if (location.pathname !== loginPath) location.assign(loginPath);
    }
    if (!response.ok) throw new Error(data.error || `Ошибка запроса: ${response.status}`);
    return data;
  }

  function money(value) {
    return `${Number(value || 0).toLocaleString("ru-RU")} ₽`;
  }

  function dateForInput(value) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  function dateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleString("ru-RU");
  }

  function shortDate(value) {
    return value ? new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "Не указана";
  }

  window.api = api;
  window.esc = esc;
  window.money = money;
  window.dateForInput = dateForInput;
  window.dateTime = dateTime;
  window.shortDate = shortDate;
})();
