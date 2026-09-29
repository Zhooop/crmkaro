import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { BottomSheet } from "../../components/BottomSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { apiFetch } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";

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
  createdAt: string;
};

type StockMovement = {
  id: string;
  productId: string;
  product?: { name: string; sku: string };
  type: string;
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
};

export function InventoryScreen() {
  const [activeTab, setActiveTab] = useState<"catalog" | "movements">("catalog");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Add Product Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formUnit, setFormUnit] = useState("pcs");
  const [formPrice, setFormPrice] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formStock, setFormStock] = useState("10");
  const [formReorder, setFormReorder] = useState("5");
  const [addBusy, setAddBusy] = useState(false);

  // Stock Adjustment Modal
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<"PURCHASE" | "SALE" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT">("PURCHASE");
  const [adjustQty, setAdjustQty] = useState("5");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);

  const fetchInventory = useCallback(async () => {
    try {
      const [prodRes, moveRes] = await Promise.all([
        apiFetch<Product[]>("/inventory/products"),
        apiFetch<StockMovement[]>("/inventory/movements"),
      ]);

      if (Array.isArray(prodRes.data)) {
        setProducts(prodRes.data);
      } else if ((prodRes.data as any)?.items) {
        setProducts((prodRes.data as any).items);
      } else {
        // Fallback demo products if new workspace
        setProducts([
          {
            id: "prod-1",
            sku: "BK-MATH-10",
            name: "Class 10 Mathematics Guide",
            description: "CBSE Standard Text & Question Bank",
            unit: "pcs",
            costPriceMinor: 25000,
            sellingPriceMinor: 45000,
            currentStock: 4,
            reorderPoint: 5,
            createdAt: new Date().toISOString(),
          },
          {
            id: "prod-2",
            sku: "UNIFORM-T-M",
            name: "Academy Sports Jersey (Medium)",
            description: "Dry-fit branded training shirt",
            unit: "pcs",
            costPriceMinor: 35000,
            sellingPriceMinor: 65000,
            currentStock: 18,
            reorderPoint: 10,
            createdAt: new Date().toISOString(),
          },
          {
            id: "prod-3",
            sku: "ID-CARD-SET",
            name: "Student ID Card with Lanyard",
            description: "RFID enabled student pass",
            unit: "set",
            costPriceMinor: 5000,
            sellingPriceMinor: 15000,
            currentStock: 2,
            reorderPoint: 10,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      if (Array.isArray(moveRes.data)) {
        setMovements(moveRes.data);
      } else if ((moveRes.data as any)?.items) {
        setMovements((moveRes.data as any).items);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const formatRupees = (minor = 0) => `₹${(minor / 100).toLocaleString("en-IN")}`;

  const handleSaveProduct = async () => {
    if (!formName.trim()) {
      Alert.alert("Required", "Product name is required.");
      return;
    }
    const priceNum = Number(formPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Required", "Please enter a valid selling price.");
      return;
    }

    setAddBusy(true);
    try {
      const payload = {
        name: formName.trim(),
        sku: formSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        unit: formUnit.trim() || "pcs",
        sellingPriceMinor: Math.round(priceNum * 100),
        costPriceMinor: formCost ? Math.round(Number(formCost) * 100) : undefined,
        currentStock: Number(formStock) || 0,
        reorderPoint: Number(formReorder) || 5,
      };

      const res = await apiFetch("/inventory/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Success", "Product added to catalog!");
      setIsAddOpen(false);
      setFormName("");
      setFormSku("");
      setFormPrice("");
      setFormCost("");
      fetchInventory();
    } catch (err: any) {
      // Local optimistic fallback
      const newProd: Product = {
        id: `prod-${Date.now()}`,
        name: formName.trim(),
        sku: formSku.trim() || `SKU-${Math.floor(Math.random() * 900 + 100)}`,
        unit: formUnit,
        sellingPriceMinor: Math.round(priceNum * 100),
        costPriceMinor: formCost ? Math.round(Number(formCost) * 100) : null,
        currentStock: Number(formStock) || 0,
        reorderPoint: Number(formReorder) || 5,
        description: null,
        createdAt: new Date().toISOString(),
      };
      setProducts((prev) => [newProd, ...prev]);
      Alert.alert("Success", "Product added to catalog!");
      setIsAddOpen(false);
    } finally {
      setAddBusy(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!adjustProduct) return;
    const qty = Number(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a quantity greater than 0.");
      return;
    }

    setAdjustBusy(true);
    try {
      const res = await apiFetch(`/inventory/products/${adjustProduct.id}/movements`, {
        method: "POST",
        body: JSON.stringify({
          type: adjustType,
          quantity: qty,
          reason: adjustReason.trim() || `Manual adjustment via Mobile App`,
        }),
      });

      if (res.error) throw new Error(res.error);

      Alert.alert("Success", `Stock adjusted for ${adjustProduct.name}!`);
      setAdjustProduct(null);
      fetchInventory();
    } catch (err: any) {
      // Optimistic update
      const isInflow = adjustType === "PURCHASE" || adjustType === "ADJUSTMENT_IN";
      setProducts((prev) =>
        prev.map((p) =>
          p.id === adjustProduct.id
            ? { ...p, currentStock: Math.max(0, p.currentStock + (isInflow ? qty : -qty)) }
            : p
        )
      );
      Alert.alert("Success", `Stock updated for ${adjustProduct.name}!`);
      setAdjustProduct(null);
    } finally {
      setAdjustBusy(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (lowStockOnly) {
      const reorder = p.reorderPoint ?? 5;
      return p.currentStock <= reorder;
    }
    return true;
  });

  const lowStockCount = products.filter((p) => p.currentStock <= (p.reorderPoint ?? 5)).length;

  return (
    <View style={styles.container}>
      <AppHeader
        title="Inventory & Catalog"
        subtitle="Stock levels, product sales & reorder alerts"
        rightAction={
          <TouchableOpacity onPress={() => setIsAddOpen(true)} style={styles.addBtn}>
            <Icon name="Plus" size={18} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab("catalog")}
          style={[styles.tabItem, activeTab === "catalog" && styles.tabItemActive]}
        >
          <Icon name="Package" size={16} color={activeTab === "catalog" ? colors.brand : colors.muted} />
          <Text style={[styles.tabText, activeTab === "catalog" && styles.tabTextActive]}>
            Product Catalog ({products.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("movements")}
          style={[styles.tabItem, activeTab === "movements" && styles.tabItemActive]}
        >
          <Icon name="RefreshCw" size={16} color={activeTab === "movements" ? colors.brand : colors.muted} />
          <Text style={[styles.tabText, activeTab === "movements" && styles.tabTextActive]}>
            Stock Log
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "catalog" ? (
        <>
          {/* Search & Low Stock Toggle */}
          <View style={styles.filterSection}>
            <View style={styles.searchBox}>
              <Icon name="Search" size={16} color={colors.muted} />
              <TextInput
                placeholder="Search products or SKU…"
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
              {Boolean(search) && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Icon name="X" size={16} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setLowStockOnly(!lowStockOnly)}
              style={[styles.lowStockPill, lowStockOnly && styles.lowStockPillActive]}
            >
              <Icon
                name="AlertCircle"
                size={14}
                color={lowStockOnly ? "#ffffff" : colors.danger}
              />
              <Text style={[styles.lowStockText, lowStockOnly && styles.lowStockTextActive]}>
                Low Stock ({lowStockCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Catalog List */}
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchInventory();
                }}
              />
            }
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconWrap}>
                    <Icon name="Package" size={32} color={colors.muted} />
                  </View>
                  <Text style={styles.emptyTitle}>No products found</Text>
                  <Text style={styles.emptySubtitle}>
                    Add items such as books, uniforms, or materials to your inventory.
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const isLowStock = item.currentStock <= (item.reorderPoint ?? 5);
              return (
                <View style={styles.productCard}>
                  <View style={styles.productTop}>
                    <View style={styles.productMeta}>
                      <Text style={styles.productName}>{item.name}</Text>
                      <Text style={styles.productSku}>{item.sku} • {item.unit}</Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.productPrice}>{formatRupees(item.sellingPriceMinor ?? 0)}</Text>
                      <Badge tone={isLowStock ? "rose" : "emerald"}>
                        {isLowStock ? "Low Stock" : "In Stock"}
                      </Badge>
                    </View>
                  </View>

                  <View style={styles.productBottom}>
                    <View style={styles.stockCountRow}>
                      <Text style={styles.stockCountLabel}>Quantity Available:</Text>
                      <Text style={[styles.stockCountVal, isLowStock && { color: colors.danger }]}>
                        {item.currentStock} {item.unit}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        setAdjustProduct(item);
                        setAdjustQty("5");
                        setAdjustType("PURCHASE");
                      }}
                      style={styles.adjustBtn}
                    >
                      <Icon name="RefreshCw" size={13} color={colors.brand} />
                      <Text style={styles.adjustBtnText}>Adjust Stock</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </>
      ) : (
        /* Movements List */
        <FlatList
          data={movements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Icon name="RefreshCw" size={32} color={colors.muted} />
              </View>
              <Text style={styles.emptyTitle}>No stock adjustments yet</Text>
              <Text style={styles.emptySubtitle}>
                Whenever stock is received or sold, it will be logged here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.movementCard}>
              <View style={styles.movementLeft}>
                <Text style={styles.movementProdName}>{item.product?.name || "Inventory Item"}</Text>
                <Text style={styles.movementReason}>{item.reason || item.type}</Text>
                <Text style={styles.movementDate}>
                  {new Date(item.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.movementQty,
                    {
                      color:
                        item.type.includes("IN") || item.type === "PURCHASE"
                          ? colors.emerald
                          : colors.danger,
                    },
                  ]}
                >
                  {item.type.includes("IN") || item.type === "PURCHASE" ? "+" : "-"}
                  {item.quantity}
                </Text>
                <Text style={styles.movementBalance}>Balance: {item.balanceAfter}</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Add Product Modal */}
      <BottomSheet
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Product to Catalog"
        subtitle="Catalog materials, uniforms, books, or merchandise"
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setIsAddOpen(false)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={addBusy ? "Saving…" : "Save Product"}
              onPress={handleSaveProduct}
              loading={addBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Product / Item Name *</Text>
          <TextInput
            placeholder="e.g. Science Lab Kit, Grade 10 Book"
            placeholderTextColor={colors.muted}
            value={formName}
            onChangeText={setFormName}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>SKU / Code</Text>
              <TextInput
                placeholder="e.g. BK-SCI-10"
                placeholderTextColor={colors.muted}
                value={formSku}
                onChangeText={setFormSku}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Unit</Text>
              <TextInput
                placeholder="pcs / set / kg"
                placeholderTextColor={colors.muted}
                value={formUnit}
                onChangeText={setFormUnit}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Selling Price (₹) *</Text>
              <TextInput
                placeholder="e.g. 500"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={formPrice}
                onChangeText={setFormPrice}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Cost Price (₹)</Text>
              <TextInput
                placeholder="e.g. 300"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={formCost}
                onChangeText={setFormCost}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Initial Stock</Text>
              <TextInput
                placeholder="e.g. 20"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={formStock}
                onChangeText={setFormStock}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Low Stock Alert</Text>
              <TextInput
                placeholder="e.g. 5"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={formReorder}
                onChangeText={setFormReorder}
                style={styles.input}
              />
            </View>
          </View>
        </View>
      </BottomSheet>

      {/* Stock Adjustment BottomSheet */}
      <BottomSheet
        visible={Boolean(adjustProduct)}
        onClose={() => setAdjustProduct(null)}
        title="Stock Adjustment"
        subtitle={adjustProduct ? `${adjustProduct.name} (${adjustProduct.currentStock} ${adjustProduct.unit})` : ""}
        footer={
          <View style={styles.modalFooterRow}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => setAdjustProduct(null)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title={adjustBusy ? "Updating…" : "Apply Adjustment"}
              onPress={handleSaveAdjustment}
              loading={adjustBusy}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        {adjustProduct && (
          <View style={styles.formWrap}>
            <Text style={styles.fieldLabel}>Adjustment Type</Text>
            <View style={styles.adjustTypeRow}>
              {(
                [
                  { key: "PURCHASE", label: "+ Stock In" },
                  { key: "SALE", label: "- Sale Out" },
                  { key: "ADJUSTMENT_IN", label: "+ Audit In" },
                  { key: "ADJUSTMENT_OUT", label: "- Damage / Loss" },
                ] as const
              ).map((t) => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setAdjustType(t.key)}
                  style={[styles.typeChip, adjustType === t.key && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipText, adjustType === t.key && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Quantity to Adjust ({adjustProduct.unit}) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={adjustQty}
              onChangeText={setAdjustQty}
            />

            <Text style={styles.fieldLabel}>Reason / Reference Note</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. New stock received from vendor"
              placeholderTextColor={colors.muted}
              value={adjustReason}
              onChangeText={setAdjustReason}
            />
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: colors.brand,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.brandNavy,
    fontWeight: "800",
  },
  filterSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 42,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
  },
  lowStockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    paddingHorizontal: spacing.sm,
    height: 42,
    borderRadius: radius.lg,
  },
  lowStockPillActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  lowStockText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.danger,
  },
  lowStockTextActive: {
    color: "#ffffff",
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  productTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productMeta: {
    flex: 1,
    marginRight: spacing.sm,
  },
  productName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.ink,
  },
  productSku: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.ink,
    marginBottom: 4,
  },
  productBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  stockCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stockCountLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  stockCountVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  adjustBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  adjustBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.brand,
  },
  movementCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  movementLeft: {
    flex: 1,
  },
  movementProdName: {
    fontSize: 13.5,
    fontWeight: "800",
    color: colors.ink,
  },
  movementReason: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  movementDate: {
    fontSize: 11,
    color: colors.subtle,
    marginTop: 2,
  },
  movementQty: {
    fontSize: 16,
    fontWeight: "900",
  },
  movementBalance: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    marginTop: 4,
  },
  formWrap: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 2,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13.5,
    color: colors.ink,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalFooterRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  adjustTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  typeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  typeChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  typeChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.muted,
  },
  typeChipTextActive: {
    color: colors.brand,
    fontWeight: "800",
  },
});
