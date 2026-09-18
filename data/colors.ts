export const COLOR_OPTIONS = [
  "Negro", "Gris", "Blanco", "Crema", "Beige",
  "Naranja pastel", "Naranja", "Coral", "Rojo", "Burdeos",
  "Fucsia", "Rosa", "Morado", "Lila", "Azul claro",
  "Azul", "Azul marino", "Turquesa", "Menta", "Verde",
  "Verde oscuro", "Caqui", "Marrón", "Mostaza", "Amarillo",
  "Plateado", "Dorado", "Varios", "Transparente",
] as const;

export type Color = typeof COLOR_OPTIONS[number];