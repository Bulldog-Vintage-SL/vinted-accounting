'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useEffect, useState, type ChangeEvent } from 'react'
import { ArrowLeft, Loader2, Plus, X, ImagePlus } from 'lucide-react'
import { Listing, ListingForm } from '../types'
import { useToast } from '@/components/toast'
import { uploadPhoto } from '@/utils/uploadPhoto'
import { PageLoader } from '@/components/ui/page-loader'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface Props {
  listingId: string
}

const emptyForm: ListingForm = {
  title: '',
  description: '',
  condition: '',
  price: '',
  photo_url: [],
  colors: [],
  attributes: { brand: '', size: '' },
  gender: null,
  item_type: null,
  stock: 1
}

const COLOR_OPTIONS = [
  'Negro',
  'Blanco',
  'Rojo',
  'Azul',
  'Verde',
  'Amarillo',
  'Gris',
  'Rosa',
  'Naranja',
  'Marrón',
]

const SIZE_OPTIONS = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', '6XL', '7XL', '8XL', 'Talla única',
]

const CONDITION_OPTIONS = ['Nuevo', 'Como nuevo', 'Bueno', 'Aceptable']

// Formatea el precio para mostrarlo con coma
const formatPriceForDisplay = (value: number | ''): string => {
  if (value === '' || value === 0) return ''
  return value.toString().replace('.', ',')
}

// Convierte el input del usuario a num valido
const parsePriceFromInput = (value: string): number => {
  if (value === '') return 0
  const normalized = value.replace(',', '.')
  const parts = normalized.split('.')
  if (parts.length > 2) {
    const firstPart = parts[0]
    const rest = parts.slice(1).join('')
    const cleaned = `${firstPart}.${rest}`
    return Number(cleaned)
  }
  return Number(normalized)
}

export function ListingDetailForm({ listingId }: Props) {
  const { data, error, isLoading, mutate } = useSWR<Listing>(`/api/listings/${listingId}`, fetcher)
  const { pushToast } = useToast()

  const [form, setForm] = useState<ListingForm>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedColor, setSelectedColor] = useState('')
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [priceInput, setPriceInput] = useState('')

  useEffect(() => {
    if (!data) return
    setForm({
      title: data.title ?? '',
      description: data.description ?? '',
      condition: data.condition ?? '',
      price: data.price ?? '',
      photo_url: data.photo_url ?? [],
      colors: data.colors ?? [],
      attributes: {
        brand: data.attributes?.brand ?? '',
        size: data.attributes?.size ?? '',
      },
      gender: data.gender ?? null,
      item_type: data.item_type ?? null,
      stock: data.stock ?? 1,
    })
    setPriceInput(data.price ? formatPriceForDisplay(data.price) : '')
    setActivePhotoIdx(0)
  }, [data])

  const handleChange = <K extends keyof ListingForm>(field: K, value: ListingForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleAttributeChange = (field: keyof ListingForm['attributes'], value: string) => {
    setForm(prev => ({ ...prev, attributes: { ...prev.attributes, [field]: value } }))
  }

  const handlePriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const filtered = rawValue.replace(/[^0-9,.]/g, '')

    const commaCount = (filtered.match(/,/g) || []).length
    const dotCount = (filtered.match(/\./g) || []).length

    if (commaCount > 1 || dotCount > 1) return
    if (commaCount > 0 && dotCount > 0) return

    setPriceInput(filtered)
    handleChange('price', parsePriceFromInput(filtered))
  }

  const handleStockChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    if (rawValue === '') {
      handleChange('stock', 0)
      return
    }
    const parsed = parseInt(rawValue, 10)
    if (Number.isNaN(parsed) || parsed < 0) return
    handleChange('stock', parsed)
  }

  const addColor = () => {
    if (!selectedColor) return
    if (form.colors.includes(selectedColor)) {
      setSelectedColor('')
      return
    }
    handleChange('colors', [...form.colors, selectedColor])
    setSelectedColor('')
  }

  const removeColor = (color: string) => {
    handleChange('colors', form.colors.filter(c => c !== color))
  }

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsUploading(true)
    try {
      const urls = await Promise.all(files.map(uploadPhoto))
      setForm(prev => ({ ...prev, photo_url: [...prev.photo_url, ...urls] }))
    } catch (err) {
      console.error(err)
      pushToast({
        message: 'Error al subir la foto',
        description: 'No se pudo subir una o varias imágenes.',
        type: 'error',
      })
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const removePhoto = (idx: number) => {
    setForm(prev => ({ ...prev, photo_url: prev.photo_url.filter((_, i) => i !== idx) }))
    setActivePhotoIdx(prev => (prev >= idx && prev > 0 ? prev - 1 : prev))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error al guardar')
      }

      await mutate()
      pushToast({
        message: 'Producto actualizado',
        description: `"${form.title}" se ha guardado correctamente.`,
        type: 'success',
      })
    } catch (err: any) {
      console.error(err)
      pushToast({
        message: 'Error al guardar',
        description: err.message || 'No se pudo guardar el producto.',
        type: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <PageLoader label="Cargando producto..." />
  }

  if (error || !data) {
    return <div className="p-4 text-red-500">Error cargando el producto</div>
  }

  const activePhoto = form.photo_url[activePhotoIdx]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/inventory/listings"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
        >
          <ArrowLeft size={16} />
          Volver a productos
        </Link>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isSaving && <Loader2 size={16} className="animate-spin" />}
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Info no editable */}
      <div className="flex gap-4 text-xs text-gray-400 border-b border-gray-100 pb-4">
        <span>SKU: <span className="text-gray-600 font-medium">{data.sku}</span></span>
        <span>Estado: <span className="text-gray-600 font-medium">{data.status}</span></span>
        <span>Creado: <span className="text-gray-600 font-medium">{new Date(data.created_at).toLocaleDateString('es-ES')}</span></span>
      </div>

      {/* Card principal: foto a la izquierda, campos a la derecha */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-10 bg-white rounded-2xl border border-gray-100 shadow-sm p-8">

        {/* Columna izquierda: foto grande + galería */}
        <div className="flex flex-col gap-3">
          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
            {activePhoto ? (
              <img src={activePhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <ImagePlus size={48} strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* Miniaturas */}
          <div className="grid grid-cols-5 gap-2">
            {form.photo_url.map((url, idx) => (
              <div
                key={url + idx}
                onClick={() => setActivePhotoIdx(idx)}
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition group ${idx === activePhotoIdx ? 'border-blue-500' : 'border-transparent hover:border-gray-200'
                  }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={(e) => { e.stopPropagation(); removePhoto(idx) }}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            <label className="aspect-square flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition">
              {isUploading ? (
                <Loader2 size={16} className="animate-spin text-gray-400" />
              ) : (
                <Plus size={16} className="text-gray-400" />
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={isUploading}
                onChange={handlePhotoUpload}
              />
            </label>
          </div>
        </div>

        {/* Columna derecha: campos */}
        <div className="flex flex-col gap-5">
          {/* Titulo */}
          <div>
            <label className="text-sm font-semibold text-gray-700">Título</label>
            <input
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>

          {/* Descripcion */}
          <div>
            <label className="text-sm font-semibold text-gray-700">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Precio */}
            <div>
              <label className="text-sm font-semibold text-gray-700">Precio (€)</label>
              <input
                type="text"
                inputMode="decimal"
                value={priceInput}
                onChange={handlePriceChange}
                placeholder="0,00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">Usa coma (,) o punto (.) como separador</p>
            </div>

            {/* Stock */}
            <div>
              <label className="text-sm font-semibold text-gray-700">Stock</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.stock ?? 0}
                onChange={handleStockChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>

            {/* Estado / condicion */}
            <div>
              <label className="text-sm font-semibold text-gray-700">Estado</label>
              <select
                value={form.condition}
                onChange={(e) => handleChange('condition', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="">Selecciona estado</option>
                {CONDITION_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Marca */}
            <div>
              <label className="text-sm font-semibold text-gray-700">Marca</label>
              <input
                value={form.attributes.brand}
                onChange={(e) => handleAttributeChange('brand', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>

            {/* Talla */}
            <div>
              <label className="text-sm font-semibold text-gray-700">Talla</label>
              <select
                value={form.attributes.size}
                onChange={(e) => handleAttributeChange('size', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="">Selecciona una talla</option>
                {SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            {/* Genero */}
            <div>
              <label className="text-sm font-semibold text-gray-700">Género</label>
              <select
                value={form.gender ?? ''}
                onChange={(e) => handleChange('gender', (e.target.value || null) as ListingForm['gender'])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="">Selecciona género</option>
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>

            {/* Tipo de articulo */}
            <div>
              <label className="text-sm font-semibold text-gray-700">Tipo de prenda</label>
              <input
                value={form.item_type ?? ''}
                onChange={(e) => handleChange('item_type', e.target.value || null)}
                placeholder="camiseta, pantalón, sudadera..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
          </div>

          {/* Colores */}
          <div>
            <label className="text-sm font-semibold text-gray-700">Colores</label>

            <div className="flex gap-2 mt-2">
              <select
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecciona un color</option>
                {COLOR_OPTIONS.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={addColor}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 rounded-lg transition shrink-0"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {form.colors.map((color) => (
                <span
                  key={color}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full"
                >
                  {color}
                  <button onClick={() => removeColor(color)} className="hover:text-red-500 transition">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}