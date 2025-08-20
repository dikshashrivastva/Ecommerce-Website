const API_URL = "https://your-backend.onrender.com/api/products";

async function fetchProducts() {
  let res = await fetch(API_URL);
  let products = await res.json();

  document.getElementById("product-list").innerHTML = products.map(p => `
    <div class="product">
      <img src="${p.image}" alt="${p.name}" width="100">
      <h3>${p.name}</h3>
      <p>$${p.price}</p>
    </div>
  `).join("");
}

fetchProducts();
