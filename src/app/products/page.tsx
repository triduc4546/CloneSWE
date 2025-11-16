"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Footer } from "@/components/footer";
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit,
  Package,
  X,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

/* ============================== Types ============================== */

interface Product {
  productId: string; // firestore doc id of "product"
  name: string;
  description: string;
  price: number | string;
  category: string;
  img_link?: string;
  stock?: number; // merged from inventory
}

type ModalType = "view" | "edit" | "add";

/* ============================== Page =============================== */

export default function ProductsPage() {
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<ModalType>("view");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  // 🔍 Lấy search & category từ URL
  const searchParams = useSearchParams();
  const search = searchParams.get("search")?.toLowerCase().trim() || "";
  const category = searchParams.get("category")?.toLowerCase().trim() || "";


  /* ---------------------- Inventory helpers ----------------------- */

  const fetchInventoryMap = async () => {
    const snap = await getDocs(collection(db, "inventory"));
    const map: Record<string, number> = {};
    snap.forEach((d) => {
      const data = d.data() as any;
      // inventory docs contain: productId, stockQuantity
      if (data?.productId != null) {
        map[String(data.productId)] = Number(data.stockQuantity ?? 0);
      }
    });
    return map;
  };

  // Find inventory docId by productId (if any)
  const findInventoryDocId = async (productId: string) => {
    const qSnap = await getDocs(
      query(collection(db, "inventory"), where("productId", "==", productId))
    );
    if (!qSnap.empty) return qSnap.docs[0].id;
    return null;
  };

  // Upsert stock for a productId to inventory collection
  const upsertInventoryStock = async (productId: string, stockQuantity: number) => {
    const existingId = await findInventoryDocId(productId);
    if (existingId) {
      await updateDoc(doc(db, "inventory", existingId), {
        productId,
        stockQuantity,
        updatedAt: new Date(),
      });
      return existingId;
    }
    const newRef = await addDoc(collection(db, "inventory"), {
      productId,
      stockQuantity,
      updatedAt: new Date(),
    });
    return newRef.id;
  };

  // Optional: delete inventory doc when deleting product (best-effort)
  const deleteInventoryByProductId = async (productId: string) => {
    const invId = await findInventoryDocId(productId);
    if (invId) {
      await deleteDoc(doc(db, "inventory", invId));
    }
  };
  

  /* -------------------------- Fetch all --------------------------- */

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setErr(null);

      const [inventoryMap, productSnap] = await Promise.all([
        fetchInventoryMap(),
        getDocs(collection(db, "product")),
      ]);

      const list: Product[] = productSnap.docs.map((d) => {
        const data = d.data() as Omit<Product, "productId">;
        const id = d.id;
        return {
          productId: id,
          name: data?.name ?? "",
          description: data?.description ?? "",
          price: Number(data?.price ?? 0),
          category: data?.category ?? "Uncategorized",
          img_link: data?.img_link ?? "",
          stock: inventoryMap[id] ?? 0,
        };
      });

      setProducts(list);
    } catch (e) {
      console.error(e);
      setErr("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- Stock status -------------------------- */

  const getStockStatus = (stock = 0) => {
    if (stock === 0) return "OUT OF STOCK";
    if (stock <= 30) return "LOW STOCK";
    return "IN STOCK";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "IN STOCK":
        return "bg-green-500 text-white";
      case "LOW STOCK":
        return "bg-yellow-500 text-white";
      case "OUT OF STOCK":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  /* ---------------------- Search / Filter / Sort ------------------- */

  const categories = useMemo(
    () => ["All Categories", ...Array.from(new Set(products.map((p) => p.category || "Uncategorized")))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = (search || searchTerm).trim().toLowerCase(); // ưu tiên search từ URL
    const catFilter = category
      ? category
      : categoryFilter.toLowerCase();

    return products.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const cat = (p.category ?? "").toLowerCase();
      const status = getStockStatus(p.stock);

      const matchesSearch =
        !term || name.includes(term) || cat.includes(term);

      const matchesCategory =
        catFilter === "all categories" || cat === catFilter;

      const matchesStatus =
        statusFilter === "All Status" || status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchTerm, search, category, categoryFilter, statusFilter]);



  /* --------------------------- Pagination -------------------------- */

  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const generatePageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisible - 1);
      if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const PaginationComponent = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex flex-col items-center mt-12 space-y-4">
        <div className="text-base text-gray-700 font-medium">
          Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} products
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`flex items-center px-5 py-3 text-base font-medium rounded-lg transition-all duration-200 ${
              currentPage === 1
                ? "text-gray-400 cursor-not-allowed bg-gray-100"
                : "text-gray-700 hover:bg-gray-100 hover:text-yellow-500 bg-white border border-gray-300 hover:border-yellow-300"
            }`}
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Previous
          </button>
          <div className="flex space-x-2">
            {generatePageNumbers().map((p) => (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`px-4 py-3 text-base font-medium rounded-lg transition-all duration-200 min-w-[48px] ${
                  currentPage === p
                    ? "bg-yellow-500 text-white shadow-lg transform scale-105 border-2 border-yellow-500"
                    : "text-gray-700 hover:bg-yellow-50 hover:text-yellow-500 bg-white border border-gray-300 hover:border-yellow-300 hover:shadow-md"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`flex items-center px-5 py-3 text-base font-medium rounded-lg transition-all duration-200 ${
              currentPage === totalPages
                ? "text-gray-400 cursor-not-allowed bg-gray-100"
                : "text-gray-700 hover:bg-gray-100 hover:text-yellow-500 bg-white border border-gray-300 hover:border-yellow-300"
            }`}
          >
            Next
            <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    );
  };

  /* --------------------------- Cart / CRUD ------------------------- */

  const addToCart = async (productId: string) => {
    if (!user?.customerId || user?.role !== "customer") {
      alert("Please sign in as customer to add to cart.");
      return;
    }
    try {
      await setDoc(
        doc(db, "cart", `${user.customerId}_${productId}`),
        {
          customerId: user.customerId,
          productId,
          quantity: 1,
        },
        { merge: true }
      );
      alert("Added to cart!");
    } catch (e) {
      console.error(e);
      alert("Failed to add to cart.");
    }
  };

  const deleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, "product", productId));
      // best-effort: also delete inventory mapping
      await deleteInventoryByProductId(productId);
      alert("Product deleted");
      fetchProducts();
    } catch (e) {
      console.error(e);
      alert("Failed to delete product.");
    }
  };

  /* ---------------------------- Modals ops ------------------------- */

  const handleView = (p: Product) => {
    setSelectedProduct(p);
    setModalType("view");
    setShowModal(true);
  };

  const handleEdit = (p: Product) => {
    setSelectedProduct(p);
    setModalType("edit");
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedProduct(null);
    setModalType("add");
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedProduct(null);
    setShowModal(false);
  };

  const submitProduct = async (data: Partial<Product> & { stock?: number }) => {
    try {
      if (modalType === "add") {
        // Create new product doc with auto-id
        const ref = await addDoc(collection(db, "product"), {
          name: data.name || "",
          description: data.description || "",
          price: Number(data.price ?? 0),
          category: data.category || "Uncategorized",
          img_link: data.img_link || "",
        });
        const newId = ref.id;

        // upsert inventory with provided stock (default 0)
        await upsertInventoryStock(newId, Number(data.stock ?? 0));

        // reflect on UI
        setProducts((prev) => [
          ...prev,
          {
            productId: newId,
            name: data.name || "",
            description: data.description || "",
            price: Number(data.price ?? 0),
            category: data.category || "Uncategorized",
            img_link: data.img_link || "",
            stock: Number(data.stock ?? 0),
          },
        ]);
        alert("Product added!");
      } else if (modalType === "edit" && selectedProduct) {
        // Update product doc
        await updateDoc(doc(db, "product", selectedProduct.productId), {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.price !== undefined ? { price: Number(data.price) } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.img_link !== undefined ? { img_link: data.img_link } : {}),
        });

        // Update stock in inventory if provided
        if (data.stock !== undefined) {
          await upsertInventoryStock(selectedProduct.productId, Number(data.stock));
        }

        // Reflect UI
        setProducts((prev) =>
          prev.map((p) =>
            p.productId === selectedProduct.productId
              ? {
                  ...p,
                  ...data,
                  price: data.price !== undefined ? Number(data.price) : p.price,
                  stock: data.stock !== undefined ? Number(data.stock) : p.stock,
                }
              : p
          )
        );
        alert("Product updated!");
      }
      closeModal();
    } catch (e) {
      console.error(e);
      alert("Failed to save product.");
    }
  };

  /* ------------------------------- UI -------------------------------- */

  if (loading) {
    return (
      <main className="p-6 bg-gray-50 min-h-screen">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
          <span className="ml-3 text-gray-700">Loading products...</span>
        </div>
      </main>
    );
  }

  if (err) {
    return (
      <main className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-700 font-medium">Error loading products</div>
          <div className="text-red-600 text-sm mt-1">{err}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const EveryoneHeader = () => (
    <div className="flex justify-between items-start mb-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
        <p className="text-gray-700">Browse all items in the catalog</p>
      </div>
      {user?.role === "staff" && (
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      )}
    </div>
  );

  const Filters = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
      <div className="flex gap-4 flex-wrap items-center">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none bg-white min-w-40 text-gray-900"
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
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none bg-white min-w-32 text-gray-900"
          >
            <option value="All Status">All Status</option>
            <option value="IN STOCK">In Stock</option>
            <option value="LOW STOCK">Low Stock</option>
            <option value="OUT OF STOCK">Out of Stock</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 p-6 bg-gray-50">
        <EveryoneHeader />
        <Filters />

        {/* Products grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {currentProducts.map((p) => {
            const status = getStockStatus(p.stock);
            const isOut = status === "OUT OF STOCK";
            return (
              <div
                key={p.productId}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all flex flex-col"
              >
                {/* Image */}
                <div className="relative h-48 w-full bg-gray-100 rounded-t-xl overflow-hidden">
                  {p.img_link ? (
                    <img
                      src={p.img_link}
                      alt={p.name}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="flex justify-center items-center h-full">
                      <Package className="w-16 h-16 text-gray-400" />
                    </div>
                  )}

                  {/* Stock Badge */}
                  <span
                    className={`absolute top-2 right-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      getStockStatus(p.stock)
                    )}`}
                  >
                    {getStockStatus(p.stock)}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-semibold text-gray-900 line-clamp-2 min-h-[48px]">
                    {p.name}
                  </h3>

                  <p className="text-sm text-yellow-500 font-medium mb-2">
                    {p.category}
                  </p>

                  <p className="text-gray-600 text-sm mb-3 line-clamp-2 min-h-[36px]">
                    {p.description}
                  </p>

                  <div className="text-2xl font-bold text-gray-900 mb-3">
                    {Number(p.price).toLocaleString()}₫
                  </div>

                  <div className="mt-auto flex gap-2">
                    {/* View */}
                    <button
                      onClick={() => handleView(p)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>

                    {/* Customer → add cart */}
                    {user?.role === "customer" && (
                      <button
                        onClick={() => addToCart(p.productId)}
                        disabled={getStockStatus(p.stock) === "OUT OF STOCK"}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                          getStockStatus(p.stock) === "OUT OF STOCK"
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-yellow-500 text-white hover:bg-yellow-500"
                        }`}
                      >
                        {getStockStatus(p.stock) === "OUT OF STOCK"
                          ? "Out"
                          : "Add to Cart"}
                      </button>
                    )}

                    {/* Staff → edit + delete */}
                    {user?.role === "staff" && (
                      <>
                        <button
                          onClick={() => handleEdit(p)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-500 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete product "${p.name}"?`)) {
                              deleteProduct(p.productId);
                            }
                          }}
                          className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                          title="Delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <PaginationComponent />

        {/* Empty state */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No products found
            </h3>
            <p className="text-gray-600">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}

        {/* Modals */}
        {showModal && modalType === "view" && selectedProduct && (
          <ProductViewModal product={selectedProduct} onClose={closeModal} />
        )}

        {showModal && modalType === "edit" && selectedProduct && user?.role === "staff" && (
          <ProductFormModal
            product={selectedProduct}
            onClose={closeModal}
            onSubmit={submitProduct}
            title="Edit Product"
          />
        )}

        {showModal && modalType === "add" && user?.role === "staff" && (
          <ProductFormModal
            onClose={closeModal}
            onSubmit={submitProduct}
            title="Add New Product"
          />
        )}
      </main>
      <Footer />
    </div>
  );
}

/* ============================ Modals ============================ */

function ProductViewModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const getStockStatus = (stock: number = 0) => {
    if (stock === 0) return "OUT OF STOCK";
    if (stock <= 30) return "LOW STOCK";
    return "IN STOCK";
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "IN STOCK":
        return "bg-green-500 text-white";
      case "LOW STOCK":
        return "bg-yellow-500 text-white";
      case "OUT OF STOCK":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };
  const status = getStockStatus(product.stock);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Product Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-yellow-50 rounded-lg p-0 flex items-center justify-center overflow-hidden min-h-56">
              {product.img_link ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.img_link} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-16 h-16 text-yellow-500" />
              )}
            </div>

            <div>
              <div className="mb-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                  {status}
                </span>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h3>
              <p className="text-yellow-500 font-medium mb-4">{product.category}</p>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Price</label>
                  <p className="text-2xl font-bold text-green-600">
                    {Number(product.price).toLocaleString()}₫
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Stock Level</label>
                  <p className="text-lg font-semibold text-gray-900">{product.stock || 0} units</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Product ID</label>
                  <p className="text-gray-900 font-mono">{product.productId}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-gray-600">Description</label>
            <p className="text-gray-800 mt-2 leading-relaxed">{product.description}</p>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductFormModal({
  product,
  onClose,
  onSubmit,
  title,
}: {
  product?: Product;
  onClose: () => void;
  onSubmit: (data: Partial<Product> & { stock?: number }) => void;
  title: string;
}) {
  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    price: typeof product?.price === "number" || typeof product?.price === "string" ? String(product?.price) : "",
    category: product?.category || "",
    img_link: product?.img_link || "",
    stock: product?.stock ?? 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.price === "") return;
    const payload: Partial<Product> & { stock?: number } = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(String(formData.price)),
      category: formData.category,
      img_link: formData.img_link,
      stock: Number(formData.stock ?? 0),
    };
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Category
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Price (₫) *
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Image URL
            </label>
            <input
              type="url"
              value={formData.img_link}
              onChange={(e) => setFormData({ ...formData, img_link: e.target.value })}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900"
            />
          </div>

          {/* Stock Edit: A (edit ngay trong modal) */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Stock Quantity
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={formData.stock}
              onChange={(e) =>
                setFormData({ ...formData, stock: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors"
            >
              {product ? "Update Product" : "Add Product"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}