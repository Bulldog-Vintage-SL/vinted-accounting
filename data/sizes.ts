export const SIZE_OPTIONS = [
  "XS", "S", "M", "L", "XL", "XXL", "XXXL",
  "4XL", "5XL", "6XL", "7XL", "8XL", "Talla única",
] as const;

export type Size = typeof SIZE_OPTIONS[number];