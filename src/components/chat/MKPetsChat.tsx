'use client'

/**
 * MK-Pets Chat — burbuja flotante propia.
 * Reemplaza al embed de Typebot. Llama a /api/chat (motor propio o n8n, según config).
 *
 * Por qué no Typebot:
 *   - El builder + viewer 3.15 tienen un Code block sandbox (vm2) que no expone
 *     fetch / require / process, lo que rompe cualquier integración con APIs
 *     externas que no esté pre-cableada como Integration block.
 *   - Construir el chat en React nos da control total sobre el rendering de
 *     cards, los CTAs y la conexión al carrito (Zustand store).
 */
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCartStore } from '@/store/cart-store'
import { useToastStore } from '@/store/toast-store'
import { cn } from '@/lib/utils'
import type { ChatCard, ChatResponse } from '@/lib/chat-types'

type ChatMessage =
  | { id: string; from: 'user';   text: string }
  | { id: string; from: 'bot';    text: string; cards?: ChatCard[]; suggestions?: string[] }
  | { id: string; from: 'system'; text: string }

const STORAGE_KEY = 'mkpets-chat'
const STORAGE_TTL = 60 * 60 * 1000 // 1h

function loadSession(): { sessionId: string; messages: ChatMessage[] } {
  if (typeof window === 'undefined') {
    return { sessionId: 'ssr', messages: [] }
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && data.savedAt && Date.now() - data.savedAt < STORAGE_TTL) {
        return { sessionId: data.sessionId, messages: data.messages || [] }
      }
    }
  } catch {}
  const sessionId =
    'mkp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  return { sessionId, messages: [] }
}

function saveSession(sessionId: string, messages: ChatMessage[]) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sessionId, messages, savedAt: Date.now() }),
    )
  } catch {}
}

const WELCOME: ChatMessage = {
  id:   'welcome',
  from: 'bot',
  text: '¡Hola! 🐾 ¿Qué buscás para tu mascota?',
  suggestions: ['Alimento para perro', 'Algo para gato', 'Ver ofertas'],
}

function formatPrice(n: number) {
  try {
    return '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })
  } catch {
    return '$' + n
  }
}

function discountPct(current: number, original?: number | null) {
  if (!original || original <= current) return null
  const off = Math.floor(((original - current) / original) * 100)
  return off >= 1 ? off : null
}

export default function MKPetsChat() {
  // Render only after hydration — el componente lee sessionStorage y muestra
  // estado que depende del client. Renderizar en SSR causa hydration mismatch.
  const [mounted, setMounted]     = useState(false)
  const [isOpen, setIsOpen]       = useState(false)
  const [sessionId, setSessionId] = useState('ssr')
  const [messages, setMessages]   = useState<ChatMessage[]>([WELCOME])
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const addItem    = useCartStore((s) => s.addItem)
  const openDrawer = useCartStore((s) => s.openDrawer)
  const isDrawerOpen = useCartStore((s) => s.isDrawerOpen)
  // Al pagar y al ver un pedido no hace falta el vendedor, y el botón tapaba totales y botones
  const pathname = usePathname()
  const hiddenHere = pathname.startsWith('/checkout') || pathname.startsWith('/pedido')
  const addToast   = useToastStore((s) => s.addToast)

  // Marcar mounted en el primer client effect (no corre en SSR)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Restaurar la sesión al montar
  useEffect(() => {
    const { sessionId, messages } = loadSession()
    setSessionId(sessionId)
    if (messages.length > 0) setMessages(messages)
  }, [])

  // Persistir cambios
  useEffect(() => {
    if (sessionId === 'ssr') return
    saveSession(sessionId, messages)
  }, [sessionId, messages])

  // Auto-scroll al final
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isOpen])

  // Reset unread al abrir
  useEffect(() => {
    if (isOpen) setHasUnread(false)
  }, [isOpen])

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim()
    if (!text || sending) return
    setSending(true)
    setInput('')

    const userMsg: ChatMessage = {
      id: 'u-' + Date.now(),
      from: 'user',
      text,
    }
    // El servidor no guarda estado entre requests: le mandamos los últimos turnos
    // para que el vendedor recuerde de qué veníamos hablando.
    const history = messages
      .filter((m) => m.from !== 'system' && m.id !== 'welcome' && m.text)
      .slice(-12)
      .map((m) => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        // Junto al texto van las tarjetas que la persona vio, para que el vendedor
        // entienda "el segundo", "ese" o "el de 3 kilos".
        text: m.from === 'bot' && m.cards?.length
          ? `${m.text} [Mostré: ${m.cards.map((c) => c.name + (c.variantLabel ? ` (${c.variantLabel})` : '')).join('; ')}]`
          : m.text,
      }))

    setMessages((prev) => [...prev, userMsg])

    try {
      const r = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message: text,
          sessionId,
          history,
          // Qué lleva en el carrito: para no ofrecerle lo que ya tiene y cerrar bien la venta
          cart: useCartStore.getState().items.map((i) => ({ productId: i.productId, name: i.name, variantLabel: i.variantLabel ?? null, quantity: i.quantity })),
        }),
      })
      const data: ChatResponse = await r.json()

      // Acciones que el backend pide ejecutar sin click del usuario.
      // Caso típico: el cliente dijo "dale agregalo" y el LLM Understand
      // detectó intent=add_to_cart; el backend ya validó contra los
      // productos que se mostraron antes, así que confiamos en la acción.
      if (Array.isArray(data.actions)) {
        for (const action of data.actions) {
          if (action.type === 'addToCart') {
            // El carrito suma de a una unidad por llamada
            const quantity = Math.max(1, Math.min(20, Math.round(action.quantity ?? 1)))
            for (let n = 0; n < quantity; n++) {
              addItem({
                productId:    action.productId,
                name:         action.name,
                image:        action.image || '',
                slug:         action.slug,
                variantLabel: action.variantLabel ?? undefined,
                unitPrice:    action.unitPrice,
              })
            }
            addToast({ message: `✓ ${quantity > 1 ? `${quantity} × ` : ''}${action.name} agregado 🐾`, type: 'success' })
          } else if (action.type === 'removeFromCart') {
            // Mismo id que arma el carrito: productId + variante
            const itemId = `${action.productId}${action.variantLabel ? `-${action.variantLabel}` : ''}`
            const item = useCartStore.getState().items.find((i) => i.id === itemId)
            if (!item) continue
            if (action.quantity && action.quantity < item.quantity) {
              useCartStore.getState().updateQuantity(itemId, item.quantity - action.quantity)
            } else {
              useCartStore.getState().removeItem(itemId)
            }
            addToast({ message: `${action.name} quitado del carrito`, type: 'success' })
          }
        }
        // No se abre el carrito: quedaba debajo del chat, los dos encimados. El vendedor
        // ya confirma lo que hizo, hay un aviso y el contador del carrito se actualiza.
      }

      const botMsg: ChatMessage = {
        id:    'b-' + Date.now(),
        from:  'bot',
        text:  data.reply || '…',
        cards: Array.isArray(data.cards) ? data.cards : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      }
      setMessages((prev) => [...prev, botMsg])
      if (!isOpen) setHasUnread(true)
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id:   's-' + Date.now(),
          from: 'system',
          text: 'No pude conectar con el agente, probá de nuevo en un toque.',
        },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleAddToCart(card: ChatCard) {
    addItem({
      productId:    card.productId,
      name:         card.name,
      image:        card.image || '',
      slug:         card.slug,
      variantLabel: card.variantLabel ?? undefined,
      unitPrice:    card.unitPrice,
    })
    addToast({ message: `✓ ${card.name} agregado 🐾`, type: 'success' })
  }

  // Ir al carrito desde el chat: se cierra el chat para que no tape el carrito
  function goToCart() {
    setIsOpen(false)
    openDrawer()
  }

  // Evita hydration mismatch: SSR devuelve null, el browser monta tras hydratar.
  if (!mounted) return null

  if (hiddenHere && !isOpen) return null

  return (
    <>
      {/* Burbuja flotante. Con el carrito abierto se oculta: si no, queda encima de "Ir al checkout". */}
      {(!isDrawerOpen || isOpen) && (
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
        className={cn(
          // A 4rem del borde: más abajo tapaba los links del pie ("Admin") en el celular
          'fixed z-[9998] bottom-16 right-5 h-14 w-14 rounded-full shadow-card',
          'flex items-center justify-center transition-transform',
          'bg-mk-orange hover:bg-mk-orange-dark active:scale-95',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mk-orange/40',
        )}
      >
        {isOpen ? (
          <span className="text-2xl text-white" aria-hidden>×</span>
        ) : (
          <span className="text-2xl text-white" aria-hidden>🐾</span>
        )}
        {!isOpen && hasUnread && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-mk-error rounded-full ring-2 ring-white animate-bounce-badge" />
        )}
      </button>
      )}

      {/* Panel del chat */}
      {isOpen && (
        <div
          className={cn(
            // Arriba del botón (4rem + su alto + el mismo aire de antes)
            'fixed z-[9999] bottom-[8.75rem] right-5 max-w-[calc(100vw-2.5rem)]',
            'w-[380px] h-[560px] max-h-[calc(100vh-9.75rem)]',
            'bg-white rounded-card shadow-card-hover flex flex-col overflow-hidden',
            'animate-fade-in border border-black/5',
          )}
          role="dialog"
          aria-label="Chat con MK-Pets"
        >
          {/* Header */}
          <div className="bg-mk-orange text-white px-4 py-3 flex items-center gap-3">
            <span className="text-xl" aria-hidden>🐾</span>
            <div className="flex-1">
              <div className="font-display font-bold text-sm leading-tight">
                MK-Pets · Vendedor Estrella
              </div>
              <div className="text-xs opacity-90">Listo para ayudarte</div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/90 hover:text-white text-2xl leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-mk-light/40">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onAdd={handleAddToCart}
                // "Ir al carrito" abre el carrito directamente: no hace falta preguntarle al vendedor
                onSuggest={(text) => (/^\s*(ir|ver|abrir)\s+(al\s+|el\s+|mi\s+)?carrito\s*$/i.test(text) ? goToCart() : send(text))}
              />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-mk-mid text-sm pl-1">
                <span className="inline-block w-2 h-2 rounded-full bg-mk-orange animate-pulse" />
                <span className="inline-block w-2 h-2 rounded-full bg-mk-orange animate-pulse" style={{ animationDelay: '0.15s' }} />
                <span className="inline-block w-2 h-2 rounded-full bg-mk-orange animate-pulse" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
          </div>

          {/* Input */}
          <form
            className="border-t border-black/5 bg-white p-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu mensaje..."
              maxLength={500}
              className={cn(
                'flex-1 px-3 py-2 rounded-pill text-sm',
                'bg-mk-light/60 border border-transparent focus:border-mk-orange',
                'focus:outline-none focus:ring-2 focus:ring-mk-orange/30',
              )}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className={cn(
                'px-4 py-2 rounded-pill font-semibold text-sm text-white',
                'bg-mk-orange hover:bg-mk-orange-dark disabled:bg-mk-mid/30 disabled:cursor-not-allowed',
                'transition-colors',
              )}
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  )
}

function MessageBubble({
  message,
  onAdd,
  onSuggest,
}: {
  message: ChatMessage
  onAdd:     (card: ChatCard) => void
  onSuggest: (text: string)   => void
}) {
  if (message.from === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-mk-orange text-white px-3 py-2 rounded-card rounded-br-sm text-sm max-w-[80%] break-words">
          {message.text}
        </div>
      </div>
    )
  }
  if (message.from === 'system') {
    return (
      <div className="text-center text-xs text-mk-mid italic">{message.text}</div>
    )
  }
  // bot
  return (
    <div className="flex flex-col gap-2 max-w-[90%]">
      {message.text && (
        <div className="bg-white text-mk-dark px-3 py-2 rounded-card rounded-bl-sm text-sm shadow-sm">
          {message.text}
        </div>
      )}
      {message.cards && message.cards.length > 0 && (
        <div className="flex flex-col gap-2">
          {message.cards.map((c) => (
            <CardItem key={c.productId + (c.variantLabel || '')} card={c} onAdd={onAdd} />
          ))}
        </div>
      )}
      {message.suggestions && message.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.suggestions.slice(0, 3).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSuggest(s)}
              className={cn(
                'px-3 py-1.5 rounded-pill text-xs font-medium',
                'border border-mk-orange text-mk-orange bg-white',
                'hover:bg-mk-orange-light transition-colors',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CardItem({ card, onAdd }: { card: ChatCard; onAdd: (c: ChatCard) => void }) {
  const off = discountPct(card.unitPrice, card.originalPrice)
  return (
    <div className="bg-white rounded-card p-2.5 flex gap-2.5 shadow-sm border border-black/5">
      <div className="w-16 h-16 flex-shrink-0 rounded-chip bg-mk-light/60 overflow-hidden flex items-center justify-center">
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image}
            alt={card.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <span className="text-2xl" aria-hidden>🐾</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {card.badge && (
          <span
            className={cn(
              'inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-chip mb-1 tracking-wide',
              card.badge === 'OFERTA'
                ? 'bg-mk-success text-white'
                : card.badge === 'MÁS VENDIDO'
                ? 'bg-mk-orange text-white'
                : 'bg-mk-navy text-white',
            )}
          >
            {card.badge}
          </span>
        )}
        <div className="font-semibold text-xs text-mk-dark leading-tight mb-1 line-clamp-2">
          {card.name}
          {card.variantLabel ? ` · ${card.variantLabel}` : ''}
        </div>
        <div className="flex items-baseline gap-1.5 mb-1.5">
          {off !== null && card.originalPrice && (
            <>
              <span className="text-[10px] text-mk-mid line-through">
                {formatPrice(card.originalPrice)}
              </span>
              <span className="text-[10px] font-bold bg-mk-success text-white px-1 rounded-chip">
                -{off}%
              </span>
            </>
          )}
          <span className="font-display font-bold text-base text-mk-orange leading-none">
            {formatPrice(card.unitPrice)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAdd(card)}
          className={cn(
            'w-full px-3 py-1.5 rounded-pill text-xs font-bold text-white',
            'bg-mk-orange hover:bg-mk-orange-dark active:scale-95 transition',
          )}
        >
          {card.ctaLabel || 'Agregar al carrito'}
        </button>
      </div>
    </div>
  )
}
