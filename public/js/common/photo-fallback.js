(() => {
  const fallback = (img) => {
    const placeholder = document.createElement("div");
    placeholder.className = "photo-fallback " + (img.classList.contains("car-thumb") ? "photo-fallback-thumb" : "");
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", "Фотография автомобиля недоступна");
    placeholder.innerHTML = '<span class="photo-fallback-icon" aria-hidden="true">🚘</span><small>Фото недоступно</small>';
    img.replaceWith(placeholder);
  };
  document.addEventListener("error", (event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && !img.dataset.fallbackProcessed) {
      img.dataset.fallbackProcessed = "1";
      fallback(img);
    }
  }, true);
})();
