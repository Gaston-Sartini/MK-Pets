/**
 * Normaliza teléfonos argentinos al formato que espera Evolution API: 549 + área + número.
 * Acepta lo que la gente realmente escribe: "011 15 6669-8395", "+54 9 11 6669 8395",
 * "1166698395", "15 6669 8395" (asume AMBA cuando falta el código de área).
 */
export function normalizeArgPhone(raw: string): string {
  let d = raw.replace(/\D/g, '')

  if (d.startsWith('549')) return d
  if (d.startsWith('54'))  d = d.slice(2)
  if (d.startsWith('0'))   d = d.slice(1)

  // "15" después del código de área (2 a 4 dígitos) es el prefijo de celular viejo: se descarta
  if (d.length > 10) {
    const m = d.match(/^(\d{2,4})15(\d{6,8})$/)
    if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2]
  }
  // "15 xxxx xxxx" sin código de área → celular de AMBA
  if (d.length === 10 && d.startsWith('15')) d = '11' + d.slice(2)
  if (d.length === 8) d = '11' + d

  return '549' + d
}
