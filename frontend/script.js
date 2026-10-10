// Inventory Management System - frontend logic (Fetch API, no page reloads)

const API_URL = "http://127.0.0.1:5000";
const LOW_STOCK_THRESHOLD = 5; // keep in sync with backend

const tableBody = document.getElementById("product-table");
const emptyText = document.getElementById("empty-text");
const messageBox = document.getElementById("message");
const banner = document.getElementById("low-stock-banner");

// ---------- Helpers ----------
function showMessage(text, type = "success") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
  setTimeout(() => messageBox.classList.add("hidden"), 3500);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function request(path, options = {}) {
  const response = await fetch(API_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

// ---------- Rendering ----------
function renderProducts(products) {
  tableBody.innerHTML = "";
  emptyText.classList.toggle("hidden", products.length > 0);

  products.forEach((p) => {
    const isLow = p.quantity < LOW_STOCK_THRESHOLD;
    const row = document.createElement("tr");
    if (isLow) row.classList.add("low-stock");

    row.innerHTML = `
      <td>${p.product_id}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td><input type="number" min="0" step="1" value="${p.quantity}" data-field="quantity"></td>
      <td><input type="number" min="0" step="0.01" value="${p.price}" data-field="price"></td>
      <td><span class="badge ${isLow ? "low" : "ok"}">${isLow ? "Low stock" : "In stock"}</span></td>
      <td class="actions">
        <button class="success" data-action="save" data-id="${p.product_id}">Save</button>
        <button class="danger" data-action="delete" data-id="${p.product_id}">Delete</button>
      </td>`;
    tableBody.appendChild(row);
  });
}

async function updateLowStockBanner() {
  try {
    const low = await request(`/products/low-stock?threshold=${LOW_STOCK_THRESHOLD}`);
    if (low.length > 0) {
      const names = low.map((p) => escapeHtml(p.name)).join(", ");
      banner.innerHTML = `⚠ <strong>${low.length}</strong> item(s) low on stock: ${names}`;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  } catch (err) {
    banner.classList.add("hidden");
  }
}

// ---------- Actions ----------
async function loadProducts() {
  try {
    renderProducts(await request("/products"));
    updateLowStockBanner();
  } catch (err) {
    showMessage("Cannot reach server. Is the Flask backend running?", "error");
  }
}

async function addProduct(event) {
  event.preventDefault();
  const name = document.getElementById("name").value.trim();
  const category = document.getElementById("category").value.trim();
  const quantity = document.getElementById("quantity").value;
  const price = document.getElementById("price").value;

  if (!name || !category) return showMessage("Name and category are required", "error");
  if (quantity === "" || !Number.isInteger(Number(quantity)) || Number(quantity) < 0)
    return showMessage("Quantity must be a whole number, 0 or more", "error");
  if (price === "" || Number(price) < 0)
    return showMessage("Price must be 0 or more", "error");

  try {
    await request("/products", {
      method: "POST",
      body: JSON.stringify({ name, category, quantity: Number(quantity), price: Number(price) }),
    });
    document.getElementById("add-form").reset();
    showMessage("Product added");
    loadProducts();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function searchProducts() {
  const q = document.getElementById("search-input").value.trim();
  if (!q) return loadProducts();
  try {
    renderProducts(await request(`/products/search?q=${encodeURIComponent(q)}`));
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function saveProduct(id, row) {
  const quantity = row.querySelector('[data-field="quantity"]').value;
  const price = row.querySelector('[data-field="price"]').value;
  if (quantity === "" || Number(quantity) < 0)
    return showMessage("Stock cannot go below zero", "error");
  if (price === "" || Number(price) < 0)
    return showMessage("Price cannot be negative", "error");

  try {
    await request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify({ quantity: Number(quantity), price: Number(price) }),
    });
    showMessage("Product updated");
    loadProducts();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    await request(`/products/${id}`, { method: "DELETE" });
    showMessage("Product deleted");
    loadProducts();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

// ---------- Event listeners ----------
document.getElementById("add-form").addEventListener("submit", addProduct);
document.getElementById("search-btn").addEventListener("click", searchProducts);
document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchProducts();
});
document.getElementById("clear-btn").addEventListener("click", () => {
  document.getElementById("search-input").value = "";
  loadProducts();
});

tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "save") saveProduct(id, btn.closest("tr"));
  if (btn.dataset.action === "delete") deleteProduct(id);
});

loadProducts();