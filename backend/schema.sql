-- Inventory Management System: database schema (SQLite)

CREATE TABLE IF NOT EXISTS products (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    category   TEXT    NOT NULL,
    quantity   INTEGER NOT NULL CHECK (quantity >= 0),
    price      REAL    NOT NULL CHECK (price >= 0)
);

-- Speeds up category / name searches
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);