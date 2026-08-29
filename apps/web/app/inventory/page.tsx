"use client";

import {
  AppShell,
  Badge,
  EmptyState,
  Icon,
  Modal,
  StatCard,
  Tabs,
  type NavItem,
  type OrganisationSummary,
} from "@crmkaro/ui";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, getApiUrl } from "@/lib/api";

const nav: NavItem[] = [
  { label: "Dashboard", icon: "home", href: "/" },
  { label: "People & Directory", icon: "people", href: "/people" },
  { label: "Leads & CRM", icon: "crm", href: "/crm" },
  { label: "Finance & Fees", icon: "finance", href: "/finance" },
  { label: "Staff & Salary", icon: "payroll", href: "/payroll" },
  { label: "Inventory & Stock", icon: "inventory", href: "/inventory" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  costPriceMinor: number | null;
  sellingPriceMinor: number | null;
  currentStock: number;
  reorderPoint: number | null;
  categoryId: string | null;
  category: Category | null;
  createdAt: string;
};

type StockMovement = {
  id: string;
  productId: string;
  product: { name: string; sku: string; unit: string };
  type: "OPENING" | "PURCHASE" | "SALE" | "RETURN_IN" | "RETURN_OUT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  actor?: { name: string | null; email: string };
};

function formatMoney(amountMinor: number | null | undefined, currency = "INR") {
  if (!amountMinor) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function InventoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = getApiUrl();

  // Data states
  const [activeTab, setActiveTab] = useState<"catalog" | "movements">("catalog");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Context & AppShell info
  const [orgName, setOrgName] = useState("CRMKaro Workspace");
  const [userName, setUserName] = useState("Workspace User");
  const [userRole, setUserRole] = useState("Staff");
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);

  // Modals
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [stockAdjustOpen, setStockAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form states - Create Product
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formUnit, setFormUnit] = useState("pcs");
  const [formCost, setFormCost] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formReorder, setFormReorder] = useState("10");
  const [formOpeningStock, setFormOpeningStock] = useState("0");
  const [prodBusy, setProdBusy] = useState(false);
  const [prodError, setProdError] = useState("");

  // Form states - Category
  const [newCatName, setNewCatName] = useState("");
  const [catBusy, setCatBusy] = useState(false);
  const [catError, setCatError] = useState("");

  // Form states - Stock Adjustment
  const [adjustType, setAdjustType] = useState<
    "PURCHASE" | "SALE" | "RETURN_IN" | "RETURN_OUT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT"
  >("PURCHASE");
  const [adjustQty, setAdjustQty] = useState("10");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustError, setAdjustError] = useState("");

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }

  function openCreateProductModal() {
    const nextNum = products.length + 1;
    const seqSku = `SKU-${String(nextNum).padStart(3, "0")}`;
    setFormSku(seqSku);
    setFormName("");
    setFormCost("");
    setFormPrice("");
    setFormOpeningStock("0");
    setFormReorder("10");
    setProdError("");
    setCreateProductOpen(true);
  }

  // Load session context
  const loadContext = useCallback(async () => {
    try {
      const meRes = await authFetch(`${api}/auth/me`, { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/login");
        return;
      }
      const orgsRes = await authFetch(`${api}/organisations`, { credentials: "include" });
      if (orgsRes.ok) {
        const orgList = await orgsRes.json();
        const activeOrgEntry = orgList.find(
          (o: { organisation: { id: string; name: string } | null; role: { name: string } }) =>
            o.organisation,
        );
        if (activeOrgEntry?.organisation) {
          setOrgName(activeOrgEntry.organisation.name);
          setUserRole(activeOrgEntry.role?.name || "Staff");
        }
        setOrganisations(
          orgList
            .map((o: { organisation: { id: string; name: string; businessType?: string } }) => o.organisation)
            .filter(Boolean),
        );
      }
    } catch {
      // ignore
    }
  }, [api, router]);

  // Load Categories
  const loadCategories = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/inventory/categories`, { credentials: "include" });
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch {
      // ignore
    }
  }, [api]);

  // Load Products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (lowStockOnly) params.set("lowStock", "true");

      const res = await authFetch(`${api}/inventory/products?${params.toString()}`, { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load products.");
      const data = await res.json();
      setProducts(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, search, lowStockOnly, router]);

  // Load Movements
  const loadMovements = useCallback(async () => {
    try {
      const res = await authFetch(`${api}/inventory/movements`, { credentials: "include" });
      if (res.ok) {
        setMovements(await res.json());
      }
    } catch {
      // ignore
    }
  }, [api]);

  useEffect(() => {
    loadContext();
    loadCategories();
  }, [loadContext, loadCategories]);

  useEffect(() => {
    if (activeTab === "catalog") {
      loadProducts();
    } else {
      loadMovements();
    }
  }, [activeTab, loadProducts, loadMovements]);

  // Handle URL params
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "new-product") {
      const randomSku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
      setFormSku(randomSku);
      setCreateProductOpen(true);
    }
  }, [searchParams]);

  // Metrics
  const lowStockCount = products.filter(
    (p) => p.reorderPoint !== null && p.currentStock <= p.reorderPoint,
  ).length;
  const totalValuationMinor = products.reduce(
    (acc, p) => acc + p.currentStock * (p.costPriceMinor || p.sellingPriceMinor || 0),
    0,
  );

  async function handleCreateProduct(e: FormEvent) {
    e.preventDefault();
    setProdBusy(true);
    setProdError("");
    try {
      const costNum = parseFloat(formCost);
      const priceNum = parseFloat(formPrice);
      const reorderNum = parseInt(formReorder, 10);
      const openStockNum = parseInt(formOpeningStock, 10);

      const res = await authFetch(`${api}/inventory/products`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formName,
          sku: formSku,
          categoryId: formCategoryId || undefined,
          unit: formUnit || "pcs",
          costPriceMinor: !isNaN(costNum) ? Math.round(costNum * 100) : undefined,
          sellingPriceMinor: !isNaN(priceNum) ? Math.round(priceNum * 100) : undefined,
          reorderPoint: !isNaN(reorderNum) ? reorderNum : undefined,
          initialStock: !isNaN(openStockNum) ? openStockNum : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.message || "Failed to create product.";
        if (data.fields && typeof data.fields === "object") {
          const fieldMsgs = Object.entries(data.fields)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
            .join("; ");
          if (fieldMsgs) errMsg = `${errMsg} (${fieldMsgs})`;
        }
        throw new Error(errMsg);
      }
      setCreateProductOpen(false);
      setFormName("");
      setFormSku("");
      setFormCost("");
      setFormPrice("");
      loadProducts();
      showToast(`Product "${formName}" created in catalog successfully!`, "success");
    } catch (err) {
      setProdError((err as Error).message);
    } finally {
      setProdBusy(false);
    }
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatBusy(true);
    setCatError("");
    try {
      const res = await authFetch(`${api}/inventory/categories`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create category.");
      setNewCatName("");
      setCreateCategoryOpen(false);
      loadCategories();
      showToast(`Category "${newCatName.trim()}" created!`, "success");
    } catch (err) {
      setCatError((err as Error).message);
    } finally {
      setCatBusy(false);
    }
  }

  async function handleRecordMovement(e: FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setAdjustBusy(true);
    setAdjustError("");
    try {
      const qtyNum = parseInt(adjustQty, 10);
      const res = await authFetch(`${api}/inventory/products/${selectedProduct.id}/movements`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: adjustType,
          quantity: qtyNum,
          reason: adjustReason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.message || "Failed to adjust stock.";
        if (data.fields && typeof data.fields === "object") {
          const fieldMsgs = Object.entries(data.fields)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
            .join("; ");
          if (fieldMsgs) errMsg = `${errMsg} (${fieldMsgs})`;
        }
        throw new Error(errMsg);
      }
      setStockAdjustOpen(false);
      setAdjustQty("10");
      setAdjustReason("");
      loadProducts();
      loadMovements();
      showToast(`Stock movement recorded for ${selectedProduct.name}!`, "success");
    } catch (err) {
      setAdjustError((err as Error).message);
    } finally {
      setAdjustBusy(false);
    }
  }

  const tabItems = [
    { id: "catalog", label: "Products Catalog", count: products.length },
    { id: "movements", label: "Stock Movements Ledger", count: movements.length },
  ];

  return (
    <AppShell
      product="CRMKaro"
      organisation={orgName}
      organisations={organisations}
      currentPath="/inventory"
      nav={nav}
      userName={userName}
      userRole={userRole}
      apiUrl={api}
      onNavigate={(href) => router.push(href)}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Icon name="inventory" size={14} /> Products & Stock
          </p>
          <h1>Inventory & Stock Ledger</h1>
          <p className="subheading">
            Track catalog products, monitor stock levels, manage low-stock alerts, and record ledger movements.
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCreateCategoryOpen(true)}
          >
            <Icon name="tag" size={15} />
            <span>Add Category</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => openCreateProductModal()}
          >
            <Icon name="plus" size={15} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="stats-grid">
        <StatCard
          label="Total Products"
          value={products.length}
          change="Catalog items"
          icon="inventory"
          tone="blue"
        />
        <StatCard
          label="Low Stock Alerts"
          value={lowStockCount}
          change={lowStockCount > 0 ? "Requires reordering" : "Sufficient stock"}
          icon="alertCircle"
          tone={lowStockCount > 0 ? "rose" : "teal"}
        />
        <StatCard
          label="Stock Valuation"
          value={formatMoney(totalValuationMinor)}
          change="Estimated cost basis"
          icon="finance"
          tone="amber"
        />
        <StatCard
          label="Categories"
          value={categories.length}
          change="Active groups"
          icon="tag"
          tone="purple"
        />
      </div>

      <Tabs
        items={tabItems}
        active={activeTab}
        onChange={(id) => setActiveTab(id as "catalog" | "movements")}
      />

      {/* Products Catalog Tab */}
      {activeTab === "catalog" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <div>
                <strong style={{ fontSize: 13, color: "#1e3a8a" }}>Product Catalog & Stock Levels</strong>
                <div style={{ fontSize: 12, color: "#2563eb" }}>
                  Manage your inventory catalog items, course materials, batch kits, selling prices, and reorder levels.
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => openCreateProductModal()} style={{ flexShrink: 0 }}>
              <Icon name="plus" size={14} />
              <span>+ Add Product</span>
            </button>
          </div>

          <div className="toolbar">
            <div className="search-box">
              <Icon name="search" size={15} />
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="toolbar-actions">
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                />
                <span>Low stock only ({lowStockCount})</span>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="state-spinner" />
              <p>Loading products…</p>
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon="inventory"
              title="No products in catalog"
              description="Add your business items, coaching materials, or physical inventory to start tracking."
              actionLabel="Add Product"
              onAction={() => openCreateProductModal()}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Current Stock</th>
                    <th>Reorder Level</th>
                    <th>Selling Price</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((prod) => {
                    const isLow =
                      prod.reorderPoint !== null && prod.currentStock <= prod.reorderPoint;
                    return (
                      <tr key={prod.id}>
                        <td>
                          <strong>{prod.name}</strong>
                        </td>
                        <td>
                          <code>{prod.sku}</code>
                        </td>
                        <td>
                          <Badge tone="neutral">{prod.category?.name || "General"}</Badge>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isLow ? "var(--danger)" : "var(--ink)",
                            }}
                          >
                            {prod.currentStock} {prod.unit}
                          </span>
                          {isLow && (
                            <span style={{ marginLeft: 6 }}>
                              <Badge tone="red">Low Stock</Badge>
                            </span>
                          )}
                        </td>
                        <td>
                          {prod.reorderPoint !== null ? `${prod.reorderPoint} ${prod.unit}` : "—"}
                        </td>
                        <td>
                          <strong>{formatMoney(prod.sellingPriceMinor)}</strong>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedProduct(prod);
                              setStockAdjustOpen(true);
                            }}
                          >
                            <Icon name="refresh" size={13} />
                            <span>Adjust Stock</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Movements Ledger Tab */}
      {activeTab === "movements" && (
        <div className="table-wrap">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #cbd5e1", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>📊</span>
              <div>
                <strong style={{ fontSize: 13, color: "#334155" }}>Stock Movement Ledger & Audit History</strong>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Complete audit trail of all inventory stock inflows (purchases, customer returns) and outflows (sales, damage, losses).
                </div>
              </div>
            </div>
          </div>

          {movements.length === 0 ? (
            <EmptyState
              icon="activity"
              title="No stock movements recorded"
              description="Stock ledger entries will automatically be logged when items are purchased, adjusted, or sold."
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Qty Change</th>
                  <th>Balance After</th>
                  <th>Reason / Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mov) => {
                  const isPositive =
                    mov.type === "PURCHASE" ||
                    mov.type === "OPENING" ||
                    mov.type === "RETURN_IN" ||
                    mov.type === "ADJUSTMENT_IN";

                  return (
                    <tr key={mov.id}>
                      <td>{new Date(mov.createdAt).toLocaleString()}</td>
                      <td>
                        <strong>{mov.product?.name}</strong>
                        <small style={{ color: "var(--muted)", display: "block" }}>
                          SKU: {mov.product?.sku}
                        </small>
                      </td>
                      <td>
                        <Badge tone={isPositive ? "green" : "amber"}>{mov.type}</Badge>
                      </td>
                      <td>
                        <strong style={{ color: isPositive ? "#15803d" : "#b91c1c" }}>
                          {isPositive ? `+${mov.quantity}` : `-${mov.quantity}`} {mov.product?.unit}
                        </strong>
                      </td>
                      <td>
                        <strong>
                          {mov.balanceAfter} {mov.product?.unit}
                        </strong>
                      </td>
                      <td>{mov.reason || mov.reference || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Product Modal */}
      <Modal
        isOpen={createProductOpen}
        onClose={() => setCreateProductOpen(false)}
        title="Add Product to Catalog"
        subtitle="Specify SKU, pricing, category, and initial inventory stock"
        maxWidth={500}
      >
        <form onSubmit={handleCreateProduct} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {prodError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {prodError}
            </div>
          )}

          {/* 1-Click Product Templates */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 750, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              ⚡ 1-Click Product Templates:
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {[
                { name: "Study Material Course Book Vol 1", unit: "pcs", cost: "350", price: "600", stock: "50" },
                { name: "Institute Uniform & Badge Kit", unit: "sets", cost: "700", price: "1200", stock: "30" },
                { name: "Online Test Portal License", unit: "licenses", cost: "1000", price: "2000", stock: "100" },
                { name: "Practice Test Question Bank", unit: "box", cost: "250", price: "450", stock: "40" },
              ].map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  onClick={() => {
                    setFormName(tmpl.name);
                    setFormUnit(tmpl.unit);
                    setFormCost(tmpl.cost);
                    setFormPrice(tmpl.price);
                    setFormOpeningStock(tmpl.stock);
                  }}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#1e3a8a",
                    fontSize: 11,
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  + {tmpl.name.split(" ")[0]} {tmpl.name.split(" ")[1]} (₹{tmpl.price})
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group full">
              <label>Product / Item Name *</label>
              <input
                type="text"
                placeholder="e.g. Mathematics Course Book Vol 1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>SKU / Item Code *</label>
              <input
                type="text"
                value={formSku}
                onChange={(e) => setFormSku(e.target.value)}
                placeholder="e.g. SKU-001"
                required
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                className="filter-select"
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
              >
                <option value="">-- General (No category) --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Unit of Measurement *</label>
              <select
                className="filter-select"
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="box">Boxes (box)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="hours">Hours (hr)</option>
                <option value="licenses">Licenses</option>
                <option value="sets">Sets / Kits</option>
              </select>
            </div>
            <div className="form-group">
              <label>Low Stock Alert Level</label>
              <input
                type="number"
                value={formReorder}
                onChange={(e) => setFormReorder(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Cost Price (₹/unit)</label>
              <input
                type="number"
                placeholder="e.g. 400"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Selling Price (₹/unit)</label>
              <input
                type="number"
                placeholder="e.g. 750"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Initial Opening Stock Quantity</label>
            <input
              type="number"
              min="0"
              value={formOpeningStock}
              onChange={(e) => setFormOpeningStock(e.target.value)}
              placeholder="e.g. 50"
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateProductOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={prodBusy}>
              {prodBusy ? "Saving…" : "Save Product"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={createCategoryOpen}
        onClose={() => setCreateCategoryOpen(false)}
        title="Create Product Category"
        subtitle="Group products into organized categories"
        maxWidth={400}
      >
        <form onSubmit={handleCreateCategory} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {catError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {catError}
            </div>
          )}

          <div className="form-group">
            <label>Category Name *</label>
            <input
              type="text"
              placeholder="e.g. Books, Study Materials, Merchandise"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateCategoryOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={catBusy}>
              {catBusy ? "Creating…" : "Save Category"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={stockAdjustOpen}
        onClose={() => setStockAdjustOpen(false)}
        title="Record Stock Movement"
        subtitle={selectedProduct ? `${selectedProduct.name} (Current Stock: ${selectedProduct.currentStock} ${selectedProduct.unit})` : "Adjust Stock"}
        maxWidth={480}
      >
        <form onSubmit={handleRecordMovement} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {adjustError && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {adjustError}
            </div>
          )}

          <div className="form-group">
            <label>Movement Type *</label>
            <select
              className="filter-select"
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as any)}
            >
              <option value="PURCHASE">📥 Purchase (+ Stock In - Bought new inventory)</option>
              <option value="SALE">📤 Sale (- Stock Out - Dispatched to customer)</option>
              <option value="RETURN_IN">🔄 Customer Return (+ Stock In - Returned by student/customer)</option>
              <option value="RETURN_OUT">↩️ Vendor Return (- Stock Out - Returned to supplier)</option>
              <option value="ADJUSTMENT_IN">➕ Audit Surplus (+ Stock In - Inventory count correction)</option>
              <option value="ADJUSTMENT_OUT">➖ Damage / Loss (- Stock Out - Damaged, lost, expired)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Quantity *</label>
            <input
              type="number"
              min="1"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Reason / Reference Note</label>
            <input
              type="text"
              placeholder="e.g. PO-8921, Batch delivery, Annual audit"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ margin: "-22px", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStockAdjustOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={adjustBusy}>
              {adjustBusy ? "Recording…" : "Post Movement"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast Notification Feedback Card */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 18px",
            borderRadius: 12,
            background: toast.type === "success" ? "#0f172a" : "#991b1b",
            color: "#ffffff",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
            fontSize: 13.5,
            fontWeight: 600,
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#fff",
              borderRadius: 6,
              padding: "3px 8px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 750,
              marginLeft: 8,
            }}
          >
            OK
          </button>
        </div>
      )}
    </AppShell>
  );
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <div className="state-spinner" />
          <p>Loading inventory…</p>
        </div>
      }
    >
      <InventoryContent />
    </Suspense>
  );
}

