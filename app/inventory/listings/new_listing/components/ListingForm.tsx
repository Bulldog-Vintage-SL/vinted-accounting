/*
  Componente de creacion de un producto, cuando se aprieta el boton de crear el producto se llama a la funcion 
  que tiene el form en su atributo onSubmit inicializado en la page.tsx que llame a la componente.
*/

"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { Loader2 } from "lucide-react";
import { ListingForm } from '@/app/inventory/listings/types';
import { uploadPhoto } from "@/utils/uploadPhoto";

type ItemFormProps = {
  initialData: ListingForm;
  onSubmit: (data: ListingForm) => void;
};

type Attributes = ListingForm["attributes"];

export default function ItemForm({ initialData, onSubmit }: ItemFormProps) {
  const [form, setForm] = useState<ListingForm>({
    ...initialData,
    stock: initialData.stock ?? 1,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
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

  // Formatea el precio para mostrarlo con coma
  const formatPriceForDisplay = (value: number): string => {
    if (value === 0) return "";
    return value.toString().replace(".", ",");
  };

  // Convierte el input del usuario a num valido
  const parsePriceFromInput = (value: string): number => {
    // Si está vacio, devolver 0
    if (value === "") return 0;

    // Reemplazar coma por punto para convertir a número
    const normalized = value.replace(",", ".");

    // Si hay más de un punto, limpiar (caso 15.78.00)
    const parts = normalized.split(".");
    if (parts.length > 2) {
      // Quedarse solo con el primer punto
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

    // Permitir solo digitos, coma y punto
    const filtered = rawValue.replace(/[^0-9,.]/g, "");

    const commaCount = (filtered.match(/,/g) || []).length;
    const dotCount = (filtered.match(/\./g) || []).length;

    if (commaCount > 1 || dotCount > 1) {
      return;
    }

    // Si hay coma y punto a la vez, no permitir
    if (commaCount > 0 && dotCount > 0) {
      return;
    }

    setPriceInput(filtered);

    // Convertir a numero y guardar en el estado
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

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Fotos */}
      <div>
        <label className="block text-sm font-medium">Fotos</label>

        <div className="grid grid-cols-3 gap-3 mt-2">
          {form.photo_url?.map((url, i) => (
            <div key={i} className="relative group">
              <img src={url} className="rounded-md shadow-sm object-cover h-32 w-full" />
              <button
                onClick={() => update("photo_url", form.photo_url.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 bg-black/60 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
              >
                X
              </button>
            </div>
          ))}

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
          <input
            type="text"
            value={form.attributes.brand}
            onChange={e => updateAttribute("brand", e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 p-2"
          />
        </div>

        {/* Genero */}
        <div>
          <label className="block text-sm font-medium">Género</label>
          <select
            value={form.gender ?? ""}
            onChange={e => update("gender", e.target.value as 'hombre' | 'mujer' | 'unisex')}
            className="mt-1 w-full rounded-md border border-gray-300 p-2"
          >
            <option value="">Selecciona género</option>
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
            <option value="unisex">Unisex</option>
          </select>
        </div>

        {/* Tipo de prenda */}
        <div>
          <label className="block text-sm font-medium">Tipo de prenda</label>
          <input
            type="text"
            value={form.item_type ?? ""}
            onChange={e => update("item_type", e.target.value)}
            placeholder="camiseta, pantalón, sudadera..."
            className="mt-1 w-full rounded-md border border-gray-300 p-2"
          />
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
      <button
        onClick={() => startTransition(() => { onSubmit(form); })}
        disabled={isPending || isUploading}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending && <Loader2 size={18} className="animate-spin" />}
        {isPending ? "Guardando producto..." : "Guardar producto"}
      </button>

    </div>
  );
}