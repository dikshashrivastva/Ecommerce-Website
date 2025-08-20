/* ---------- Config ---------- */
const API_BASE = window.API_BASE || "https://shopcart-set5.onrender.com"; // set in index.html
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ---------- Simple router (#/...) ---------- */
const views = {
  home: $("#view-home"),
  cart: $("#view-cart"),
  signin: $("#view-signin"),
  register: $("#view-register"),
  search: $("#view-search"),
};

function show(view) {
  Object.values(views).forEach(v => v.classList.remove("active"));
  (views[view] || views.home).classList.add("active");
}

window.addEventListener("hashchange", () => route());
function route() {
  const hash = location.hash.replace("#/", "") || "";
  if (hash.startsWith("cart")) renderCart(), show("cart");
  else if (hash.startsWith("signin")) show("signin");
  else if (hash.startsWith("register")) show("register");
  else if (hash.startsWith("search")) { loadSearch(currentSearchTerm); show("search"); }
  else show("home");
}

/* ---------- State ---------- */
let products = [];
let featured = [];
let currentSlide = 0;
let currentSearchTerm = "";
const CART_KEY = "shopcart.cart";
const TOKEN_KEY = "shopcart.token";
const USER_KEY = "shopcart.user";

function getCart() { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
function setCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); updateCartUIBadge(); }
function addToCart(p) {
  const cart = getCart();
  const found = cart.find(i => i._id === p._id);
  if (found) found.qty += 1; else cart.push({ _id: p._id, name: p.name, price: p.price, image: p.image, qty: 1 });
  setCart(cart);
}

/* ---------- Utilities ---------- */
function formatPrice(n) { return `$${Number(n).toFixed(2)}`; }
function setText(el, txt) { if (el) el.textContent = txt; }
function updateCartUIBadge() {
  const total = getCart().reduce((s,i)=>s+i.qty,0);
  setText($("#cartCount"), total);
}

/* ---------- Fetch helpers ---------- */
async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, mode: "cors" });
  if (!res.ok) throw new Error((await res.json()).message || "Request failed");
  return res.json();
}

/* ---------- Home: products + hero ---------- */
async function loadHome() {
  try {
    const data = await api(`/api/products`);
    products = data.products;
    renderGrid($("#productGrid"), products);
    featured = products.slice(0, 3);
    setupHero();
  } catch (e) {
    console.error(e);
  }
}

function renderGrid(container, list) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class="alert info">No Products Found</div>`;
    return;
  }
  const tpl = $("#productCardTpl");
  list.forEach(p => {
    const node = tpl.content.cloneNode(true);
    node.querySelector(".card-img").src = p.image;
    node.querySelector(".card-title").textContent = p.name;
    node.querySelector(".card-title").href = "#/"; // could link to PDP later
    node.querySelector(".stars").style.filter = `grayscale(${Math.max(0, (5 - p.rating)/5)})`;
    node.querySelector(".reviews").textContent = `${p.numReviews} reviews`;
    node.querySelector(".price").textContent = formatPrice(p.price);
    node.querySelector(".add").addEventListener("click", () => addToCart(p));
    container.appendChild(node);
  });
}

function setupHero() {
  if (!featured.length) return;
  const img = $("#heroImage");
  const title = $("#heroTitle");
  const dotsWrap = $("#heroDots");
  dotsWrap.innerHTML = "";
  featured.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "dot" + (i === 0 ? " active" : "");
    dotsWrap.appendChild(d);
  });
  function renderSlide(i) {
    currentSlide = (i + featured.length) % featured.length;
    const f = featured[currentSlide];
    img.src = f.image;
    title.textContent = f.name.toUpperCase();
    $$("#heroDots .dot").forEach((d, idx) => d.classList.toggle("active", idx === currentSlide));
  }
  $("#slidePrev").onclick = () => renderSlide(currentSlide - 1);
  $("#slideNext").onclick = () => renderSlide(currentSlide + 1);
  renderSlide(0);
}

/* ---------- Cart ---------- */
function renderCart() {
  const items = getCart();
  const wrap = $("#cartItems");
  const empty = $("#cartEmpty");
  const countEl = $("#cartItemsCount");
  const subEl = $("#cartSubtotal");
  const checkoutBtn = $("#checkoutBtn");

  wrap.innerHTML = "";
  if (!items.length) {
    empty.classList.remove("hidden");
    setText(countEl, 0);
    setText(subEl, "$0.00");
    checkoutBtn.disabled = true;
    return;
  }
  empty.classList.add("hidden");
  let subtotal = 0;
  items.forEach(it => {
    subtotal += it.price * it.qty;
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img src="${it.image}" alt="${it.name}">
      <div>
        <div><strong>${it.name}</strong></div>
        <div class="price">${formatPrice(it.price)}</div>
      </div>
      <div class="qty">
        <button aria-label="decrease">-</button>
        <div>${it.qty}</div>
        <button aria-label="increase">+</button>
      </div>
      <button aria-label="remove" class="small">Remove</button>
    `;
    const [decBtn, , incBtn] = row.querySelectorAll(".qty button, .qty div");
    const removeBtn = row.querySelector("button.small");
    decBtn.onclick = () => updateQty(it._id, -1);
    incBtn.onclick = () => updateQty(it._id, +1);
    removeBtn.onclick = () => removeItem(it._id);
    wrap.appendChild(row);
  });
  setText(countEl, items.reduce((s,i)=>s+i.qty,0));
  setText(subEl, formatPrice(subtotal));
  checkoutBtn.disabled = false;
  checkoutBtn.onclick = () => alert("Checkout flow can be added (create order).");
}
function updateQty(id, delta) {
  const cart = getCart();
  const item = cart.find(i => i._id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.splice(cart.indexOf(item), 1);
  setCart(cart);
  renderCart();
}
function removeItem(id) {
  const cart = getCart().filter(i => i._id !== id);
  setCart(cart);
  renderCart();
}

/* ---------- Search ---------- */
async function loadSearch(q) {
  const notice = $("#searchNotice");
  const grid = $("#searchGrid");
  if (!q) {
    notice.classList.remove("hidden");
    notice.textContent = "No Products Found";
    grid.innerHTML = "";
    return;
  }
  try {
    const data = await api(`/api/products?q=${encodeURIComponent(q)}`);
    renderGrid(grid, data.products);
    if (!data.products.length) {
      notice.classList.remove("hidden");
      notice.textContent = "No Products Found";
    } else {
      notice.classList.add("hidden");
    }
  } catch (e) {
    notice.classList.remove("hidden");
    notice.textContent = e.message || "Search failed";
  }
}

/* ---------- Auth ---------- */
$("#signinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#signinEmail").value.trim();
  const password = $("#signinPassword").value;
  const msg = $("#authMsg");
  msg.classList.add("hidden");
  try {
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    $("#authLink").textContent = `👤 ${data.user.name.split(" ")[0]}`;
    location.hash = "#/";
  } catch (err) {
    msg.className = "alert error";
    msg.textContent = err.message || "Login failed";
    msg.classList.remove("hidden");
  }
});

$("#registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#registerName").value.trim();
  const email = $("#registerEmail").value.trim();
  const password = $("#registerPassword").value;
  const box = $("#registerMsg");
  box.classList.add("hidden");
  try {
    const data = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    box.className = "alert info";
    box.textContent = "Account created. You can sign in now.";
    box.classList.remove("hidden");
    setTimeout(()=>location.hash="#/signin", 1000);
  } catch (err) {
    box.className = "alert error";
    box.textContent = err.message || "Registration failed";
    box.classList.remove("hidden");
  }
});

/* ---------- Search bar ---------- */
$("#searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  currentSearchTerm = $("#searchInput").value.trim();
  location.hash = "#/search";
});

/* ---------- Init ---------- */
setText($("#year"), new Date().getFullYear());
updateCartUIBadge();

function restoreAuthUI() {
  const raw = localStorage.getItem(USER_KEY);
  if (raw) {
    try {
      const user = JSON.parse(raw);
      $("#authLink").textContent = `👤 ${user.name.split(" ")[0]}`;
    } catch {}
  }
}
restoreAuthUI();

loadHome().then(route);
