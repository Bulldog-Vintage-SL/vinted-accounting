"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Package,
  CheckCircle,
  Clock,
  Truck,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Link,
  Unlink
} from "lucide-react";
import apiClient from "@/libs/api";
import { SaleItemThumbnail } from "./components/SaleItemThumbnail";
import { SaleMobileCard } from "./components/SaleMobileCard";

interface Sale {
  _id: string;
  transactionId: string;
  itemName: string;
  amount: number;
  purchasePrice?: number;
  status: "pending" | "completed" | "cancelled";
  shippingCarrier: string;
  trackingNumber?: string;
  shippingDeadline?: string;
  saleDate: string;
  completedDate?: string;
  hasLabel: boolean;
  labelMessageId?: string;
  itemImageUrl?: string;
  isManual?: boolean;
  bundleId?: string;
}

interface Bundle {
  _id: string;
  name: string;
  provider: string;
  quantity: number;
  roiMultiplier: number;
}

interface SalesData {
  sales: Sale[];
  total: number;
  stats: {
    pending: { count: number; totalAmount: number };
    completed: { count: number; totalAmount: number };
    total: { count: number; totalAmount: number };
  };
}

interface NewSaleForm {
  itemName: string;
  purchasePrice: string;
  salePrice: string;
  saleDate: string;
  bundleId: string;
}

const carrierNames: Record<string, string> = {
  correos: "Correos",
  inpost: "InPost",
  seur: "SEUR",
  vintedgo: "Vinted Go",
  unknown: "Manual",
};

const carrierColors: Record<string, string> = {
  correos: "bg-yellow-100 text-yellow-800",
  inpost: "bg-orange-100 text-orange-800",
  seur: "bg-blue-100 text-blue-800",
  vintedgo: "bg-teal-100 text-teal-800",
  unknown: "bg-gray-100 text-gray-800",
};

const ITEMS_PER_PAGE = 10;

export default function SalesPage() {
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [downloadingLabel, setDownloadingLabel] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);

  // Add sale modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingSale, setAddingSale] = useState(false);
  const [newSaleForm, setNewSaleForm] = useState<NewSaleForm>({
    itemName: "",
    purchasePrice: "",
    salePrice: "",
    saleDate: new Date().toISOString().split("T")[0],
    bundleId: "",
  });

  // Bundles for linking
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [linkingBundle, setLinkingBundle] = useState<string | null>(null);

  // Edit sale modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingSale, setSavingSale] = useState(false);

  // Delete confirmation
  const [deletingSale, setDeletingSale] = useState<string | null>(null);

  // Pagination for completed sales
  const [completedPage, setCompletedPage] = useState(1);

  // Edit sale modal
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editSaleForm, setEditSaleForm] = useState({
    itemName: "",
    purchasePrice: "",
    salePrice: "",
    saleDate: "",
    status: "completed" as "pending" | "completed" | "cancelled",
    bundleId: "",
  });
  const [updatingSale, setUpdatingSale] = useState(false);

  useEffect(() => {
    fetchSalesData();
    fetchBundles();
  }, []);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get("/sales?status=all");
      setSalesData(response as unknown as SalesData);
      setCompletedPage(1);
    } catch (err: any) {
      console.error("Error fetching sales:", err);
      setError(err?.response?.data?.error || err?.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  const fetchBundles = async () => {
    try {
      const response = await apiClient.get("/bundles");
      const data = response as unknown as { bundles: Bundle[] };
      setBundles(data.bundles || []);
    } catch (err: any) {
      console.error("Error fetching bundles:", err);
    }
  };

  const linkSaleToBundle = async (saleId: string, bundleId: string | null) => {
    try {
      setLinkingBundle(saleId);
      const res = await apiClient.post("/sales/link-bundle", {
        saleId,
        bundleId: bundleId || null,
      });

      const updatedSale = (res as any).sale;

      // Update local state optimistically with the returned sale
      if (updatedSale) {
        setSalesData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            sales: prev.sales.map(s =>
              s._id === saleId ? { ...s, ...updatedSale, _id: s._id } : s
            )
          };
        });
      }

      await fetchBundles();
    } catch (err: any) {
      console.error("Error linking sale to bundle:", err);
      alert(err?.response?.data?.error || "Error al vincular la venta");
    } finally {
      setLinkingBundle(null);
    }
  };

  const handleAddSale = async () => {
    if (!newSaleForm.itemName.trim()) {
      alert("El nombre del artículo es requerido");
      return;
    }

    try {
      setAddingSale(true);
      const response = await apiClient.post("/sales/manual", {
        itemName: newSaleForm.itemName,
        purchasePrice: parseFloat(newSaleForm.purchasePrice) || 0,
        salePrice: parseFloat(newSaleForm.salePrice) || 0,
        saleDate: newSaleForm.saleDate,
      }) as unknown as { sale: { _id: string } };

      // If bundle selected, link the sale to it
      if (newSaleForm.bundleId && response.sale?._id) {
        await apiClient.post("/sales/link-bundle", {
          saleId: response.sale._id,
          bundleId: newSaleForm.bundleId,
        });
      }

      setNewSaleForm({
        itemName: "",
        purchasePrice: "",
        salePrice: "",
        saleDate: new Date().toISOString().split("T")[0],
        bundleId: "",
      });
      setShowAddModal(false);

      await fetchSalesData();
      await fetchBundles();
    } catch (err: any) {
      console.error("Error adding sale:", err);
      alert(err?.response?.data?.error || "Error al añadir la venta");
    } finally {
      setAddingSale(false);
    }
  };

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setEditSaleForm({
      itemName: sale.itemName,
      purchasePrice: sale.purchasePrice?.toString() || "",
      salePrice: sale.amount?.toString() || "",
      saleDate: sale.saleDate.split("T")[0],
      status: sale.status,
      bundleId: sale.bundleId || "",
    });
    setShowEditModal(true);
  };

  const updateSale = async () => {
    if (!editingSale) return;

    try {
      setUpdatingSale(true);
      setError(null);

      const payload = editingSale.isManual
        ? {
          itemName: editSaleForm.itemName,
          purchasePrice: parseFloat(editSaleForm.purchasePrice) || 0,
          salePrice: parseFloat(editSaleForm.salePrice) || 0,
          saleDate: editSaleForm.saleDate,
          status: editSaleForm.status,
        }
        : {
          purchasePrice: parseFloat(editSaleForm.purchasePrice) || 0,
        };

      await apiClient.put(`/sales/${editingSale._id}`, payload);
      await fetchSalesData();
      setEditingSale(null);
      setShowEditModal(false);
    } catch (err: any) {
      console.error("Error updating sale:", err);
      setError(err?.response?.data?.error || err?.message || "Error al actualizar la venta");
    } finally {
      setUpdatingSale(false);
    }
  };

  const deleteSale = async (saleId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta venta?")) {
      return;
    }

    try {
      setDeletingSale(saleId);
      setError(null);
      await apiClient.delete(`/sales/${saleId}`);
      await fetchSalesData();
    } catch (err: any) {
      console.error("Error deleting sale:", err);
      setError(err?.response?.data?.error || err?.message || "Error al eliminar la venta");
    } finally {
      setDeletingSale(null);
    }
  };

  const downloadLabel = async (saleId: string) => {
    try {
      setDownloadingLabel(saleId);
      const downloadUrl = `/api/sales/label?saleId=${saleId}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `etiqueta-${saleId}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Error downloading label:", err);
      alert("Error al descargar la etiqueta");
    } finally {
      setDownloadingLabel(null);
    }
  };

  const downloadSelectedLabels = async () => {
    if (selectedPending.size === 0) return;

    try {
      setDownloadingLabel("multiple");
      const saleIdsArray = Array.from(selectedPending);
      const response = await fetch("/api/sales/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleIds: saleIdsArray }),
      });

      if (!response.ok) {
        const error = await response.json();

        // Check if it's a token expiration error
        if (error.code === "TOKEN_EXPIRED" || response.status === 401) {
          alert("Tu sesión de Gmail ha expirado. Por favor, cierra sesión y vuelve a iniciar sesión para reconectar tu cuenta.");
          return;
        }

        throw new Error(error.error || "Error al descargar las etiquetas");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `etiquetas-combinadas-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Error downloading labels:", err);
      alert(err?.message || "Error al descargar las etiquetas");
    } finally {
      setDownloadingLabel(null);
    }
  };

  const toggleSelectAll = (sales: Sale[]) => {
    const salesWithLabels = sales.filter(s => s.hasLabel);
    if (selectedPending.size === salesWithLabels.length) {
      setSelectedPending(new Set());
    } else {
      setSelectedPending(new Set(salesWithLabels.map(s => s._id)));
    }
  };

  const toggleSelect = (saleId: string) => {
    const newSelected = new Set(selectedPending);
    if (newSelected.has(saleId)) {
      newSelected.delete(saleId);
    } else {
      newSelected.add(saleId);
    }
    setSelectedPending(newSelected);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return <span className="text-red-600 font-medium">Vencido</span>;
    if (diffDays === 0) return <span className="text-amber-600 font-medium">Hoy</span>;
    if (diffDays === 1) return <span className="text-amber-600 font-medium">Mañana</span>;
    if (diffDays <= 3) return <span className="text-amber-600">{diffDays} días</span>;
    return <span className="text-gray-600">{formatDate(dateString)}</span>;
  };

  const nowVal = new Date();
  const pendingSales = (salesData?.sales || [])
    .filter(s => {
      if (s.status !== "pending") return false;
      if (s.shippingDeadline) {
        const deadline = new Date(s.shippingDeadline);
        // Mostrar si el plazo no ha vencido todavía
        return nowVal <= deadline;
      }
      // Fallback para ventas sin fecha límite detectada: solo mostrar si son de los últimos 7 días
      const saleDate = new Date(s.saleDate);
      const sevenDaysAgo = new Date(nowVal.getTime() - 7 * 24 * 60 * 60 * 1000);
      return saleDate >= sevenDaysAgo;
    })
    .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

  const completedSales = (salesData?.sales || []).filter(s => s.status === "completed" && (s.amount > 0 || s.isManual));

  const totalCompletedPages = Math.ceil(completedSales.length / ITEMS_PER_PAGE);
  const paginatedCompletedSales = completedSales
    .sort((a, b) => new Date(b.completedDate || b.saleDate).getTime() - new Date(a.completedDate || a.saleDate).getTime())
    .slice((completedPage - 1) * ITEMS_PER_PAGE, completedPage * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Ventas</h1>
            <p className="text-gray-500">Gestiona tus ventas pendientes y completadas.</p>
            {salesData && (
              <p className="text-sm text-gray-400 mt-1">Total: {salesData.total} ventas</p>
            )}
          </div>
        </div>

        {loading && !salesData ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="loading loading-spinner loading-lg mb-4"></span>
            <p className="text-gray-500">Cargando ventas...</p>
          </div>
        ) : error ? (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
            <button className="btn btn-sm" onClick={fetchSalesData}>Reintentar</button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Ventas Pendientes Section */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div
                className="flex items-center justify-between p-4 border-b border-gray-100 cursor-pointer"
                onClick={() => setShowPending(!showPending)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Ventas Pendientes de Envío</h2>
                    <p className="text-sm text-gray-500">{pendingSales.length} ventas esperando envío</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {selectedPending.size > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadSelectedLabels(); }}
                      disabled={downloadingLabel === "multiple"}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {downloadingLabel === "multiple" ? "Combinando..." : `Descargar ${selectedPending.size} Etiquetas`}
                    </button>
                  )}
                  {showPending ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </div>

              {showPending && (
                <div className="overflow-hidden">
                  {pendingSales.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay ventas pendientes dentro del plazo</p>
                    </div>
                  ) : (
                    <>
                      <div className="md:hidden p-3 space-y-3">
                        {pendingSales.map((sale) => (
                          <SaleMobileCard
                            key={sale._id}
                            sale={sale}
                            variant="pending"
                            carrierNames={carrierNames}
                            carrierColors={carrierColors}
                            formatCurrency={formatCurrency}
                            formatDate={formatDate}
                            formatDeadline={formatDeadline}
                            selected={selectedPending.has(sale._id)}
                            onToggleSelect={() => toggleSelect(sale._id)}
                            onDownloadLabel={() => downloadLabel(sale._id)}
                            downloadingLabel={downloadingLabel === sale._id}
                          />
                        ))}
                      </div>

                      <table className="hidden md:table w-full table-fixed">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="w-10 text-left py-3 px-3 text-sm font-medium text-gray-500">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={selectedPending.size === pendingSales.filter(s => s.hasLabel).length && pendingSales.filter(s => s.hasLabel).length > 0}
                                onChange={() => toggleSelectAll(pendingSales)}
                              />
                            </th>
                            <th className="hidden lg:table-cell w-28 text-left py-3 px-3 text-sm font-medium text-gray-500">Fecha</th>
                            <th className="w-14 text-left py-3 px-2 text-sm font-medium text-gray-500">Foto</th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Artículo</th>
                            <th className="w-24 text-left py-3 px-2 text-sm font-medium text-gray-500">Envío</th>
                            <th className="hidden xl:table-cell w-28 text-left py-3 px-3 text-sm font-medium text-gray-500">Límite</th>
                            <th className="hidden lg:table-cell w-28 text-left py-3 px-3 text-sm font-medium text-gray-500">Etiqueta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingSales.map((sale) => (
                            <tr key={sale._id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-3 px-3">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  disabled={!sale.hasLabel}
                                  checked={selectedPending.has(sale._id)}
                                  onChange={() => toggleSelect(sale._id)}
                                />
                              </td>
                              <td className="hidden lg:table-cell py-3 px-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(sale.saleDate)}</td>
                              <td className="py-3 px-2">
                                <SaleItemThumbnail itemName={sale.itemName} itemImageUrl={sale.itemImageUrl} size="sm" />
                              </td>
                              <td className="py-3 px-2 min-w-0">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{sale.itemName}</p>
                                  <p className="text-xs text-gray-400 truncate">#{sale.transactionId}</p>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${carrierColors[sale.shippingCarrier] || carrierColors.unknown}`}>
                                  <Truck className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{carrierNames[sale.shippingCarrier] || sale.shippingCarrier}</span>
                                </span>
                              </td>
                              <td className="hidden xl:table-cell py-3 px-3 text-sm">{sale.shippingDeadline ? formatDeadline(sale.shippingDeadline) : "-"}</td>
                              <td className="hidden lg:table-cell py-3 px-3">
                                {sale.hasLabel ? (
                                  <button
                                    onClick={() => downloadLabel(sale._id)}
                                    disabled={downloadingLabel === sale._id}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 disabled:opacity-50"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    PDF
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Ventas Completadas Section */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div
                className="flex items-center justify-between p-4 border-b border-gray-100 cursor-pointer"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Ventas Completadas</h2>
                    <p className="text-sm text-gray-500">
                      {completedSales.length} ventas finalizadas • {formatCurrency(completedSales.reduce((sum, s) => sum + (s.amount || 0), 0))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAddModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir Venta
                  </button>
                  {showCompleted ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </div>

              {showCompleted && (
                <div className="overflow-hidden">
                  {completedSales.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay ventas completadas</p>
                    </div>
                  ) : (
                    <>
                      <div className="md:hidden p-3 space-y-3">
                        {paginatedCompletedSales.map((sale) => (
                          <SaleMobileCard
                            key={sale._id}
                            sale={sale}
                            variant="completed"
                            carrierNames={carrierNames}
                            carrierColors={carrierColors}
                            formatCurrency={formatCurrency}
                            formatDate={formatDate}
                            bundles={bundles}
                            linkingBundle={linkingBundle === sale._id}
                            onLinkBundle={(bundleId) => linkSaleToBundle(sale._id, bundleId)}
                            onEdit={() => openEditModal(sale)}
                            onDelete={() => deleteSale(sale._id)}
                            deleting={deletingSale === sale._id}
                          />
                        ))}
                      </div>

                      <table className="hidden md:table w-full table-fixed">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="hidden lg:table-cell w-28 text-left py-3 px-3 text-sm font-medium text-gray-500">Fecha</th>
                            <th className="w-14 text-left py-3 px-2 text-sm font-medium text-gray-500">Foto</th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Artículo</th>
                            <th className="hidden xl:table-cell w-20 text-right py-3 px-3 text-sm font-medium text-gray-500">Coste</th>
                            <th className="w-20 text-right py-3 px-2 text-sm font-medium text-gray-500">Precio</th>
                            <th className="hidden lg:table-cell w-20 text-right py-3 px-3 text-sm font-medium text-gray-500">Ganancia</th>
                            <th className="hidden xl:table-cell w-16 text-right py-3 px-3 text-sm font-medium text-gray-500">ROI</th>
                            <th className="hidden 2xl:table-cell w-32 text-left py-3 px-3 text-sm font-medium text-gray-500">Lote</th>
                            <th className="w-20 text-center py-3 px-2 text-sm font-medium text-gray-500">Acc.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedCompletedSales.map((sale) => {
                            const profit = (sale.amount || 0) - (sale.purchasePrice || 0);
                            const hasCost = sale.purchasePrice && sale.purchasePrice > 0;
                            return (
                              <tr key={sale._id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="hidden lg:table-cell py-3 px-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(sale.completedDate || sale.saleDate)}</td>
                                <td className="py-3 px-2">
                                  <SaleItemThumbnail itemName={sale.itemName} itemImageUrl={sale.itemImageUrl} size="sm" />
                                </td>
                                <td className="py-3 px-2 min-w-0">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{sale.itemName}</p>
                                    <p className="text-xs text-gray-400 truncate">#{sale.transactionId}</p>
                                  </div>
                                </td>
                                <td className="hidden xl:table-cell py-3 px-3 text-sm text-gray-500 text-right whitespace-nowrap">{hasCost ? formatCurrency(sale.purchasePrice!) : "-"}</td>
                                <td className="py-3 px-2 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">{formatCurrency(sale.amount || 0)}</td>
                                <td className={`hidden lg:table-cell py-3 px-3 text-sm font-semibold text-right whitespace-nowrap ${!hasCost ? 'text-gray-400' : profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {hasCost ? formatCurrency(profit) : "-"}
                                </td>
                                <td className="hidden xl:table-cell py-3 px-3 text-sm text-right text-indigo-600 font-medium whitespace-nowrap">
                                  {hasCost ? `${((sale.amount || 0) / sale.purchasePrice!).toFixed(2)}x` : "-"}
                                </td>
                                <td className="hidden 2xl:table-cell py-3 px-3">
                                  <select
                                    value={sale.bundleId || ""}
                                    onChange={(e) => linkSaleToBundle(sale._id, e.target.value || null)}
                                    disabled={linkingBundle === sale._id}
                                    className={`w-full max-w-[120px] text-xs border rounded-lg px-2 py-1 focus:outline-none truncate ${sale.bundleId ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200"}`}
                                  >
                                    <option value="">Sin vincular</option>
                                    {bundles
                                      .filter(bundle => bundle.quantity > 0 || bundle._id === sale.bundleId)
                                      .map((bundle) => (
                                        <option key={bundle._id} value={bundle._id}>
                                          {bundle.name} ({bundle.quantity})
                                        </option>
                                      ))}
                                  </select>
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <button onClick={() => openEditModal(sale)} className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => deleteSale(sale._id)} disabled={deletingSale === sale._id} className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {totalCompletedPages > 1 && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-gray-100">
                          <p className="text-sm text-gray-500">
                            Mostrando {(completedPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(completedPage * ITEMS_PER_PAGE, completedSales.length)} de {completedSales.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCompletedPage(p => Math.max(1, p - 1))} disabled={completedPage === 1} className="btn btn-sm btn-ghost"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="text-sm whitespace-nowrap">Página {completedPage} de {totalCompletedPages}</span>
                            <button onClick={() => setCompletedPage(p => Math.min(totalCompletedPages, p + 1))} disabled={completedPage === totalCompletedPages} className="btn btn-sm btn-ghost"><ChevronRight className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Añadir Nueva Venta</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={newSaleForm.itemName} onChange={e => setNewSaleForm({ ...newSaleForm, itemName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coste (€)</label>
                  <input type="number" step="0.01" value={newSaleForm.purchasePrice} onChange={e => setNewSaleForm({ ...newSaleForm, purchasePrice: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venta (€)</label>
                  <input type="number" step="0.01" value={newSaleForm.salePrice} onChange={e => setNewSaleForm({ ...newSaleForm, salePrice: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input type="date" value={newSaleForm.saleDate} onChange={e => setNewSaleForm({ ...newSaleForm, saleDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bundle</label>
                <select value={newSaleForm.bundleId} onChange={e => setNewSaleForm({ ...newSaleForm, bundleId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Sin vincular</option>
                  {bundles.filter(b => b.quantity > 0).map(b => (
                    <option key={b._id} value={b._id}>{b.name} ({b.quantity})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleAddSale} disabled={addingSale || !newSaleForm.itemName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg disabled:opacity-50">{addingSale ? "Añadiendo..." : "Añadir Venta"}</button>
            </div>
          </div>
        </div>
      )}

      {editingSale && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Editar Venta</h2>
              <button onClick={() => setEditingSale(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {!editingSale.isManual && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">⚠️ Solo se puede modificar el coste.</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={editSaleForm.itemName} onChange={e => setEditSaleForm({ ...editSaleForm, itemName: e.target.value })} disabled={!editingSale.isManual} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coste (€)</label>
                <input type="number" step="0.01" value={editSaleForm.purchasePrice} onChange={e => setEditSaleForm({ ...editSaleForm, purchasePrice: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venta (€)</label>
                <input type="number" step="0.01" value={editSaleForm.salePrice} onChange={e => setEditSaleForm({ ...editSaleForm, salePrice: e.target.value })} disabled={!editingSale.isManual} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input type="date" value={editSaleForm.saleDate} onChange={e => setEditSaleForm({ ...editSaleForm, saleDate: e.target.value })} disabled={!editingSale.isManual} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select value={editSaleForm.status} onChange={e => setEditSaleForm({ ...editSaleForm, status: e.target.value as any })} disabled={!editingSale.isManual} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-100">
                  <option value="pending">Pendiente</option>
                  <option value="completed">Completada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bundle</label>
                <select
                  value={editSaleForm.bundleId}
                  onChange={e => setEditSaleForm({ ...editSaleForm, bundleId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Sin vincular</option>
                  {bundles
                    .filter(b => b.quantity > 0 || b._id === editingSale.bundleId)
                    .map(b => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.quantity})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button onClick={() => setEditingSale(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg">Cancelar</button>
              <button onClick={updateSale} disabled={updatingSale} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg disabled:opacity-50">{updatingSale ? "Actualizando..." : "Actualizar Venta"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
