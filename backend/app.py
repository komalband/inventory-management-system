"""Inventory Management System - Flask backend (REST API + SQLite)."""
import os
import sqlite3

from flask import Flask, g, jsonify, request
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "inventory.db")
SCHEMA = os.path.join(BASE_DIR, "schema.sql")
LOW_STOCK_THRESHOLD = 5

app = Flask(__name__)
CORS(app)  # lets the frontend (different port) call this API


# ---------- Database helpers ----------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with sqlite3.connect(DATABASE) as conn:
        with open(SCHEMA) as f:
            conn.executescript(f.read())


def row_to_dict(row):
    return dict(row) if row else None


# ---------- Validation ----------
def validate_new_product(data):
    """Return (cleaned_dict, error_message)."""
    if not data:
        return None, "Request body must be JSON"

    name = str(data.get("name", "")).strip()
    category = str(data.get("category", "")).strip()
    if not name:
        return None, "Name is required"
    if not category:
        return None, "Category is required"

    try:
        quantity = int(data.get("quantity"))
    except (TypeError, ValueError):
        return None, "Quantity must be a whole number"
    try:
        price = float(data.get("price"))
    except (TypeError, ValueError):
        return None, "Price must be a number"

    if quantity < 0:
        return None, "Quantity cannot be negative"
    if price < 0:
        return None, "Price cannot be negative"

    return {"name": name, "category": category,
            "quantity": quantity, "price": price}, None


# ---------- Routes ----------
@app.route("/products", methods=["GET"])
def list_products():
    rows = get_db().execute(
        "SELECT * FROM products ORDER BY product_id").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/products", methods=["POST"])
def add_product():
    cleaned, error = validate_new_product(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    db = get_db()
    cur = db.execute(
        "INSERT INTO products (name, category, quantity, price) "
        "VALUES (?, ?, ?, ?)",
        (cleaned["name"], cleaned["category"],
         cleaned["quantity"], cleaned["price"]))
    db.commit()
    row = db.execute("SELECT * FROM products WHERE product_id = ?",
                     (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route("/products/search", methods=["GET"])
def search_products():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"error": "Search query 'q' is required"}), 400

    like = f"%{q}%"
    pid = int(q) if q.isdigit() else -1  # match exact ID if q is numeric
    rows = get_db().execute(
        "SELECT * FROM products "
        "WHERE product_id = ? OR name LIKE ? OR category LIKE ? "
        "ORDER BY product_id",
        (pid, like, like)).fetchall()
    # Empty list (not an error) when nothing matches
    return jsonify([dict(r) for r in rows])


@app.route("/products/low-stock", methods=["GET"])
def low_stock():
    threshold = request.args.get("threshold", LOW_STOCK_THRESHOLD, type=int)
    rows = get_db().execute(
        "SELECT * FROM products WHERE quantity < ? ORDER BY quantity",
        (threshold,)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    db = get_db()
    product = db.execute("SELECT * FROM products WHERE product_id = ?",
                         (product_id,)).fetchone()
    if product is None:
        return jsonify({"error": "Product not found"}), 404

    quantity = product["quantity"]
    price = product["price"]

    # Absolute quantity OR relative change (e.g. -3 for selling 3 units)
    try:
        if "quantity" in data:
            quantity = int(data["quantity"])
        elif "quantity_change" in data:
            quantity = quantity + int(data["quantity_change"])
        if "price" in data:
            price = float(data["price"])
    except (TypeError, ValueError):
        return jsonify({"error": "Quantity and price must be numeric"}), 400

    if quantity < 0:
        return jsonify({"error": "Stock cannot go below zero"}), 400
    if price < 0:
        return jsonify({"error": "Price cannot be negative"}), 400

    db.execute("UPDATE products SET quantity = ?, price = ? "
               "WHERE product_id = ?", (quantity, price, product_id))
    db.commit()
    updated = db.execute("SELECT * FROM products WHERE product_id = ?",
                         (product_id,)).fetchone()
    return jsonify(row_to_dict(updated))


@app.route("/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    db = get_db()
    cur = db.execute("DELETE FROM products WHERE product_id = ?",
                     (product_id,))
    db.commit()
    if cur.rowcount == 0:
        return jsonify({"error": "Product not found"}), 404
    return jsonify({"message": "Product deleted"})


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)