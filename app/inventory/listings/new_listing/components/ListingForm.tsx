"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";
import {
  ListingForm,
  PlatformKey,
  PLATFORM_PHOTO_LIMITS,
  PLATFORM_LABELS,
} from '@/app/inventory/listings/types';
import { uploadPhoto } from "@/utils/uploadPhoto";
import { prepareImageForUpload } from "@/utils/client/compressImage";
import BrandSelect from "./BrandSelector";
import CategorySelect from "./CategorySelect";
import { validateListingCreationFields } from "@/libs/listings/validation";
import { SortablePhotoGrid } from "@/app/inventory/listings/components/ListingPhotos";

type ItemFormProps = {
  initialData: ListingForm;
  onSubmit: (data: ListingForm) => void;
};

type Attributes = ListingForm["attributes"];

const GENDER_OPTIONS: { label: string; value: "hombre" | "mujer" | "unisex" }[] = [
  { label: "Hombre", value: "hombre" },
  { label: "Mujer", value: "mujer" },
  { label: "Unisex", value: "unisex" },
];

// --- Contexto manual para la IA (mismo modelo que BulkImportModal) ---
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL", "6XL", "7XL", "8XL", "Talla única"];
const DESPERFECTO_OPTIONS = ["Sin desperfectos", "Mancha", "Agujero", "Descosido"] as const;
type Desperfecto = typeof DESPERFECTO_OPTIONS[number];
type GarmentType = "arriba" | "abajo";

interface MedidasArriba {
  axilaAxila: string;
  hombroHombro: string;
  largo: string;
  manga: string;
}
interface MedidasAbajo {
  anchoCintura: string;
  largo: string;
  caderaEntrepierna: string;
  anchoTobillo: string;
}
interface ManualDetails {
  talla: string;
  garmentType: GarmentType | null;
  medidasArriba: MedidasArriba;
  medidasAbajo: MedidasAbajo;
  desperfectos: Desperfecto[];
  sku: string;
  costeInicial: string;
}
const emptyManualDetails = (): ManualDetails => ({
  talla: "",
  garmentType: null,
  medidasArriba: { axilaAxila: "", hombroHombro: "", largo: "", manga: "" },
  medidasAbajo: { anchoCintura: "", largo: "", caderaEntrepierna: "", anchoTobillo: "" },
  desperfectos: [],
  sku: "",
  costeInicial: "",
});

export default function ItemForm({ initialData, onSubmit }: ItemFormProps) {
  const [form, setForm] = useState<ListingForm>({
    ...initialData,
    stock: initialData.stock ?? 1,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  // Contexto manual para la IA
  const [manual, setManual] = useState<ManualDetails>(emptyManualDetails());
  const [showManualContext, setShowManualContext] = useState(false);

  // --- Mascara de fotos por plataforma ---
  const [photoSelection, setPhotoSelection] = useState<Partial<Record<PlatformKey, string[]>>>(
    initialData.photoSelection ?? {}
  );
  const [activeMaskPlatform, setActiveMaskPlatform] = useState<PlatformKey | null>(null);

  const updateManual = (patch: Partial<ManualDetails>) => {
    setManual(prev => ({ ...prev, ...patch }));
  };
  const updateMedidasArriba = (patch: Partial<MedidasArriba>) => {
    setManual(prev => ({ ...prev, medidasArriba: { ...prev.medidasArriba, ...patch } }));
  };
  const updateMedidasAbajo = (patch: Partial<MedidasAbajo>) => {
    setManual(prev => ({ ...prev, medidasAbajo: { ...prev.medidasAbajo, ...patch } }));
  };
  const toggleDesperfecto = (option: Desperfecto) => {
    setManual(prev => {
      let next: Desperfecto[];
      if (option === "Sin desperfectos") {
        next = prev.desperfectos.includes("Sin desperfectos") ? [] : ["Sin desperfectos"];
      } else {
        const withoutNone = prev.desperfectos.filter(o => o !== "Sin desperfectos");
        next = withoutNone.includes(option)
          ? withoutNone.filter(o => o !== option)
          : [...withoutNone, option];
      }
      return { ...prev, desperfectos: next };
    });
  };

  const update = <K extends keyof ListingForm>(
    field: K,
    value: ListingForm[K]
  ) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateAttribute = <K extends keyof Attributes>(
    field: K,
    value: Attributes[K]
  ) => {
    setForm(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [field]: value,
      },
    }));
  };

  const [selectedColor, setSelectedColor] = useState("");

  const COLOR_OPTIONS = [
    "Negro", "Blanco", "Rojo", "Azul", "Verde", "Amarillo", "Gris", "Rosa", "Naranja", "Marrón"
  ];

  const addColor = () => {
    if (!selectedColor) return;
    setForm(prev => {
      if (prev.colors.includes(selectedColor)) return prev;
      return { ...prev, colors: [...prev.colors, selectedColor] };
    });
    setSelectedColor("");
  };

  const removeColor = (color: string) => {
    setForm(prev => ({ ...prev, colors: prev.colors.filter(c => c !== color) }));
  };

  const formatPriceForDisplay = (value: number): string => {
    if (value === 0) return "";
    return value.toString().replace(".", ",");
  };

  const parsePriceFromInput = (value: string): number => {
    if (value === "") return 0;
    const normalized = value.replace(",", ".");
    const parts = normalized.split(".");
    if (parts.length > 2) {
      const firstPart = parts[0];
      const rest = parts.slice(1).join("");
      const cleaned = `${firstPart}.${rest}`;
      return Number(cleaned);
    }
    return Number(normalized);
  };

  const [priceInput, setPriceInput] = useState<string>(
    initialData.price ? formatPriceForDisplay(initialData.price) : ""
  );

  const handlePriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const filtered = rawValue.replace(/[^0-9,.]/g, "");
    const commaCount = (filtered.match(/,/g) || []).length;
    const dotCount = (filtered.match(/\./g) || []).length;
    if (commaCount > 1 || dotCount > 1) return;
    if (commaCount > 0 && dotCount > 0) return;
    setPriceInput(filtered);
    const numericValue = parsePriceFromInput(filtered);
    update("price", numericValue);
  };

  const handleStockChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === "") {
      update("stock", 0);
      return;
    }
    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) return;
    update("stock", parsed);
  };

  // --- Helpers de mascara por plataforma ---

  // Seleccion efectiva para una plataforma: la personalizada si existe
  // (filtrada por si alguna foto fue borrada), si no las primeras N.
  const getSelectedForPlatform = (platform: PlatformKey): string[] => {
    const custom = photoSelection[platform];
    if (custom) return custom.filter(url => form.photo_url.includes(url));
    return form.photo_url.slice(0, PLATFORM_PHOTO_LIMITS[platform]);
  };

  const togglePhotoForPlatform = (platform: PlatformKey, url: string) => {
    setPhotoSelection(prev => {
      const current = prev[platform] ?? getSelectedForPlatform(platform);
      const limit = PLATFORM_PHOTO_LIMITS[platform];
      const isSelected = current.includes(url);

      if (isSelected) {
        return { ...prev, [platform]: current.filter(u => u !== url) };
      }
      if (current.length >= limit) return prev; // no se puede superar el limite
      return { ...prev, [platform]: [...current, url] };
    });
  };

  const overflowingPlatforms = (Object.keys(PLATFORM_PHOTO_LIMITS) as PlatformKey[]).filter(
    platform => form.photo_url.length > PLATFORM_PHOTO_LIMITS[platform]
  );

  const buildPhotoSelectionForSubmit = (): Partial<Record<PlatformKey, string[]>> =>
    (Object.keys(PLATFORM_PHOTO_LIMITS) as PlatformKey[]).reduce((acc, platform) => {
      acc[platform] = getSelectedForPlatform(platform);
      return acc;
    }, {} as Partial<Record<PlatformKey, string[]>>);

  const removePhoto = (url: string) => {
    update("photo_url", form.photo_url.filter(u => u !== url));
    setPhotoSelection(prev => {
      const next: Partial<Record<PlatformKey, string[]>> = {};
      (Object.keys(prev) as PlatformKey[]).forEach(platform => {
        next[platform] = (prev[platform] ?? []).filter(u => u !== url);
      });
      return next;
    });
  };

  const reorderPhotos = (nextPhotos: string[]) => {
    update("photo_url", nextPhotos);
  };

  const handleGenerateSuggestions = async () => {
    const imgUrl = form.photo_url[0];
    if (!imgUrl) return;

    setIsGeneratingSuggestions(true);
    setSuggestionsError(null);

    const medidas = manual.garmentType === "arriba"
      ? manual.medidasArriba
      : manual.garmentType === "abajo"
        ? manual.medidasAbajo
        : null;

    try {
      const res = await fetch("/api/field-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imgUrl,
          talla: manual.talla || null,
          garmentType: manual.garmentType,
          medidas,
          desperfectos: manual.desperfectos,
          sku: manual.sku || "",
          costeInicial: manual.costeInicial ? Number(manual.costeInicial) : null,
          k: 5,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Error al generar sugerencias");
      }

      const data = await res.json();

      if (data.title) update("title", data.title);
      if (data.description) update("description", data.description);

      updateAttribute("brand", data.brand ?? "Sin marca");

      if (Array.isArray(data.colors)) {
        setForm(prev => ({ ...prev, colors: data.colors }));
      }

      if (typeof data.price === "number") {
        setPriceInput(formatPriceForDisplay(data.price));
        update("price", data.price);
      }

      if (data.gender) update("gender", data.gender);

      if (data.category) {
        update("item_type", data.category.title);
        updateAttribute("categoryPath", data.category.path);
        updateAttribute("vintedCategoryId", data.category.id);
      }

      // La talla manual tiene prioridad sobre la que sugiera la IA
      if (manual.talla) {
        updateAttribute("size", manual.talla);
      } else if (data.size) {
        updateAttribute("size", data.size);
      }

      if (data.condition) update("condition", data.condition);

      // Contexto manual que no depende de la IA, se aplica directamente
      updateAttribute("garmentType", manual.garmentType);
      updateAttribute("medidas", medidas);
      updateAttribute("desperfectos", manual.desperfectos);
      updateAttribute("sku", manual.sku || "");
      updateAttribute("costeInicial", manual.costeInicial ? Number(manual.costeInicial) : null);
      update("sku", manual.sku || "");

    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Fotos */}
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">Fotos</label>

          <button
            type="button"
            onClick={handleGenerateSuggestions}
            disabled={form.photo_url.length === 0 || isGeneratingSuggestions}
            className="flex items-center gap-1.5 text-sm text-purple-600 border border-purple-200 px-3 py-1.5 rounded-md hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isGeneratingSuggestions ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Rellenar con IA
          </button>
        </div>

        {suggestionsError && (
          <p className="text-sm text-red-600 mt-1" role="alert">{suggestionsError}</p>
        )}
        {uploadError && (
          <p className="text-sm text-red-600 mt-1" role="alert">{uploadError}</p>
        )}

        <p className="text-xs text-gray-500 mt-1">
          Arrastra las fotos para reordenarlas. La primera se usa para generar los datos con IA.
        </p>

        <SortablePhotoGrid
          photos={form.photo_url ?? []}
          onChange={reorderPhotos}
          onRemove={(i) => removePhoto(form.photo_url[i])}
          gridClassName="grid grid-cols-3 gap-3 mt-2"
          renderOverlay={(url, i) => {
            const isMasking = activeMaskPlatform !== null;
            const isSelectedForMask =
              isMasking && getSelectedForPlatform(activeMaskPlatform!).includes(url);

            if (isMasking) {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePhotoForPlatform(activeMaskPlatform!, url);
                  }}
                  className={`absolute inset-0 flex items-start justify-end p-1 transition ${isSelectedForMask ? "" : "bg-black/40"
                    }`}
                >
                  <span
                    className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center border-2 transition ${isSelectedForMask
                        ? "bg-amber-600 border-amber-600 text-white"
                        : "bg-white/80 border-gray-300 text-gray-400"
                      }`}
                  >
                    {isSelectedForMask ? "✓" : ""}
                  </span>
                </button>
              );
            }

            return i === 0 ? (
              <span className="absolute bottom-1 left-1 bg-purple-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                IA
              </span>
            ) : null;
          }}
          trailing={
            <label
              className={`flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition ${isUploading ? "opacity-50 pointer-events-none" : ""
                }`}
            >
              {isUploading ? (
                <Loader2 size={24} className="animate-spin text-gray-400" />
              ) : (
                <span className="text-gray-400 text-3xl">+</span>
              )}
              <input
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                className="hidden"
                disabled={isUploading}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;

                  setIsUploading(true);
                  setUploadError(null);

                  try {
                    const results = await Promise.allSettled(
                      files.map(async (file) => {
                        const prepared = await prepareImageForUpload(file);
                        return uploadPhoto(prepared);
                      })
                    );

                    const successUrls = results
                      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
                      .map((r) => r.value);

                    const failedMessages = results
                      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
                      .map((r) => (r.reason instanceof Error ? r.reason.message : "Error desconocido"));

                    if (failedMessages.length > 0) {
                      setUploadError(
                        failedMessages.length === files.length
                          ? "No se pudo subir ninguna foto. Inténtalo de nuevo."
                          : failedMessages.join(" · ")
                      );
                    }

                    if (successUrls.length > 0) {
                      update("photo_url", [...form.photo_url, ...successUrls]);
                    }
                  } finally {
                    setIsUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          }
        />

        {/* Aviso de limites por plataforma + selector de mascara */}
        {overflowingPlatforms.length > 0 && (
          <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <p className="font-medium mb-2">
              Estas plataformas tienen límite de fotos — toca una para elegir cuáles se suben:
            </p>
            <div className="flex flex-wrap gap-2">
              {overflowingPlatforms.map((platform) => {
                const count = getSelectedForPlatform(platform).length;
                const limit = PLATFORM_PHOTO_LIMITS[platform];
                const active = activeMaskPlatform === platform;
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => setActiveMaskPlatform(active ? null : platform)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${active
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
                      }`}
                  >
                    {PLATFORM_LABELS[platform]}: {count}/{limit}
                  </button>
                );
              })}
              {activeMaskPlatform && (
                <button
                  type="button"
                  onClick={() => setActiveMaskPlatform(null)}
                  className="px-2.5 py-1 rounded-full text-xs border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Listo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contexto manual para la IA */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowManualContext(prev => !prev)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition"
        >
          <span className="text-sm font-medium text-gray-700">
            Contexto para la IA <span className="text-xs font-normal text-gray-400">(opcional)</span>
          </span>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${showManualContext ? "rotate-180" : ""}`}
          />
        </button>

        {showManualContext && (
          <div className="p-4 pt-0 space-y-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-500">Talla</label>
                <select
                  value={manual.talla}
                  onChange={e => updateManual({ talla: e.target.value })}
                  className="w-full border border-gray-200 rounded p-1.5 text-sm mt-0.5"
                >
                  <option value="">Selecciona una talla</option>
                  {SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">SKU</label>
                <input
                  value={manual.sku}
                  onChange={e => updateManual({ sku: e.target.value })}
                  placeholder="Ej. AB123"
                  className="w-full border border-gray-200 rounded p-1.5 text-sm mt-0.5"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500">Tipo de prenda</label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => updateManual({ garmentType: "arriba" })}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${manual.garmentType === "arriba" ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600"}`}
                >
                  Arriba
                </button>
                <button
                  type="button"
                  onClick={() => updateManual({ garmentType: "abajo" })}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${manual.garmentType === "abajo" ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600"}`}
                >
                  Abajo
                </button>
              </div>
            </div>

            {manual.garmentType === "arriba" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Axila a axila"
                  value={manual.medidasArriba.axilaAxila}
                  onChange={e => updateMedidasArriba({ axilaAxila: e.target.value })}
                  className="border border-gray-200 rounded p-1.5 text-sm"
                />
                <input
                  placeholder="Hombro a hombro"
                  value={manual.medidasArriba.hombroHombro}
                  onChange={e => updateMedidasArriba({ hombroHombro: e.target.value })}
                  className="border border-gray-200 rounded p-1.5 text-sm"
                />
                <input
                  placeholder="Largo"
                  value={manual.medidasArriba.largo}
                  onChange={e => updateMedidasArriba({ largo: e.target.value })}
                  className="border border-gray-200 rounded p-1.5 text-sm"
                />
                <input
                  placeholder="Manga"
                  value={manual.medidasArriba.manga}
                  onChange={e => updateMedidasArriba({ manga: e.target.value })}
                  className="border border-gray-200 rounded p-1.5 text-sm"
                />
              </div>
            )}

            {manual.garmentType === "abajo" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Ancho cintura"
                  value={manual.medidasAbajo.anchoCintura}
                  onChange={e => updateMedidasAbajo({ anchoCintura: e.target.value })}
                  className="border border-gray-200 rounded p-1.5 text-sm"
                />
                <input
                  placeholder="Largo"
                  value={manual.medidasAbajo.largo}
                  onChange={e => updateMedidasAbajo({ largo: e.target.value })}
                  className="border border-gray-200 rounded p-1.5 text-sm"
                />
                <input
                  placeholder="Cadera a entrepierna"
                  value={manual.medidasAbajo.caderaEntrepierna}
                  onChange={e => updateMedidasAbajo({ caderaEntrepierna: e.target.value })}
                  className="border border-gray-200 rounded p-1.5 text-sm"
                />
                <input
                  placeholder="Ancho tobillo"
                  value={manual.medidasAbajo.anchoTobillo}
                  onChange={e => updateMedidasAbajo({ anchoTobillo: e.target.value })}
                  className="border border-gray-200 rounded p-1.5 text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500">Desperfectos</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DESPERFECTO_OPTIONS.map(option => {
                  const active = manual.desperfectos.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleDesperfecto(option)}
                      className={`px-2.5 py-1 rounded-full text-xs border ${active ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600"}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-28">
              <label className="text-xs font-medium text-gray-500">Coste inicial</label>
              <div className="relative">
                <input
                  type="number"
                  value={manual.costeInicial}
                  onChange={e => updateManual({ costeInicial: e.target.value })}
                  className="w-full border border-gray-200 rounded p-1.5 pr-6 text-sm mt-0.5"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                  €
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Titulo */}
      <div>
        <label className="block text-sm font-medium">Título</label>
        <input
          type="text"
          value={form.title}
          onChange={e => update("title", e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 p-2"
        />
      </div>

      {/* Descripcion */}
      <div>
        <label className="block text-sm font-medium">Descripción</label>
        <textarea
          value={form.description}
          onChange={e => update("description", e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 p-2 h-32"
        />
      </div>

      {/* Grid de 2 columnas */}
      <div className="grid grid-cols-2 gap-4">

        {/* Marca */}
        <div>
          <label className="block text-sm font-medium">Marca</label>
          <BrandSelect
            value={form.attributes.brand}
            onChange={brand => updateAttribute("brand", brand)}
          />
        </div>

        {/* Tipo de prenda */}
        <div>
          <label className="block text-sm font-medium">Tipo de prenda</label>
          <CategorySelect
            value={form.attributes.categoryPath ?? ""}
            unisex={form.gender === "unisex"}
            onChange={({ fullPath, leaf, gender }) => {
              update("item_type", leaf?.title ?? "");
              updateAttribute("categoryPath", fullPath);
              updateAttribute("vintedCategoryId", leaf?.id ?? null);
              if (gender) update("gender", gender);
            }}
          />
          {form.gender && (
            <p className="text-xs text-gray-500 mt-1">
              Género: <span className="capitalize">{form.gender}</span>
            </p>
          )}
        </div>

        {/* Genero */}
        <div>
          <label className="block text-sm font-medium">Género</label>
          <select
            value={form.gender ?? ""}
            onChange={e => update("gender", e.target.value as ListingForm["gender"])}
            className="mt-1 w-full rounded-md border border-gray-300 p-2"
          >
            <option value="">Selecciona género</option>
            {GENDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Se rellena solo al elegir la categoría, pero puedes cambiarlo aquí.
          </p>
        </div>

        {/* Colores */}
        <div>
          <label className="block text-sm font-medium">Colores</label>

          <div className="flex gap-2 mt-2">
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2"
            >
              <option value="">Selecciona un color</option>
              {COLOR_OPTIONS.map(color => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={addColor}
              className="bg-blue-600 text-white px-4 rounded-md hover:bg-blue-700"
            >
              Añadir
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {form.colors.map(color => (
              <div
                key={color}
                className="flex items-center gap-2 bg-gray-100 border px-3 py-1 rounded-full"
              >
                <span className="text-sm">{color}</span>

                <button
                  type="button"
                  onClick={() => removeColor(color)}
                  className="text-red-500 font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Estado */}
        <div>
          <label className="block text-sm font-medium">Estado</label>
          <select
            value={form.condition}
            onChange={e => update("condition", e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 p-2"
          >
            <option value="Nuevo">Nuevo</option>
            <option value="Como nuevo">Como nuevo</option>
            <option value="Bueno">Bueno</option>
            <option value="Aceptable">Aceptable</option>
          </select>
        </div>

        {/* Talla */}
        <div>
          <label className="block text-sm font-medium">Talla</label>
          <select
            value={form.attributes.size}
            onChange={e => updateAttribute("size", e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 p-2"
          >
            <option value="">Selecciona una talla</option>
            {["XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL", "6XL", "7XL", "8XL", "Talla única"].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        {/* Precio */}
        <div>
          <label className="block text-sm font-medium">Precio (€)</label>
          <input
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={handlePriceChange}
            placeholder="0,00"
            className="mt-1 w-full rounded-md border border-gray-300 p-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Usa coma (,) o punto (.) como separador decimal
          </p>
        </div>

        {/* Stock */}
        <div>
          <label className="block text-sm font-medium">Stock</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={form.stock ?? 1}
            onChange={handleStockChange}
            className="mt-1 w-full rounded-md border border-gray-300 p-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Este campo solo se usa para Shopify
          </p>
        </div>

      </div>

      {/* Boton */}
      {formError && (
        <p className="text-sm text-red-600" role="alert">
          {formError}
        </p>
      )}
      <button
        onClick={() => {
          const validationError = validateListingCreationFields(form);
          if (validationError) {
            setFormError(validationError);
            return;
          }

          setFormError(null);
          const finalForm: ListingForm = {
            ...form,
            photoSelection: buildPhotoSelectionForSubmit(),
          };
          startTransition(() => { onSubmit(finalForm); });
        }}
        disabled={isPending || isUploading}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending && <Loader2 size={18} className="animate-spin" />}
        {isPending ? "Guardando producto..." : "Guardar producto"}
      </button>

    </div>
  );
}

