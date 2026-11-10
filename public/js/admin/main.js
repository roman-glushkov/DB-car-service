document.getElementById("currentDate").textContent = new Date().toLocaleDateString("ru-RU", {weekday:"short",day:"numeric",month:"long",year:"numeric"});
const pages = {
  orders,
  clients,
  cars,
  employees,
  works,
  parts,
  payments,
  accounts,
};
let current = "orders";
let currentUser = null;
let orderRowsCache = [];

async function render() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === current);
  });

  const content = document.getElementById("content");
  content.innerHTML = '<div class="loading">Загрузка данных…</div>';
  ordersPage = 1;
  orderRowsCache = [];
  try {
    content.innerHTML = await pages[current]();
    applyTableFilters();
  } catch (error) {
    content.innerHTML = `<div class="page"><div class="error-box">${esc(
      error.message
    )}</div></div>`;
  }
}


document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    current = item.dataset.page;
    render();
    document.getElementById("sidebar").classList.remove("open");
  });
});

document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document
  .getElementById("settingsBtn")
  ?.addEventListener("click", openSettingsModal);

document.getElementById("content").addEventListener("click", async (event) => {
  const preview = event.target.closest("[data-image-preview]");
  if (preview) {
    openImagePreview(preview.src, preview.alt);
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  try {
    if (button.dataset.action === "create-order") await openOrderModal();
    if (button.dataset.action === "create-client") await openClientModal();
    if (button.dataset.action === "edit-client") await openClientModal(Number(button.dataset.id));
    if (button.dataset.action === "create-car") await openCarModal();
    if (button.dataset.action === "edit-car") await openCarModal(Number(button.dataset.id));
    if (button.dataset.action === "create-part") await openPartModal();
    if (button.dataset.action === "create-payment") await openPaymentModal();
    if (button.dataset.action === "edit-part") await openPartModal(Number(button.dataset.id));
    if (button.dataset.action === "delete-record") await deleteAdminRecord(button.dataset.kind, Number(button.dataset.id));
    if (button.dataset.action === "remove-photo") await removeCarPhoto(Number(button.dataset.id));
    if (button.dataset.action === "create-work") await openWorkModal();
    if (button.dataset.action === "edit-work")
      await openWorkModal(Number(button.dataset.id));
    if (button.dataset.action === "edit-order")
      await openOrderModal(Number(button.dataset.id));
    if (button.dataset.action === "create-employee") await openEmployeeModal();
    if (button.dataset.action === "edit-employee")
      await openEmployeeModal(Number(button.dataset.id));
    if (button.dataset.action === "create-account") await openAccountModal();
    if (button.dataset.action === "toggle-account")
      await toggleAccount(
        Number(button.dataset.id),
        Number(button.dataset.active)
      );
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("content").addEventListener("change", async (event) => {
  const input = event.target.closest("[data-car-photo]");
  if (!input?.files?.[0]) return;
  const formData = new FormData();
  formData.append("photo", input.files[0]);
  try {
    await api(`/api/cars/${Number(input.dataset.carPhoto)}/photo`, {
      method: "POST",
      body: formData,
    });
    await render();
    alert("Фотография автомобиля обновлена.");
  } catch (error) {
    alert(error.message);
  }
});


const logoutButton = document.getElementById("logoutBtn");
logoutButton?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  location.assign("/login");
});

(async function initializeAdmin() {
  try {
    const { user } = await api("/api/auth/me");
    if (user.role !== "admin") return location.assign("/login");
    currentUser = user;
    const topAvatar = document.getElementById("topAvatar");
    if (topAvatar) {
      topAvatar.textContent = initialsForAdmin(user.name);
      topAvatar.title = user.name;
    }
    if (logoutButton) logoutButton.title = `Выйти · ${user.name}`;
    const date = document.querySelector(".date");
    if (date)
      date.textContent = new Date().toLocaleDateString("ru-RU", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    await render();
  } catch {
    location.assign("/admin/login");
  }
})();
