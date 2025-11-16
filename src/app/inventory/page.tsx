"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  memo,
  FormEvent,
} from "react";
import {
  Search,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit,
  Package,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Footer } from "@/components/footer";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------- Types ---------- */

interface Inventory {
  inventoryId: string;
  productId: string;
  quantity: number;
  threshold?: number;
  category?: string;
  name?: string;
  cost?: number;
  lastRestocked?: string;
}

interface ExportConfig {
  reportType: "summary" | "detailed" | "lowstock" | "outofstock";
  format: "csv" | "xlsx";
  category: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  stockThreshold: number;
  includeMetadata: boolean;
}

/* ---------- Helpers ---------- */

const getStatus = (quantity: number, threshold: number = 30): string => {
  if (quantity === 0) return "OUT OF STOCK";
  if (quantity <= threshold) return "LOW STOCK";
  return "IN STOCK";
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "IN STOCK":
      return "bg-green-100 text-green-800";
    case "LOW STOCK":
      return "bg-yellow-100 text-yellow-800";
    case "OUT OF STOCK":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getTrendIcon = (quantity: number, threshold: number = 30) => {
  if (quantity === 0)
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  if (quantity <= threshold)
    return <TrendingDown className="w-4 h-4 text-yellow-500" />;
  return <TrendingUp className="w-4 h-4 text-green-500" />;
};

/* --- export helpers --- */

const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const generateCSVFile = (
  metadata: (string | number)[][],
  headers: string[],
  data: (string | number)[][],
  filename: string
) => {
  const metadataCSV = metadata
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");
  const headersCSV = headers.map((header) => `"${header}"`).join(",");
  const dataCSV = data
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const csvContent = metadataCSV + "\n" + headersCSV + "\n" + dataCSV;
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  downloadFile(blob, filename);
};

const generateExcelFile = async (
  metadata: (string | number)[][],
  headers: string[],
  data: (string | number)[][],
  filename: string
) => {
  let htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            .metadata { font-weight: bold; color: #0066CC; }
            .header { font-weight: bold; background-color: #E0E0E0; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <table>
    `;

  metadata.forEach((row) => {
    htmlContent += "<tr>";
    row.forEach((cell) => {
      const cellValue = cell ? escapeHtml(cell.toString()) : "";
      htmlContent += `<td class="metadata">${cellValue}</td>`;
    });
    htmlContent += "</tr>";
  });

  htmlContent += '<tr><td colspan="10">&nbsp;</td></tr>';

  htmlContent += "<tr>";
  headers.forEach((header) => {
    htmlContent += `<th class="header">${escapeHtml(header)}</th>`;
  });
  htmlContent += "</tr>";

  data.forEach((row) => {
    htmlContent += "<tr>";
    row.forEach((cell) => {
      const cellValue = cell?.toString() || "";
      htmlContent += `<td>${escapeHtml(cellValue)}</td>`;
    });
    htmlContent += "</tr>";
  });

  htmlContent += `
          </table>
        </body>
      </html>
    `;

  const blob = new Blob([htmlContent], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  downloadFile(blob, filename.replace(".xlsx", ".xls"));
};

/* ---------- Small components ---------- */

const StatsCard = memo(
  ({
    title,
    value,
    icon,
    subtitle,
    colorClass,
  }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    subtitle: string;
    colorClass: string;
  }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-600 text-sm font-medium">
          {title}
        </span>
        <div
          className={`w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center`}
        >
          {icon}
        </div>
      </div>
      <div
        className={`text-2xl font-bold ${
          title.includes("Low Stock")
            ? "text-yellow-500"
            : title.includes("Out of Stock")
            ? "text-red-600"
            : title.includes("Total Value")
            ? "text-green-600"
            : "text-zinc-900"
        }`}
      >
        {title.includes("Total Value")
          ? `${value.toLocaleString("vi-VN")}`
          : value}
      </div>
      <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>
    </div>
  )
);
StatsCard.displayName = "StatsCard";

const InventoryRow = memo(
  ({
    item,
    onRestock,
    onEdit,
  }: {
    item: Inventory;
    onRestock: (item: Inventory) => void;
    onEdit: (item: Inventory) => void;
  }) => {
    const status = useMemo(
      () => getStatus(item.quantity, item.threshold),
      [item.quantity, item.threshold]
    );
    const statusColor = useMemo(() => getStatusColor(status), [status]);
    const trendIcon = useMemo(
      () => getTrendIcon(item.quantity, item.threshold),
      [item.quantity, item.threshold]
    );

    return (
      <tr className="hover:bg-zinc-50 transition-colors">
        {/* Product */}
        <td className="px-6 py-4 align-middle">
          <div className="font-medium text-zinc-900 text-sm leading-relaxed">
            {item.name}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            ID: {item.productId}
          </div>
        </td>

        {/* Category */}
        <td className="px-6 py-4 align-middle">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-100 whitespace-nowrap">
            {item.category}
          </span>
        </td>

        {/* Quantity */}
        <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
          <div className="flex items-center justify-center space-x-2">
            <span className="font-bold text-zinc-900 text-base">
              {item.quantity}
            </span>
            {status === "LOW STOCK" && (
              <span className="text-yellow-500 text-lg">⚠️</span>
            )}
            {status === "OUT OF STOCK" && (
              <span className="text-red-500 text-lg">⚠️</span>
            )}
          </div>
        </td>

        {/* Threshold */}
        <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
          <span className="text-zinc-700 text-sm font-medium">
            {item.threshold || 30}
          </span>
        </td>

        {/* Status */}
        <td className="px-6 py-4 text-center align-middle">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap ${statusColor}`}
          >
            {status}
          </span>
        </td>

        {/* Trend */}
        <td className="px-6 py-4 text-center align-middle">
          <div className="flex justify-center">{trendIcon}</div>
        </td>

        {/* Last updated */}
        <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
          <span className="text-zinc-700 text-sm">
            {item.lastRestocked}
          </span>
        </td>

        {/* Cost */}
        <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
          <span className="font-bold text-zinc-900 text-sm">
            {(item.cost || 0).toLocaleString("vi-VN")}₫
          </span>
        </td>

        {/* Actions */}
        <td className="px-6 py-4 align-middle">
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => onRestock(item)}
              className="px-3 py-2 text-xs bg-zinc-100 text-zinc-800 rounded-md hover:bg-zinc-200 transition-colors font-medium whitespace-nowrap"
            >
              Restock
            </button>
            <button
              onClick={() => onEdit(item)}
              className="px-3 py-2 text-xs bg-yellow-400 text-black rounded-md hover:bg-yellow-300 transition-colors flex items-center gap-1 font-medium whitespace-nowrap"
            >
              <Edit className="w-3 h-3" />
              Edit
            </button>
          </div>
        </td>
      </tr>
    );
  }
);
InventoryRow.displayName = "InventoryRow";

/* ---------- Main page ---------- */

export default function InventoryPage() {
  const { user } = useAuth();

  const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<Inventory | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"restock" | "edit">("restock");

  const [showExportModal, setShowExportModal] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  /* ----- Fetch from Firebase (inventory + product) ----- */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const inventoryRef = collection(db, "inventory");
      const productRef = collection(db, "product");

      const [inventorySnap, productSnap] = await Promise.all([
        getDocs(inventoryRef),
        getDocs(productRef),
      ]);

      const products = productSnap.docs.map((p) => ({
        id: p.id,
        ...(p.data() as any),
      }));

      const inventoryData: Inventory[] = inventorySnap.docs.map((invDoc) => {
        const inv = invDoc.data() as any;
        const productId = String(inv.productId ?? invDoc.id);

        const product = products.find(
          (p) =>
            String(p.id) === productId || String((p as any).productId) === productId
        );

        const updatedAt = inv.updatedAt ?? inv.lastRestocked;

        const dateStr = updatedAt
          ? new Date(
              updatedAt.seconds
                ? updatedAt.seconds * 1000
                : typeof updatedAt === "number"
                ? updatedAt
                : updatedAt
            )
              .toISOString()
              .split("T")[0]
          : new Date().toISOString().split("T")[0];

        return {
          inventoryId: inv.inventoryId ?? invDoc.id,
          productId,
          quantity: Number(inv.stockQuantity ?? inv.quantity ?? 0),
          threshold: Number(inv.threshold ?? 30),
          name: inv.name ?? product?.name ?? `Product ${productId}`,
          category: inv.category ?? product?.category ?? "Unknown",
          cost: Number(inv.cost ?? inv.price ?? product?.price ?? 0),
          lastRestocked: dateStr,
        };
      });

      setInventoryList(inventoryData);
    } catch (err: any) {
      console.error("Error fetching inventory from Firestore:", err);
      setError(err?.message ?? "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ----- Derived values & filters ----- */
  const {
    filteredInventory,
    totalProducts,
    lowStockItems,
    outOfStockItems,
    totalValue,
    categories,
    currentItems,
    totalPages,
  } = useMemo(() => {
    const filtered = inventoryList.filter((item) => {
      const matchesSearch =
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productId?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === "All Categories" || item.category === categoryFilter;

      const status = getStatus(item.quantity, item.threshold);
      const matchesStatus =
        statusFilter === "All Status" || status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    const total = inventoryList.length;
    const lowStock = inventoryList.filter(
      (item) => item.quantity > 0 && item.quantity <= (item.threshold || 30)
    ).length;
    const outOfStock = inventoryList.filter((item) => item.quantity === 0).length;
    const value = inventoryList.reduce(
      (sum, item) => sum + item.quantity * (item.cost || 0),
      0
    );

    const cats = [
      "All Categories",
      ...Array.from(
        new Set(inventoryList.map((item) => item.category).filter(Boolean))
      ),
    ] as string[];

    const pages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const slice = filtered.slice(startIndex, endIndex);

    return {
      filteredInventory: filtered,
      totalProducts: total,
      lowStockItems: lowStock,
      outOfStockItems: outOfStock,
      totalValue: value,
      categories: cats,
      totalPages: pages,
      currentItems: slice,
    };
  }, [
    inventoryList,
    searchTerm,
    categoryFilter,
    statusFilter,
    currentPage,
    itemsPerPage,
  ]);

  /* ----- Handlers ----- */

  const handleExport = useCallback(() => {
    if (user?.role !== "staff") {
      alert("Access Denied: Only staff can export inventory data.");
      return;
    }
    setShowExportModal(true);
  }, [user?.role]);

  const handleSyncInventory = useCallback(async () => {
    await fetchData();
    alert("Inventory synced successfully!");
  }, [fetchData]);

  const handleRestock = useCallback((item: Inventory) => {
    setSelectedItem(item);
    setModalType("restock");
    setShowModal(true);
  }, []);

  const handleEdit = useCallback((item: Inventory) => {
    setSelectedItem(item);
    setModalType("edit");
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedItem(null);
  }, []);

  const handleRestockSubmit = useCallback(
    async (newQuantity: number) => {
      if (!selectedItem) return;

      try {
        const newTotal = selectedItem.quantity + newQuantity;

        await updateDoc(doc(db, "inventory", selectedItem.inventoryId), {
          stockQuantity: newTotal,
          updatedAt: new Date(),
        });

        setInventoryList((prev) =>
          prev.map((i) =>
            i.inventoryId === selectedItem.inventoryId
              ? {
                  ...i,
                  quantity: newTotal,
                  lastRestocked: new Date().toISOString().split("T")[0],
                }
              : i
          )
        );

        alert(`Successfully restocked ${newQuantity} units of ${selectedItem.name}`);
        closeModal();
      } catch (err: any) {
        console.error("Error restocking item:", err);
        alert(`Failed to restock item: ${err?.message ?? "Unknown error"}`);
      }
    },
    [selectedItem, closeModal]
  );

  const handleEditSubmit = useCallback(
    async (updatedItem: Inventory) => {
      if (!selectedItem) return;

      try {
        await updateDoc(doc(db, "inventory", selectedItem.inventoryId), {
          stockQuantity: updatedItem.quantity,
          threshold: updatedItem.threshold,
          cost: updatedItem.cost,
          updatedAt: new Date(),
        });

        setInventoryList((prev) =>
          prev.map((i) =>
            i.inventoryId === updatedItem.inventoryId ? updatedItem : i
          )
        );

        alert("Item updated successfully!");
        closeModal();
      } catch (err: any) {
        console.error("Error updating item:", err);
        alert(`Failed to update item: ${err?.message ?? "Unknown error"}`);
      }
    },
    [selectedItem, closeModal]
  );

  const processExport = useCallback(
    async (exportConfig: ExportConfig) => {
      try {
        setLoading(true);

        let dataToExport = inventoryList;

        if (exportConfig.category !== "All Categories") {
          dataToExport = dataToExport.filter(
            (item) => item.category === exportConfig.category
          );
        }

        if (exportConfig.status !== "All Status") {
          dataToExport = dataToExport.filter((item) => {
            const s = getStatus(item.quantity, item.threshold);
            return s === exportConfig.status;
          });
        }

        if (exportConfig.stockThreshold > 0) {
          dataToExport = dataToExport.filter(
            (item) => item.quantity <= exportConfig.stockThreshold
          );
        }

        if (dataToExport.length === 0) {
          alert(
            "No data matches your export criteria. Please adjust your filters."
          );
          setLoading(false);
          return;
        }

        let headers: string[] = [];
        let reportData: (string | number)[][] = [];

        switch (exportConfig.reportType) {
          case "summary":
            headers = [
              "Product Name",
              "Category",
              "Current Stock",
              "Status",
              "Total Value (₫)",
            ];
            reportData = dataToExport.map((item) => [
              item.name || "Unknown",
              item.category || "Unknown",
              item.quantity,
              getStatus(item.quantity, item.threshold),
              item.quantity * (item.cost || 0),
            ]);
            break;
          case "detailed":
            headers = [
              "Product ID",
              "Product Name",
              "Category",
              "Current Stock",
              "Threshold",
              "Status",
              "Last Updated",
              "Unit Cost (₫)",
              "Total Value (₫)",
            ];
            reportData = dataToExport.map((item) => [
              item.productId,
              item.name || "Unknown",
              item.category || "Unknown",
              item.quantity,
              item.threshold || 30,
              getStatus(item.quantity, item.threshold),
              item.lastRestocked || "Unknown",
              item.cost || 0,
              item.quantity * (item.cost || 0),
            ]);
            break;
          case "lowstock":
            headers = [
              "Product Name",
              "Category",
              "Current Stock",
              "Threshold",
              "Shortage",
              "Reorder Priority",
            ];
            const lowStock = dataToExport.filter(
              (i) => i.quantity <= (i.threshold || 30) && i.quantity > 0
            );
            reportData = lowStock.map((item) => [
              item.name || "Unknown",
              item.category || "Unknown",
              item.quantity,
              item.threshold || 30,
              (item.threshold || 30) - item.quantity,
              item.quantity <= 5
                ? "High"
                : item.quantity <= 15
                ? "Medium"
                : "Low",
            ]);
            break;
          case "outofstock":
            headers = [
              "Product Name",
              "Category",
              "Days Out of Stock",
              "Last Updated",
              "Priority",
            ];
            const outOfStock = dataToExport.filter((i) => i.quantity === 0);
            reportData = outOfStock.map((item) => {
              const daysOut = item.lastRestocked
                ? Math.floor(
                    (Date.now() - new Date(item.lastRestocked).getTime()) /
                      (1000 * 3600 * 24)
                  )
                : "Unknown";
              return [
                item.name || "Unknown",
                item.category || "Unknown",
                daysOut,
                item.lastRestocked || "Unknown",
                daysOut === "Unknown" || (daysOut as number) > 7
                  ? "Critical"
                  : "High",
              ];
            });
            break;
        }

        const metadata = [
          ["Trung Nguyên Inventory Report"],
          [`Generated on: ${new Date().toLocaleString()}`],
          [`Generated by: ${user?.name || user?.username || "Staff"}`],
          [`Report Type: ${exportConfig.reportType}`],
          [`Category Filter: ${exportConfig.category}`],
          [`Status Filter: ${exportConfig.status}`],
          [`Date Range: ${exportConfig.dateFrom} to ${exportConfig.dateTo}`],
          [`Total Items: ${dataToExport.length}`],
          [`Export Format: ${exportConfig.format.toUpperCase()}`],
          [`Timestamp: ${new Date().toISOString()}`],
          [""],
        ];

        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `TN-Inventory-${exportConfig.reportType}-${timestamp}`;

        if (exportConfig.format === "xlsx") {
          try {
            await generateExcelFile(metadata, headers, reportData, `${filename}.xlsx`);
          } catch (err) {
            console.error("Excel generation failed:", err);
            alert("Excel export failed. Falling back to CSV format.");
            generateCSVFile(metadata, headers, reportData, `${filename}.csv`);
          }
        } else {
          generateCSVFile(metadata, headers, reportData, `${filename}.csv`);
        }

        alert(
          `✅ Export Successful!\n\nReport: ${exportConfig.reportType.toUpperCase()}\nItems: ${
            dataToExport.length
          }\nFormat: ${exportConfig.format.toUpperCase()}`
        );
      } catch (err: any) {
        console.error("Export failed:", err);
        alert("❌ Export failed. Please try again.\n\nError: " + err.message);
      } finally {
        setLoading(false);
        setShowExportModal(false);
      }
    },
    [inventoryList, user]
  );

  // reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter]);

  /* ----- auth guards ----- */

  if (user === undefined) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
        <span className="ml-3 text-zinc-700">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <div className="flex flex-1 justify-center items-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-zinc-900 mb-4">
              Access Denied
            </h2>
            <p className="text-zinc-600 mb-4">
              Please sign in to access the inventory management system.
            </p>
            <Link
              href="/login"
              className="text-yellow-600 hover:text-yellow-700 underline"
            >
              Go to Login
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (user.role !== "staff") {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <div className="flex flex-1 justify-center items-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-zinc-900 mb-4">
              Access Denied
            </h2>
            <p className="text-zinc-600 mb-4">
              Only staff can access the inventory management system.
            </p>
            <Link
              href="/"
              className="text-yellow-600 hover:text-yellow-700 underline"
            >
              Return to Home
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  /* ----- render ----- */

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <main className="p-6 flex-1 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-zinc-900">
              Inventory Management
            </h1>
            <p className="text-zinc-600 text-sm">
              Monitor stock levels for Trung Nguyên products
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-6 py-3 border border-zinc-300 rounded-lg hover:bg-zinc-100 transition-colors text-sm font-medium text-zinc-800 bg-white"
            >
              <Download className="w-4 h-4" />
              Export Data
            </button>
            <button
              onClick={handleSyncInventory}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-yellow-400 text-black rounded-lg hover:bg-yellow-300 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Sync
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Products"
            value={totalProducts}
            icon={<div className="w-4 h-4 bg-black rounded-sm" />}
            subtitle="Active inventory items"
            colorClass="bg-zinc-100"
          />
          <StatsCard
            title="Low Stock Alerts"
            value={lowStockItems}
            icon={<TrendingDown className="w-4 h-4 text-yellow-500" />}
            subtitle="Items below threshold"
            colorClass="bg-yellow-50"
          />
          <StatsCard
            title="Out of Stock"
            value={outOfStockItems}
            icon={<Minus className="w-4 h-4 text-red-500" />}
            subtitle="Need restocking"
            colorClass="bg-red-50"
          />
          <StatsCard
            title="Total Value"
            value={totalValue}
            icon={<span className="text-yellow-500 font-bold text-sm">₫</span>}
            subtitle="Current inventory value"
            colorClass="bg-yellow-50"
          />
        </div>

        {/* Search + filters */}
        <div className="bg-white p-6 rounded-lg border border-zinc-200 mb-6 shadow-sm">
          <div className="flex gap-4 flex-wrap items-center">
            <div className="flex-1 min-w-80">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-zinc-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search products, categories, or IDs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-zinc-300 rounded-lg bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
                />
              </div>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 border border-zinc-300 rounded-lg bg-white text-sm text-zinc-900"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-zinc-300 rounded-lg bg-white text-sm text-zinc-900"
            >
              <option value="All Status">All Status</option>
              <option value="IN STOCK">In Stock</option>
              <option value="LOW STOCK">Low Stock</option>
              <option value="OUT OF STOCK">Out of Stock</option>
            </select>

            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-4 py-3 border border-zinc-300 rounded-lg bg-white text-sm text-zinc-900"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>

        {/* Loading / error / table */}
        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
            <span className="ml-4 text-zinc-600 text-lg">
              Loading inventory data...
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-6 mb-6">
            <div className="text-red-700 font-medium text-lg">
              Error loading data
            </div>
            <div className="text-red-600 text-sm mt-2">{error}</div>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="bg-white rounded-lg border border-zinc-200 shadow-sm">
              <div className="px-6 py-5 border-b border-zinc-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-zinc-900">
                    Inventory Items ({filteredInventory.length} total)
                  </h3>
                  <div className="text-sm text-zinc-500 font-medium">
                    Showing{" "}
                    {Math.min(
                      (currentPage - 1) * itemsPerPage + 1,
                      filteredInventory.length
                    )}{" "}
                    -{" "}
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredInventory.length
                    )}{" "}
                    of {filteredInventory.length} items
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-100 border-b border-zinc-200">
                    <tr>
                      <th className="text-left px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider w-2/6">
                        Product
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider w-1/6">
                        Category
                      </th>
                      <th className="text-center px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider w-1/12">
                        Current Stock
                      </th>
                      <th className="text-center px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider w-1/12">
                        Threshold
                      </th>
                      <th className="text-center px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider w-1/10">
                        Status
                      </th>
                      <th className="text-center px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider w-1/12">
                        Trend
                      </th>
                      <th className="text-center px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider w-1/10">
                        Last Updated
                      </th>
                      <th className="text-center px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider w-1/10">
                        Cost
                      </th>
                      <th className="text-center px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider w-1/8">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {currentItems.map((item) => (
                      <InventoryRow
                        key={item.inventoryId}
                        item={item}
                        onRestock={handleRestock}
                        onEdit={handleEdit}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-6 py-5 border-t border-zinc-200 bg-zinc-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-500 font-medium">
                      Page {currentPage} of {totalPages} (
                      {filteredInventory.length} results)
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-xs border border-zinc-300 rounded-md hover:bg-zinc-100 disabled:opacity-50"
                      >
                        First
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-xs border border-zinc-300 rounded-md hover:bg-zinc-100 disabled:opacity-50"
                      >
                        Previous
                      </button>

                      <div className="flex space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNumber;
                          if (totalPages <= 5) {
                            pageNumber = i + 1;
                          } else if (currentPage <= 3) {
                            pageNumber = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNumber = totalPages - 4 + i;
                          } else {
                            pageNumber = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNumber}
                              onClick={() => setCurrentPage(pageNumber)}
                              className={`px-4 py-2 text-xs border rounded-md ${
                                currentPage === pageNumber
                                  ? "bg-yellow-400 text-black border-yellow-400"
                                  : "border-zinc-300 hover:bg-zinc-100"
                              }`}
                            >
                              {pageNumber}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-xs border border-zinc-300 rounded-md hover:bg-zinc-100 disabled:opacity-50"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-xs border border-zinc-300 rounded-md hover:bg-zinc-100 disabled:opacity-50"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {filteredInventory.length === 0 && (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2 text-zinc-800">
                  No inventory items found
                </h3>
                <p className="text-zinc-500 text-sm">
                  Try adjusting your search or filters.
                </p>
              </div>
            )}
          </>
        )}

        {showExportModal && user.role === "staff" && (
          <ExportModal
            onClose={() => setShowExportModal(false)}
            onExport={processExport}
            categories={categories}
            inventoryList={inventoryList}
          />
        )}

        {showModal && selectedItem && modalType === "restock" && (
          <RestockModal
            item={selectedItem}
            onClose={closeModal}
            onSubmit={handleRestockSubmit}
          />
        )}

        {showModal && selectedItem && modalType === "edit" && (
          <EditInventoryModal
            item={selectedItem}
            onClose={closeModal}
            onSubmit={handleEditSubmit}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}

/* ---------- Modals ---------- */

const RestockModal = memo(
  ({
    item,
    onClose,
    onSubmit,
  }: {
    item: Inventory;
    onClose: () => void;
    onSubmit: (quantity: number) => void;
  }) => {
    const [quantity, setQuantity] = useState<number>(0);

    const handleSubmit = useCallback(
      (e: FormEvent) => {
        e.preventDefault();
        if (quantity > 0) onSubmit(quantity);
      },
      [quantity, onSubmit]
    );

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white text-zinc-900 rounded-lg max-w-md w-full shadow-xl border border-zinc-200">
          <div className="flex items-center justify-between p-6 border-b border-zinc-200">
            <h2 className="text-xl font-bold">Restock Item</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-lg"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">
                Product
              </label>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-zinc-500">
                Current Stock: {item.quantity} units
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Quantity to Add
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-sm text-zinc-900"
                placeholder="Enter quantity"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-yellow-400 text-black py-2 px-4 rounded-lg hover:bg-yellow-300 transition-colors text-sm font-medium"
              >
                Restock
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-zinc-300 text-sm rounded-lg hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);
RestockModal.displayName = "RestockModal";

const EditInventoryModal = memo(
  ({
    item,
    onClose,
    onSubmit,
  }: {
    item: Inventory;
    onClose: () => void;
    onSubmit: (item: Inventory) => void;
  }) => {
    const [formData, setFormData] = useState({
      quantity: item.quantity || 0,
      threshold: item.threshold || 30,
      cost: item.cost || 0,
    });

    const handleSubmit = useCallback(
      (e: FormEvent) => {
        e.preventDefault();
        onSubmit({
          ...item,
          quantity: formData.quantity,
          threshold: formData.threshold,
          cost: formData.cost,
        });
      },
      [item, formData, onSubmit]
    );

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white text-zinc-900 rounded-lg max-w-md w-full shadow-xl border border-zinc-200">
          <div className="flex items-center justify-between p-6 border-b border-zinc-200">
            <h2 className="text-xl font-bold">Edit Inventory Item</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-lg"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
            <div>
              <label className="block font-medium mb-1">
                Product
              </label>
              <p className="font-medium">{item.name}</p>
            </div>

            <div>
              <label className="block font-medium mb-1">
                Current Stock
              </label>
              <input
                type="number"
                min={0}
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">
                Threshold
              </label>
              <input
                type="number"
                min={0}
                value={formData.threshold}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    threshold: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">
                Cost (₫)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={formData.cost}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cost: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-yellow-400 text-black py-2 px-4 rounded-lg hover:bg-yellow-300 transition-colors font-medium"
              >
                Update Item
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-zinc-300 text-sm rounded-lg hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);
EditInventoryModal.displayName = "EditInventoryModal";

const ExportModal = memo(
  ({
    onClose,
    onExport,
    categories,
    inventoryList,
  }: {
    onClose: () => void;
    onExport: (config: ExportConfig) => void;
    categories: string[];
    inventoryList: Inventory[];
  }) => {
    const [exportConfig, setExportConfig] = useState<ExportConfig>({
      reportType: "detailed",
      format: "csv",
      category: "All Categories",
      status: "All Status",
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      dateTo: new Date().toISOString().split("T")[0],
      stockThreshold: 0,
      includeMetadata: true,
    });

    const getPreviewCount = () => {
  let filtered = inventoryList;

  // category filter
  if (exportConfig.category !== "All Categories") {
    filtered = filtered.filter(
      (i) => i.category === exportConfig.category
    );
  }

  // status filter
  if (exportConfig.status !== "All Status") {
    filtered = filtered.filter((i) => {
      const s = getStatus(i.quantity, i.threshold);
      return s === exportConfig.status;
    });
  }

  // max stock filter
  if (exportConfig.stockThreshold > 0) {
    filtered = filtered.filter(
      (i) => i.quantity <= exportConfig.stockThreshold
    );
  }

  // report-type specific filters (match export logic)
  switch (exportConfig.reportType) {
    case "lowstock":
      filtered = filtered.filter(
        (i) =>
          i.quantity > 0 &&
          i.quantity <= (i.threshold || 30)
      );
      break;

    case "outofstock":
      filtered = filtered.filter((i) => i.quantity === 0);
      break;

    case "summary":
    case "detailed":
    default:
      // no extra filter
      break;
  }

  return filtered.length;
};


    const handleExport = () => {
      if (!exportConfig.reportType || !exportConfig.format) {
        alert("Please select report type and format.");
        return;
      }
      if (getPreviewCount() === 0) {
        alert(
          "No data matches your export criteria. Please adjust your filters."
        );
        return;
      }
      onExport(exportConfig);
    };

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white text-zinc-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-zinc-200">
          <div className="flex items-center justify-between p-6 border-b border-zinc-200">
            <h2 className="text-2xl font-bold">Export Inventory Report</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-lg"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          <div className="p-6 space-y-6 text-sm">
            {/* Report type */}
            <div>
              <label className="block font-medium mb-3">Report Type</label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    value: "summary",
                    title: "Summary Report",
                    desc: "Basic inventory overview",
                  },
                  {
                    value: "detailed",
                    title: "Detailed Report",
                    desc: "Complete inventory data",
                  },
                  {
                    value: "lowstock",
                    title: "Low Stock Report",
                    desc: "Items below threshold",
                  },
                  {
                    value: "outofstock",
                    title: "Out of Stock Report",
                    desc: "Items needing restocking",
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50"
                  >
                    <input
                      type="radio"
                      name="reportType"
                      value={opt.value}
                      checked={exportConfig.reportType === opt.value}
                      onChange={(e) =>
                        setExportConfig({
                          ...exportConfig,
                          reportType:
                            e.target.value as ExportConfig["reportType"],
                        })
                      }
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">{opt.title}</div>
                      <div className="text-xs text-zinc-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-medium mb-2">
                  Category Filter
                </label>
                <select
                  value={exportConfig.category}
                  onChange={(e) =>
                    setExportConfig({
                      ...exportConfig,
                      category: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
                >
                  {categories.map((c, i) => (
                    <option key={i} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Status Filter
                </label>
                <select
                  value={exportConfig.status}
                  onChange={(e) =>
                    setExportConfig({
                      ...exportConfig,
                      status: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
                >
                  <option value="All Status">All Status</option>
                  <option value="IN STOCK">In Stock</option>
                  <option value="LOW STOCK">Low Stock</option>
                  <option value="OUT OF STOCK">Out of Stock</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Max Stock (≤)
                </label>
                <input
                  type="number"
                  min={0}
                  value={exportConfig.stockThreshold}
                  onChange={(e) =>
                    setExportConfig({
                      ...exportConfig,
                      stockThreshold: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
                />
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="block font-medium mb-2">Format</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={exportConfig.format === "csv"}
                    onChange={(e) =>
                      setExportConfig({
                        ...exportConfig,
                        format: e.target.value as ExportConfig["format"],
                      })
                    }
                    className="mr-2"
                  />
                  CSV
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value="xlsx"
                    checked={exportConfig.format === "xlsx"}
                    onChange={(e) =>
                      setExportConfig({
                        ...exportConfig,
                        format: e.target.value as ExportConfig["format"],
                      })
                    }
                    className="mr-2"
                  />
                  Excel
                </label>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
              <h4 className="font-medium mb-2">Export Preview</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500">Report Type:</span>
                  <span className="ml-2 font-medium">
                    {exportConfig.reportType.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Format:</span>
                  <span className="ml-2 font-medium">
                    {exportConfig.format.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Category:</span>
                  <span className="ml-2 font-medium">
                    {exportConfig.category}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Status:</span>
                  <span className="ml-2 font-medium">{exportConfig.status}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-500">Items to export:</span>
                  <span
                    className={`ml-2 font-medium ${
                      getPreviewCount() === 0
                        ? "text-red-500"
                        : "text-green-600"
                    }`}
                  >
                    {getPreviewCount()}
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleExport}
                disabled={getPreviewCount() === 0}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium ${
                  getPreviewCount() === 0
                    ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                    : "bg-yellow-400 text-black hover:bg-yellow-300"
                }`}
              >
                <Download className="w-4 h-4" />
                Generate & Download
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 border border-zinc-300 rounded-lg hover:bg-zinc-100 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
ExportModal.displayName = "ExportModal";
