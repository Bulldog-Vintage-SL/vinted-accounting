export type PromptListing = {
  title?: string
  description?: string
  price?: number | null
  currency?: string
  isBundle?: boolean
  userSide?: 'seller' | 'buyer'
}


export function formatListingForPrompt(l?: PromptListing): string {
  if (!l) return ''
  const lines: string[] = []
  if (l.title) lines.push(`Prenda: ${l.title}${l.isBundle ? ' (lote de varias prendas)' : ''}`)
  if (l.price != null) lines.push(`Precio publicado: ${l.price} ${l.currency ?? '€'}`)
  if (l.description) lines.push(`Descripción: ${l.description}`)
  if (l.userSide) lines.push(`Tu rol en la conversación: ${l.userSide === 'seller' ? 'vendedor' : 'comprador'}`)
  return lines.join('\n')
}