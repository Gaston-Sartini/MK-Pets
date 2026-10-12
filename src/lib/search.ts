/**
 * Búsqueda del catálogo.
 *
 * El catálogo es chico (decenas de productos), así que se busca en memoria: eso
 * permite cosas que un LIKE en la base no hace bien — mirar nombre, categoría y
 * descripción a la vez, entender sinónimos ("arena" encuentra las piedritas) y
 * perdonar errores de tipeo ("wiskas").
 */

export interface Searchable {
  name: string
  category?: string | null
  description?: string | null
}

// Rango de los acentos sueltos (se arma por código para no dejar caracteres invisibles en el archivo)
const DIACRITICS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g')
const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(DIACRITICS, '')

// Palabras que no dicen qué se busca
const STOPWORDS = new Set(['de', 'del', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'mi', 'mis', 'con', 'y', 'o', 'en', 'tenes', 'tienen', 'hay', 'busco', 'quiero'])

// Cada grupo son formas de pedir lo mismo. Si la persona escribe una, valen todas.
const SYNONYMS: string[][] = [
  ['arena', 'arenas', 'piedritas', 'piedra', 'piedras', 'sanitaria', 'sanitarias', 'bentonita', 'aglomerante'],
  ['comida', 'alimento', 'alimentos', 'balanceado', 'balanceados'],
  ['gato', 'gatos', 'gata', 'felino', 'michi'],
  ['perro', 'perros', 'perra', 'canino'],
  ['snack', 'snacks', 'premio', 'premios', 'golosina', 'golosinas'],
  ['humedo', 'humedos', 'lata', 'latas', 'latita', 'latitas', 'sobre', 'sobres', 'sobrecito', 'sobrecitos', 'pate'],
  ['castrado', 'castrada', 'castrados', 'esterilizado', 'esterilizada', 'esterilizados'],
  ['urinario', 'urinaria', 'urinary'],
]

const FOOD_WORDS    = new Set(['comida', 'alimento', 'alimentos', 'balanceado', 'balanceados'])
const FOOD_CATEGORY = /gat|perr|humed|aliment/

const synonymsOf = (word: string): string[] => SYNONYMS.find(group => group.includes(word)) ?? [word]

/** Distancia de edición entre dos palabras, cortando apenas pasa el máximo permitido. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, row[j])
    }
    if (best > max) return max + 1
    prev = row
  }
  return prev[b.length]
}

/** ¿`word` es `target` con un error de tipeo? Solo para palabras largas: en las cortas todo se parece. */
function isTypoOf(word: string, target: string): boolean {
  if (word.length < 5 || target.length < 5) return false
  return editDistance(word, target, word.length >= 8 ? 2 : 1) <= (word.length >= 8 ? 2 : 1)
}

/** Las palabras que importan de una búsqueda. */
export function searchTerms(query: string): string[] {
  return plain(query).split(/[^a-z0-9]+/).filter(w => w.length >= 2 && !STOPWORDS.has(w))
}

/**
 * Qué tan bien responde un producto a la búsqueda: 0 = no corresponde.
 * Tiene que responder a todas las palabras; pesa más acertar en el nombre.
 */
export function searchScore(query: string, item: Searchable): number {
  const terms = searchTerms(query)
  if (terms.length === 0) return 0

  const name        = plain(item.name)
  const category    = plain(item.category ?? '')
  const description = plain(item.description ?? '')
  const nameWords   = name.split(/[^a-z0-9]+/).filter(Boolean)

  let total = 0
  for (const term of terms) {
    const forms = synonymsOf(term)
    let score = 0
    if (name.includes(term)) score = 4
    else if (forms.some(f => name.includes(f))) score = 3
    else if (forms.some(f => category.includes(f))) score = 2
    else if (forms.some(f => description.includes(f))) score = 1
    // "comida" / "alimento": casi ningún producto lo dice en el nombre; vale la categoría
    else if (FOOD_WORDS.has(term) && FOOD_CATEGORY.test(category)) score = 1
    else if (nameWords.some(w => isTypoOf(term, w))) score = 2
    if (score === 0) return 0
    total += score
  }
  return total
}

/** Filtra y ordena una lista por la búsqueda, lo más acertado primero. */
export function searchItems<T extends Searchable>(query: string, items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index, score: searchScore(query, item) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(r => r.item)
}
