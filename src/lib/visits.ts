/**
 * La ruta tal como se cuenta en las estadísticas de visitas: sin parámetros, y
 * las páginas de pedidos todas juntas (no interesa cuál). null = no se cuenta.
 */
export function countablePath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.length > 200) return null
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  if (path.startsWith('/admin') || path.startsWith('/api')) return null
  if (path.startsWith('/pedido/')) return '/pedido'
  return /^[\w\-/.%]+$/.test(path) ? path : null
}
