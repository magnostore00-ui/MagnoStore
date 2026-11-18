const SUPPORT_NUMBER = "584142607437";
const PRODUCTS_KEY = "magnostore-products-v1";
const CART_KEY = "magnostore-cart-v1";

const readStorage = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

let products = readStorage(PRODUCTS_KEY, []);
let cart = readStorage(CART_KEY, {});
let activeBrand = "Todas";
let deferredInstallPrompt = null;

const catalog = document.querySelector("#catalog");
const filters = document.querySelector("#brand-filters");
const search = document.querySelector("#search");
const form = document.querySelector("#product-form");
const notice = document.querySelector("#notice");

function save() {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function safeImage(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function money(amount) {
  return new Intl.NumberFormat("es-VE", {
    style: "currency", currency: "USD"
  }).format(Number(amount) || 0);
}

function showNotice(message) {
  notice.textContent = message;
  notice.classList.add("show");
  setTimeout(() => notice.classList.remove("show"), 2500);
}

function renderFilters() {
  const brands = [...new Set(products.map(product => product.brand).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
  const options = ["Todas", ...brands];
  if (!options.includes(activeBrand)) activeBrand = "Todas";

  filters.innerHTML = options.map(brand => `
    <button class="filter ${brand === activeBrand ? "active" : ""}" type="button"
      data-brand="${escapeHTML(brand)}">${escapeHTML(brand)}</button>
  `).join("");

  filters.querySelectorAll("[data-brand]").forEach(button => {
    button.addEventListener("click", () => {
      activeBrand = button.dataset.brand;
      renderCatalog();
    });
  });
}

function renderCatalog() {
  renderFilters();
  const term = search.value.trim().toLocaleLowerCase("es");
  const visible = products.filter(product => {
    const matchesBrand = activeBrand === "Todas" || product.brand === activeBrand;
    const matchesSearch = `${product.name} ${product.brand}`.toLocaleLowerCase("es").includes(term);
    return matchesBrand && matchesSearch;
  });

  if (!visible.length) {
    catalog.innerHTML = `<p class="empty">Todavía no hay perfumes disponibles en esta selección. Puedes agregarlos en la sección “Agregar perfume”.</p>`;
    return;
  }

  catalog.innerHTML = visible.map(product => {
    const image = safeImage(product.image);
    return `
      <article class="product-card">
        ${image
          ? `<img class="product-image" src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" loading="lazy">`
          : `<div class="product-image" aria-label="Imagen no disponible">M</div>`}
        <div class="product-info">
          <div class="product-brand">${escapeHTML(product.brand)}</div>
          <h3>${escapeHTML(product.name)}</h3>
          <div class="stock">${Number(product.stock)} disponible(s)</div>
          <div class="product-row">
            <span class="price">${money(product.price)}</span>
            <button class="small-button" type="button" data-add="${escapeHTML(product.id)}">Agregar</button>
          </div>
          <button class="remove-button" type="button" data-delete="${escapeHTML(product.id)}">Eliminar producto</button>
        </div>
      </article>`;
  }).join("");

  catalog.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => addToCart(button.dataset.add));
  });
  catalog.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => deleteProduct(button.dataset.delete));
  });
}

function addToCart(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  if ((cart[id] || 0) >= Number(product.stock)) {
    showNotice("No hay más unidades disponibles.");
    return;
  }
  cart[id] = (cart[id] || 0) + 1;
  save();
  renderCart();
  showNotice("Perfume agregado al carrito.");
}

function deleteProduct(id) {
  if (!confirm("¿Eliminar este perfume del catálogo?")) return;
  products = products.filter(product => product.id !== id);
  delete cart[id];
  save();
  renderCatalog();
  renderCart();
  showNotice("Producto eliminado.");
}

function renderCart() {
  const container = document.querySelector("#cart-items");
  const entries = Object.entries(cart).filter(([id, quantity]) =>
    products.some(product => product.id === id) && quantity > 0
  );

  let total = 0;
  let count = 0;

  if (!entries.length) {
    container.innerHTML = `<p class="empty">Tu carrito está vacío.</p>`;
  } else {
    container.innerHTML = entries.map(([id, quantity]) => {
      const product = products.find(item => item.id === id);
      const subtotal = Number(product.price) * quantity;
      total += subtotal;
      count += quantity;
      return `
        <div class="cart-line">
          <div><strong>${escapeHTML(product.name)}</strong>
            <small>${escapeHTML(product.brand)} · ${money(product.price)} c/u</small>
          </div>
          <div class="quantity">
            <button type="button" aria-label="Quitar una unidad" data-change="-1" data-id="${escapeHTML(id)}">−</button>
            <span>${quantity}</span>
            <button type="button" aria-label="Agregar una unidad" data-change="1" data-id="${escapeHTML(id)}">+</button>
            <strong>${money(subtotal)}</strong>
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll("[data-change]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        const next = (cart[id] || 0) + Number(button.dataset.change);
        const product = products.find(item => item.id === id);
        if (next <= 0) delete cart[id];
        else if (product && next <= Number(product.stock)) cart[id] = next;
        else showNotice("No hay más unidades disponibles.");
        save();
        renderCart();
      });
    });
  }

  document.querySelector("#cart-count").textContent = count;
  document.querySelector("#cart-total").textContent = money(total);
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(form);
  const product = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name: String(data.get("name")).trim(),
    brand: String(data.get("brand")).trim(),
    price: Number(data.get("price")),
    stock: Number(data.get("stock")),
    image: safeImage(String(data.get("image") || "").trim())
  };

  if (!product.name || !product.brand || product.price <= 0 || product.stock < 1) {
    showNotice("Revisa los datos del perfume.");
    return;
  }

  products.push(product);
  save();
  form.reset();
  activeBrand = "Todas";
  renderCatalog();
  showNotice("Perfume guardado en este dispositivo.");
  document.querySelector("#perfumes").scrollIntoView({ behavior: "smooth" });
});

search.addEventListener("input", renderCatalog);

document.querySelector("#checkout-button").addEventListener("click", () => {
  const items = Object.entries(cart)
    .filter(([id, quantity]) => quantity > 0 && products.some(product => product.id === id))
    .map(([id, quantity]) => {
      const product = products.find(item => item.id === id);
      return `• ${product.name} (${product.brand}) x${quantity} — ${money(product.price * quantity)}`;
    });

  if (!items.length) {
    showNotice("Agrega un perfume al carrito antes de hacer el pedido.");
    return;
  }

  const total = Object.entries(cart).reduce((sum, [id, quantity]) => {
    const product = products.find(item => item.id === id);
    return sum + (product ? Number(product.price) * quantity : 0);
  }, 0);

  const message = `Hola, MagnoStore. Quiero hacer este pedido:\n${items.join("\n")}\n\nTotal estimado: ${money(total)}`;
  window.open(`https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
});

document.querySelector("#year").textContent = new Date().getFullYear();

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelector("#install-button").hidden = false;
});

document.querySelector("#install-button").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.querySelector("#install-button").hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(error =>
      console.error("No se pudo registrar el service worker:", error)
    );
  });
}

renderCatalog();
renderCart();
