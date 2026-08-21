"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ListingForm } from '@/app/inventory/listings/types';
import { uploadPhoto } from "@/utils/uploadPhoto";
import BrandSelect from "./BrandSelector";
import CategorySelect from "./CategorySelect";
import { validateListingCreationFields } from "@/libs/listings/validation";

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

const MAX_AI_PHOTOS = 3;


export default function ItemForm({ initialData, onSubmit }: ItemFormProps) {
  const [form, setForm] = useState<ListingForm>({
    ...initialData,
    stock: initialData.stock ?? 1,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // --- Sugerencias con IA ---
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const [aiSelectedPhotos, setAiSelectedPhotos] = useState<string[]>([]);
  const [suggestSizeCondition, setSuggestSizeCondition] = useState(false);

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
    "Negro",
    "Blanco",
    "Rojo",
    "Azul",
    "Verde",
    "Amarillo",
    "Gris",
    "Rosa",
    "Naranja",
    "Marrón"
  ];

  const addColor = () => {
    if (!selectedColor) return;

    setForm(prev => {
      if (prev.colors.includes(selectedColor)) return prev;

      return {
        ...prev,
        colors: [...prev.colors, selectedColor],
      };
    });

    setSelectedColor("");
  };

  const removeColor = (color: string) => {
    setForm(prev => ({
      ...prev,
      colors: prev.colors.filter(c => c !== color),
    }));
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

    if (commaCount > 1 || dotCount > 1) {
      return;
    }

    if (commaCount > 0 && dotCount > 0) {
      return;
    }

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

  const toggleAiPhoto = (url: string) => {
    setAiSelectedPhotos(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= MAX_AI_PHOTOS) return prev;
      return [...prev, url];
    });
  };

  const removePhoto = (url: string) => {
    update("photo_url", form.photo_url.filter(u => u !== url));
    setAiSelectedPhotos(prev => prev.filter(u => u !== url));
  };

  const handleGenerateSuggestions = async () => {
    const orderedSelection = form.photo_url.filter(url => aiSelectedPhotos.includes(url));
    if (orderedSelection.length === 0) return;

    setIsGeneratingSuggestions(true);
    setSuggestionsError(null);

    try {
      const res = await fetch("/api/field-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imgUrls: orderedSelection,
          suggestSizeCondition,
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

      if (data.size) updateAttribute("size", data.size);
      if (data.condition) update("condition", data.condition);

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
            disabled={aiSelectedPhotos.length === 0 || isGeneratingSuggestions}
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

        <p className="text-xs text-gray-500 mt-1">
          Selecciona hasta {MAX_AI_PHOTOS} fotos para la IA ({aiSelectedPhotos.length}/{MAX_AI_PHOTOS}). La primera seleccionada se usa para el título.
        </p>

        <div className="grid grid-cols-3 gap-3 mt-2">
          {form.photo_url?.map((url, i) => {
            const isSelected = aiSelectedPhotos.includes(url);
            const selectionOrder = aiSelectedPhotos.indexOf(url);
            const isDisabled = !isSelected && aiSelectedPhotos.length >= MAX_AI_PHOTOS;

            return (
              <div key={i} className="relative group">
                <img src={url} className="rounded-md shadow-sm object-cover h-32 w-full" />

                <button
                  onClick={() => removePhoto(url)}
                  className="absolute top-1 right-1 bg-black/60 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
                >
                  X
                </button>

                <button
                  type="button"
                  onClick={() => toggleAiPhoto(url)}
                  disabled={isDisabled}
                  className={`absolute bottom-1 left-1 flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium border transition
              ${isSelected
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white/90 text-gray-600 border-gray-300"}
              ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-purple-400"}
            `}
                  title={isSelected ? "Quitar de selección IA" : "Enviar a la IA"}
                >
                  {isSelected ? selectionOrder + 1 : "IA"}
                </button>
              </div>
            );
          })}

          {/* Boton para anyadir fotos */}
          <label className={`flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {isUploading ? (
              <Loader2 size={24} className="animate-spin text-gray-400" />
            ) : (
              <span className="text-gray-400 text-3xl">+</span>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={isUploading}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;

                setIsUploading(true);
                try {
                  const urls = await Promise.all(files.map(uploadPhoto));
                  update("photo_url", [...form.photo_url, ...urls]);
                } finally {
                  setIsUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>

        {/* Checkbox talla/condición */}
        <label className="flex items-center gap-2 mt-3 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={suggestSizeCondition}
            onChange={e => setSuggestSizeCondition(e.target.checked)}
            className="rounded border-gray-300"
          />
          Sugerir también talla y estado (recomendado: incluye una foto de la etiqueta)
        </label>
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

      {/* resto del formulario sin cambios ... */}

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

          {/* Select + botón */}
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

          {/* Etiquetas que van mostrando los colores */}
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
          startTransition(() => { onSubmit(form); });
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