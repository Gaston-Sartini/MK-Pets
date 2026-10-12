/**
 * Los 48 barrios de la Ciudad de Buenos Aires, que es donde se entrega.
 * El checkout pide elegir uno: así nadie de fuera de CABA completa un pedido
 * que después hay que cancelar a mano.
 */
export const BARRIOS_CABA = [
  'Agronomía', 'Almagro', 'Balvanera', 'Barracas', 'Belgrano', 'Boedo', 'Caballito', 'Chacarita',
  'Coghlan', 'Colegiales', 'Constitución', 'Flores', 'Floresta', 'La Boca', 'La Paternal', 'Liniers',
  'Mataderos', 'Monte Castro', 'Monserrat', 'Nueva Pompeya', 'Núñez', 'Palermo', 'Parque Avellaneda',
  'Parque Chacabuco', 'Parque Chas', 'Parque Patricios', 'Puerto Madero', 'Recoleta', 'Retiro',
  'Saavedra', 'San Cristóbal', 'San Nicolás', 'San Telmo', 'Vélez Sársfield', 'Versalles',
  'Villa Crespo', 'Villa del Parque', 'Villa Devoto', 'Villa General Mitre', 'Villa Lugano',
  'Villa Luro', 'Villa Ortúzar', 'Villa Pueyrredón', 'Villa Real', 'Villa Riachuelo',
  'Villa Santa Rita', 'Villa Soldati', 'Villa Urquiza',
] as const

export type BarrioCaba = (typeof BARRIOS_CABA)[number]

/** Dirección completa tal como se guarda en el pedido y la lee quien reparte. */
export function fullAddress(address: string, barrio: string): string {
  return `${address.trim()}, ${barrio}, CABA`
}
