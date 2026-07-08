/*
  Tipos de producto (BD y Formulario de creacion).
*/

export type Listing = {
  id: string
  profile_id: string
  title: string
  sku: string
  status: string
  tags: string
  condition: string
  description: string
  photo_url: string[]
  price: number
  delivery_method: string
  attributes: Record<string, any>
  created_at: string
  last_update: string
  colors: string[]
  gender: 'hombre' | 'mujer' | 'unisex' | null
  item_type: string | null
  stock: number
}

export type ListingForm = {
  title: string
  description: string
  condition: string
  price: number | ""
  photo_url: string[]
  colors: string[]
  attributes: {
    brand: string
    size: string
  }
  gender: 'hombre' | 'mujer' | 'unisex' | null
  item_type: string | null
  stock: number | null
}