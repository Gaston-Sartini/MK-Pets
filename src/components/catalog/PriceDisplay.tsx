import { formatPrice, discountPercent, cn } from '@/lib/utils'

interface Props {
  currentPrice:   number
  originalPrice?: number | null
  /** Visual size — controls font sizes of the current price. */
  size?: 'sm' | 'lg'
  className?: string
}

/**
 * Renders price with optional strikethrough "original" price and "% off" pill.
 * Used in product cards and product detail page so both behave identically.
 */
export function PriceDisplay({
  currentPrice,
  originalPrice = null,
  size = 'sm',
  className,
}: Props) {
  const off = discountPercent(currentPrice, originalPrice)

  const currentClass = size === 'lg'
    ? 'font-display font-black text-3xl md:text-4xl text-mk-orange'
    : 'font-display font-black text-xl text-mk-orange'

  const originalClass = size === 'lg'
    ? 'font-body text-base text-mk-mid line-through'
    : 'font-body text-xs text-mk-mid line-through'

  const offClass = size === 'lg'
    ? 'inline-flex items-center text-sm font-display font-bold text-white bg-green-600 px-2 py-0.5 rounded-md'
    : 'inline-flex items-center text-[10px] font-display font-bold text-white bg-green-600 px-1.5 py-0.5 rounded'

  return (
    <div className={cn('flex flex-col', size === 'lg' ? 'gap-1' : 'gap-0.5', className)}>
      {off !== null && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={originalClass}>{formatPrice(originalPrice!)}</span>
          <span className={offClass}>-{off}%</span>
        </div>
      )}
      <p className={currentClass}>{formatPrice(currentPrice)}</p>
    </div>
  )
}
