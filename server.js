// server.js
// Minimal Express + MongoDB Atlas API for ShopCart
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

// --- Middleware ---
app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.CORS_ORIGIN,            // GitHub Pages
      "http://localhost:5500",            // local static server
      "http://127.0.0.1:5500",
      "http://localhost:5173",
      "http://localhost:3000"
    ].filter(Boolean);
    // allow no-origin for curl/postman
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: false
}));

// --- Mongo ---
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/shopcart";
mongoose.set("strictQuery", true);
mongoose.connect(MONGODB_URI).then(() => {
  console.log("MongoDB connected");
}).catch((e) => {
  console.error("MongoDB error", e.message);
  process.exit(1);
});

// --- Schemas ---
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  rating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  brand: String,
  category: String,
  countInStock: { type: Number, default: 100 },
  description: String,
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
const User = mongoose.model("User", userSchema);

// --- Helpers ---
const sign = (user) =>
  jwt.sign({ _id: user._id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });

const auth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Token invalid or expired" });
  }
};

// --- Routes ---
app.get("/", (req, res) => res.json({ ok: true, service: "ShopCart API" }));

// Seed some demo products (run once, then remove/disable route if you want)
app.post("/api/seed", async (req, res) => {
  const count = await Product.countDocuments();
  if (count > 0) return res.json({ message: "Already seeded", count });
  const demo = [
    {
      name: "Amazon Echo Dot 3rd Generation",
      image: "https://images.unsplash.com/photo-1518441902113-c1d3e1b2a3a4?q=80&w=900&auto=format&fit=crop",
      price: 29.99, rating: 5, numReviews: 1, brand: "Amazon", category: "Electronics"
    },
    {
      name: "iPhone 11 Pro 256GB Memory",
      image: "https://images.unsplash.com/photo-1567581935884-3349723552ca?q=80&w=900&auto=format&fit=crop",
      price: 599.99, rating: 4, numReviews: 2, brand: "Apple", category: "Mobile"
    },
    {
      name: "Sony Playstation 4 Pro White Version",
      image: "https://images.unsplash.com/photo-1606813907291-76c67c1a6f3b?q=80&w=900&auto=format&fit=crop",
      price: 399.99, rating: 5, numReviews: 12, brand: "Sony", category: "Gaming"
    },
    {
      name: "Logitech G-Series Gaming Mouse",
      image: "https://images.unsplash.com/photo-1588349427182-2f6f1e3b1c39?q=80&w=900&auto=format&fit=crop",
      price: 49.99, rating: 5, numReviews: 1, brand: "Logitech", category: "Accessories"
    },
    {
      name: "Airpods Wireless Bluetooth Headphones",
      image: "https://images.unsplash.com/photo-1585386959984-a41552231658?q=80&w=900&auto=format&fit=crop",
      price: 89.99, rating: 4, numReviews: 1, brand: "Apple", category: "Audio"
    },
    {
      name: "Canon EOS 80D DSLR Camera",
      image: "https://images.unsplash.com/photo-1519183071298-a2962be96f83?q=80&w=900&auto=format&fit=crop",
      price: 929.99, rating: 5, numReviews: 12, brand: "Canon", category: "Camera"
    }
  ];
  const out = await Product.insertMany(demo);
  res.json({ message: "Seeded", count: out.length });
});

// Products list + search
app.get("/api/products", async (req, res) => {
  const q = (req.query.q || "").trim();
  const filter = q ? { name: { $regex: q, $options: "i" } } : {};
  const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ products });
});

// Product details (optional for PDP)
app.get("/api/products/:id", async (req, res) => {
  const p = await Product.findById(req.params.id).lean();
  if (!p) return res.status(404).json({ message: "Product not found" });
  res.json(p);
});

// Auth: register & login
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: "Email already registered" });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  res.json({ user: { _id: user._id, name: user.name, email: user.email } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });
  const token = sign(user);
  res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
});

// Example protected route
app.get("/api/profile", auth, async (req, res) => {
  res.json({ user: req.user });
});

// 404 handler
app.use((req,res)=>res.status(404).json({ message: "Route not found" }));

// Error handler (avoid HTML error pages on Render)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ message: err.message || "Server error" });
});

// Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on ${PORT}`));
