import type { Prisma } from '@prisma/client'

export interface StockLine {
  productId:    string
  variantLabel: string | null
  quantity:     number
}

/** Devuelve al stock las cantidades de un pedido (cancelación o baja de cantidades). */
export async function restoreStock(tx: Prisma.TransactionClient, lines: StockLine[]): Promise<void> {
  for (const line of lines) {
    if (line.quantity <= 0) continue
    if (line.variantLabel) {
      await tx.productVariant.updateMany({
        where: { productId: line.productId, label: line.variantLabel },
        data:  { stock: { increment: line.quantity } },
      })
    } else {
      await tx.product.updateMany({
        where: { id: line.productId },
        data:  { stock: { increment: line.quantity } },
      })
    }
  }
}

/**
 * Descuenta stock de forma atómica: el `stock >= quantity` va en el WHERE, así
 * el chequeo y el descuento son una sola operación y dos pedidos simultáneos
 * no pueden vender la misma unidad. Devuelve false si no alcanzó.
 */
export async function takeStock(tx: Prisma.TransactionClient, line: StockLine): Promise<boolean> {
  if (line.quantity <= 0) return true
  const updated = line.variantLabel
    ? await tx.productVariant.updateMany({
        where: { productId: line.productId, label: line.variantLabel, stock: { gte: line.quantity } },
        data:  { stock: { decrement: line.quantity } },
      })
    : await tx.product.updateMany({
        where: { id: line.productId, stock: { gte: line.quantity } },
        data:  { stock: { decrement: line.quantity } },
      })
  return updated.count > 0
}
