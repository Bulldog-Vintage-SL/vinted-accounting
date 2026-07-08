"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Package,
  Edit,
  Trash2,
  X,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import apiClient from "@/libs/api";

interface Bundle {
  _id: string;
  name: string;
  provider: string;
  price: number;
  quantity: number;
  initialQuantity: number;
  returnRate: number;
  salesLinked: number;
  roiMultiplier?: number;
  soldCount?: number;
  costPerItem?: number;
  createdAt: string;
}

interface BundleStats {
  totalBundles: number;
  totalStockValue: number;
  totalItems: number;
  totalInitialItems: number;
  totalReturnRate: number;
  overallROI: number;
}

interface BundleForm {
  name: string;
  provider: string;
  price: string;
  quantity: string;
}

export default function PurchasesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [stats, setStats] = useState<BundleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<BundleForm>({
    name: "",
    provider: "",
    price: "",
    quantity: "",
  });

  // Expanded bundle for details
  const [expandedBundle, setExpandedBundle] = useState<string | null>(null);

  useEffect(() => {
    fetchBundles();
  }, []);

  const fetchBundles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get("/bundles");
      const data = response as unknown as { bundles: Bundle[]; stats: BundleStats };
      setBundles(data.bundles || []);
      setStats(data.stats || null);
    } catch (err: any) {
      console.error("Error fetching bundles:", err);
      setError(err?.response?.data?.error || err?.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      provider: "",
      price: "",
      quantity: "",
    });
  };

  const handleAddBundle = async () => {
    if (!form.name.trim() || !form.provider.trim()) {
      alert("Nombre y proveedor son requeridos");
      return;
    }

    try {
      setSaving(true);
      await apiClient.post("/bundles", {
        name: form.name,
        provider: form.provider,
        price: parseFloat(form.price) || 0,
        quantity: parseInt(form.quantity) || 1,
      });

      resetForm();
      setShowAddModal(false);
      await fetchBundles();
    } catch (err: any) {
      console.error("Error adding bundle:", err);
      alert(err?.response?.data?.error || "Error al añadir el bundle");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (bundle: Bundle) => {
    setEditingBundle(bundle);
    setForm({
      name: bundle.name,
      provider: bundle.provider,
      price: bundle.price.toString(),
      quantity: bundle.quantity.toString(),
    });
    setShowEditModal(true);
  };

  const handleEditBundle = async () => {
    if (!editingBundle) return;

    try {
      setSaving(true);
      await apiClient.put(`/bundles/${editingBundle._id}`, {
        name: form.name,
        provider: form.provider,
        price: parseFloat(form.price) || 0,
        quantity: parseInt(form.quantity) || 0,
      });

      resetForm();
      setShowEditModal(false);
      setEditingBundle(null);
      await fetchBundles();
    } catch (err: any) {
      console.error("Error editing bundle:", err);
      alert(err?.response?.data?.error || "Error al editar el bundle");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este bundle? Las ventas vinculadas serán desvinculadas.")) {
      return;
    }

    try {
      setDeleting(bundleId);
      await apiClient.delete(`/bundles/${bundleId}`);
      await fetchBundles();
    } catch (err: any) {
      console.error("Error deleting bundle:", err);
      alert(err?.response?.data?.error || "Error al eliminar el bundle");
    } finally {
      setDeleting(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getROIColor = (roi: number) => {
    if (roi >= 2) return "text-emerald-600 bg-emerald-50";
    if (roi >= 1) return "text-blue-600 bg-blue-50";
    if (roi > 0) return "text-amber-600 bg-amber-50";
    return "text-gray-600 bg-gray-50";
  };

  return (
    <div className="min-h-screen p-6 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
              Compras
            </h1>
            <p className="text-gray-500">
              Gestiona tus lotes de compra y visualiza el ROI.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Añadir Bundle
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Inversión Total</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(stats.totalStockValue)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Prendas Restantes</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stats.totalItems} / {stats.totalInitialItems}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Retorno Total</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatCurrency(stats.totalReturnRate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getROIColor(stats.overallROI)}`}>
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ROI Global</p>
                  <p className={`text-xl font-bold ${stats.overallROI >= 1 ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {stats.overallROI.toFixed(2)}x
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="loading loading-spinner loading-lg mb-4"></span>
            <p className="text-gray-500">Cargando bundles...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-red-700">{error}</span>
            <button
              className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
              onClick={fetchBundles}
            >
              Reintentar
            </button>
          </div>
        ) : bundles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay bundles en el inventario
            </h3>
            <p className="text-gray-500 mb-4">
              Añade tu primer bundle para comenzar a rastrear tu ROI.
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Añadir Bundle
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left p-2 md:p-4 text-sm font-medium text-gray-500">
                    Bundle
                  </th>
                  <th className="hidden md:table-cell text-left p-4 text-sm font-medium text-gray-500">
                    Proveedor
                  </th>
                  <th className="hidden lg:table-cell text-right p-4 text-sm font-medium text-gray-500">
                    Inversión
                  </th>
                  <th className="text-right p-2 md:p-4 text-sm font-medium text-gray-500">
                    Prendas
                  </th>
                  <th className="hidden xl:table-cell text-right p-4 text-sm font-medium text-gray-500">
                    €/Prenda
                  </th>
                  <th className="hidden xl:table-cell text-right p-4 text-sm font-medium text-gray-500">
                    Retorno
                  </th>
                  <th className="hidden lg:table-cell text-center p-4 text-sm font-medium text-gray-500">
                    ROI
                  </th>
                  <th className="text-center p-2 md:p-4 text-sm font-medium text-gray-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {bundles.map((bundle) => (
                  <tr
                    key={bundle._id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-2 md:p-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm md:text-base">{bundle.name}</p>
                        <p className="text-xs text-gray-400">
                          {bundle.salesLinked} ventas
                        </p>
                        <p className="text-xs text-gray-500 md:hidden mt-1">{bundle.provider}</p>
                      </div>
                    </td>
                    <td className="hidden md:table-cell p-4 text-gray-600">{bundle.provider}</td>
                    <td className="hidden lg:table-cell p-4 text-right font-medium text-gray-900">
                      {formatCurrency(bundle.price)}
                    </td>
                    <td className="p-2 md:p-4 text-right">
                      <span className="text-gray-900 font-medium">{bundle.quantity}</span>
                      <span className="text-gray-400 text-sm"> / {bundle.initialQuantity}</span>
                    </td>
                    <td className="hidden xl:table-cell p-4 text-right text-gray-600">
                      {formatCurrency(bundle.costPerItem ?? (bundle.initialQuantity > 0 ? bundle.price / bundle.initialQuantity : 0))}
                    </td>
                    <td className="hidden xl:table-cell p-4 text-right font-medium text-emerald-600">
                      {formatCurrency(bundle.returnRate)}
                    </td>
                    <td className="hidden lg:table-cell p-4 text-center">
                      {(() => {
                        const roi = bundle.roiMultiplier ?? (bundle.price > 0 ? bundle.returnRate / bundle.price : 0);
                        return (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${getROIColor(roi)}`}
                          >
                            {roi.toFixed(2)}x
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-2 md:p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(bundle)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBundle(bundle._id)}
                          disabled={deleting === bundle._id}
                          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Bundle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Añadir Nuevo Bundle
                </h3>
                <p className="text-sm text-gray-500">
                  Registra un nuevo lote de compra.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Bundle <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Lote Nike Vintage"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  placeholder="Ej: TiendaVintage.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio Total (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad de Prendas
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {form.price && form.quantity && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    <strong>Coste por prenda:</strong>{" "}
                    {formatCurrency(
                      parseFloat(form.price) / parseInt(form.quantity) || 0
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddBundle}
                disabled={saving || !form.name.trim() || !form.provider.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-xs"></span>
                    Añadiendo...
                  </span>
                ) : (
                  "Añadir Bundle"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bundle Modal */}
      {showEditModal && editingBundle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Editar Bundle
                </h3>
                <p className="text-sm text-gray-500">
                  Modifica los datos del bundle.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingBundle(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Bundle <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio Total (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad Restante
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-1">
                <p className="text-sm text-gray-600">
                  <strong>Cantidad inicial:</strong> {editingBundle.initialQuantity}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Ventas vinculadas:</strong> {editingBundle.salesLinked}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>ROI actual:</strong> {(editingBundle.roiMultiplier ?? (editingBundle.price > 0 ? editingBundle.returnRate / editingBundle.price : 0)).toFixed(2)}x
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingBundle(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditBundle}
                disabled={saving || !form.name.trim() || !form.provider.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-xs"></span>
                    Guardando...
                  </span>
                ) : (
                  "Guardar Cambios"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
