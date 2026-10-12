import { describe, it, expect } from 'vitest'
import {
  asksCheapest, asksTotal, cartTotal, quantityChange, biggerPackTip, buildResponse, catalogForPrompt, complementFor, deniedButExists, fixMisnamedRequest, hasAddIntent,
  hasRemoveIntent, inferVariant, isClosing, isReferential, lostAdd, matchVariant, mentionedProducts, parseWeightKg,
  pickByStatedWeight, recoverFailedGeneration, sanitizeCart, sanitizeHistory, shownInLastTurn, speciesOf,
  type CatalogProduct, type ChatTurn,
} from '@/lib/chat/engine'

// Un catálogo chico con la misma forma que el real: con y sin variantes, de gato y de perro.
const product = (id: string, name: string, category: string, price: number, variants: [string, number][] = [], extra: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id, name, slug: id, category, description: null, image: '', price, originalPrice: null, stock: 10, badge: null,
  variants: variants.map(([label, variantPrice]) => ({ label, price: variantPrice, originalPrice: null, stock: 10 })),
  ...extra,
})

const whiskas  = product('whiskas', 'Whiskas Húmedo 85g', 'Húmedos', 1800)
const catChow  = product('catchow', 'Cat Chow Húmedo 85g', 'Húmedos', 2500)
const ester    = product('ester', 'Old Prince Cordero Gatos Esterilizados', 'Gatos', 33000, [['3 KG', 33000], ['7,5 KG', 70000]])
const premium  = product('premium', 'Old Prince Premium Gatos 1 KG', 'Gatos', 7300)
const adultos  = product('adultos', 'Purina Excellent Adultos', 'Gatos', 8300, [['1 KG', 8300], ['2 KG', 16000]])
const catit    = product('catit', 'Catit Creamy Snacks para Gatos', 'Snacks', 4800, [['Salmón (4 tubos)', 4800], ['Atún (4 tubos)', 4800]])
const proPlan  = product('proplan', 'Pro Plan Perro Adulto Razas Medianas 15kg', 'Perros', 32000, [], { stock: 8 })
const biscrok  = product('biscrok', 'Pedigree Biscrok 100g', 'Snacks', 2500)
const wetDog   = product('wetdog', 'Alimento Húmedo Perro 100g', 'Húmedos', 2000, [['Carne', 2000], ['Pollo', 2000]])
const minino   = product('minino', 'Piedritas Minino 12,5 KG', 'Higiene', 10000)
const urinary  = product('urinary', 'Purina Excellent Urinary', 'Gatos', 11500, [['1 KG', 11500], ['7,5 KG', 68000]])
const sensitive = product('sensitive', 'Purina PRO PLAN Sensitive Skin 7,5 KG', 'Perros', 80000)
const catalog  = [whiskas, catChow, ester, premium, adultos, catit, proPlan, biscrok, wetDog, minino]

const user = (text: string): ChatTurn => ({ role: 'user', text })
const bot  = (text: string): ChatTurn => ({ role: 'assistant', text })
const adds = (res: ReturnType<typeof buildResponse>) => (res.actions ?? []).filter(a => a.type === 'addToCart')
const removes = (res: ReturnType<typeof buildResponse>) => (res.actions ?? []).filter(a => a.type === 'removeFromCart')

describe('chat engine: leer lo que escribió la persona', () => {
  it('entiende pesos en kilos y en gramos', () => {
    expect(parseWeightKg('el de 7,5 KG')).toBe(7.5)
    expect(parseWeightKg('3 kilos')).toBe(3)
    expect(parseWeightKg('Whiskas Húmedo 85g')).toBe(0.085)
    expect(parseWeightKg('el de salmón')).toBeNull()
  })

  it('deduce para qué animal es un producto, también por la marca', () => {
    expect(speciesOf(whiskas)).toBe('gato')
    expect(speciesOf(minino)).toBe('gato')
    expect(speciesOf(biscrok)).toBe('perro')
    expect(speciesOf(proPlan)).toBe('perro')
    expect(speciesOf({ name: 'Shampoo neutro', category: 'Higiene corporal' })).toBeNull()
  })

  it('reconoce la variante aunque esté escrita de otra forma', () => {
    expect(matchVariant(ester.variants, '3 kilos')?.label).toBe('3 KG')
    expect(matchVariant(ester.variants, '7.5kg')?.label).toBe('7,5 KG')
    expect(matchVariant(catit.variants, 'salmon')?.label).toBe('Salmón (4 tubos)')
    expect(matchVariant(ester.variants, '20 KG')).toBeNull()
    expect(matchVariant(ester.variants, undefined)).toBeNull()
  })

  it('deduce la variante del mensaje o de lo único que se mostró', () => {
    expect(inferVariant(ester, 'dale, el de 3 kilos', [])?.label).toBe('3 KG')
    expect(inferVariant(catit, 'agregame el de atún', [])?.label).toBe('Atún (4 tubos)')
    const history = [bot('Te recomiendo este. [Mostré: Old Prince Cordero Gatos Esterilizados (7,5 KG)]')]
    expect(inferVariant(ester, 'agregalo', history)?.label).toBe('7,5 KG')
    expect(inferVariant(ester, 'agregalo', [])).toBeNull()
  })

  it('encuentra los productos que la persona nombró', () => {
    expect(mentionedProducts('tenés whiskas?', catalog)).toEqual([whiskas])
    expect(mentionedProducts('agregame un whiskas y un cat chow', catalog)).toEqual([whiskas, catChow])
    expect(mentionedProducts('tenés correas para gatos?', catalog)).toEqual([])
  })

  it('lee las tarjetas que la persona tiene a la vista', () => {
    const history = [user('hola'), bot('Mirá estos. [Mostré: Old Prince Cordero Gatos Esterilizados (3 KG); Whiskas Húmedo 85g]')]
    expect(shownInLastTurn(history, catalog)).toEqual([
      { product: ester, variant: ester.variants[0] },
      { product: whiskas, variant: null },
    ])
    expect(shownInLastTurn([bot('Hola')], catalog)).toEqual([])
  })
})

describe('chat engine: intención', () => {
  it('solo ve intención de agregar cuando se pide', () => {
    expect(hasAddIntent('agregalo', [])).toBe(true)
    expect(hasAddIntent('lo quiero', [])).toBe(true)
    expect(hasAddIntent('Cambialo por 7,5 KG', [])).toBe(true)
    expect(hasAddIntent('tenés arena?', [])).toBe(false)
    expect(hasAddIntent('sí', [bot('¿Querés que lo sume al carrito?')])).toBe(true)
    expect(hasAddIntent('sí', [bot('¿Es para perro o para gato?')])).toBe(false)
  })

  it('distingue un mensaje que solo señala lo que tiene a la vista', () => {
    for (const text of ['dale, agregame el de 3 kilos', 'sí, sumalo', 'agregame el segundo', 'lo quiero', 'igual agregame el de 3']) {
      expect(isReferential(text), text).toBe(true)
    }
    for (const text of ['agregame la arena más barata', 'agregame el whiskas', 'dame 2 del de pollo', 'agregame otro']) {
      expect(isReferential(text), text).toBe(false)
    }
  })

  it('reconoce una despedida, pero no un pedido que termina en gracias', () => {
    for (const text of ['no, nada más, gracias', 'listo, gracias', 'gracias, lo pienso y vuelvo', 'chau', 'No, gracias']) {
      expect(isClosing(text), text).toBe(true)
    }
    for (const text of ['agregame un whiskas, gracias', 'gracias! cuánto tarda el envío?', 'tenés arena?']) {
      expect(isClosing(text), text).toBe(false)
    }
  })

  it('solo ve intención de sacar cuando se pide', () => {
    expect(hasRemoveIntent('sacame el whiskas', [])).toBe(true)
    expect(hasRemoveIntent('mejor el de 7,5', [])).toBe(true)
    expect(hasRemoveIntent('ese no lo quiero', [])).toBe(true)
    expect(hasRemoveIntent('qué otro húmedo tenés?', [])).toBe(false)
    expect(hasRemoveIntent('dale', [bot('¿Te lo cambio por el de 7,5 KG?')])).toBe(true)
  })
})

describe('chat engine: controles sobre lo que dice el modelo', () => {
  it('detecta un "lo agregué" que no vino con ningún producto válido', () => {
    expect(lostAdd({ reply: 'Listo, lo sumé al carrito.', addToCart: [] }, catalog)).toBe(true)
    expect(lostAdd({ reply: 'Ya lo agregué.', addToCart: [{ id: 'inventado' }] }, catalog)).toBe(true)
    expect(lostAdd({ reply: 'Listo, lo sumé.', addToCart: [{ id: 'whiskas' }] }, catalog)).toBe(false)
    expect(lostAdd({ reply: '¡Listo! Cuando quieras, entrá al carrito.', addToCart: [] }, catalog)).toBe(false)
  })

  it('detecta cuando niega tener algo que está en el catálogo', () => {
    expect(deniedButExists({ reply: 'No, no tenemos Whiskas.', products: [] }, 'tenés whiskas?', catalog)).toEqual([whiskas])
    expect(deniedButExists({ reply: 'No tenemos correas.', products: [] }, 'tenés correas?', catalog)).toEqual([])
    expect(deniedButExists({ reply: 'Sí, lo tenemos.', products: [{ id: 'whiskas' }] }, 'tenés whiskas?', catalog)).toEqual([])
  })

  it('no deja pasar una palabra del cliente deformada', () => {
    expect(fixMisnamedRequest('No tenemos chochas.', 'busco una cucha para mi perro')).toBe('No tenemos eso.')
    expect(fixMisnamedRequest('No tenemos correas.', 'tenés correas?')).toBe('No tenemos correas.')
  })

  it('rescata el texto de una respuesta rechazada por no ser JSON', () => {
    const body = JSON.stringify({ error: { code: 'json_validate_failed', failed_generation: 'Solo puedo ayudarte con la tienda.' } })
    expect(recoverFailedGeneration(body)).toEqual({ reply: 'Solo puedo ayudarte con la tienda.' })
    expect(recoverFailedGeneration(JSON.stringify({ error: { failed_generation: '' } }))).toBeNull()
    expect(recoverFailedGeneration('no es json')).toBeNull()
  })

  it('si la persona dijo un peso, elige el producto de ese peso', () => {
    const history = [bot('Te recomiendo este. [Mostré: Old Prince Cordero Gatos Esterilizados (3 KG)]')]
    // El modelo eligió otro Old Prince, de 1 KG
    expect(pickByStatedWeight({ product: premium, variant: null }, 'dale, agregame el de 3 kilos', history, catalog))
      .toEqual({ product: ester, variant: ester.variants[0] })
    // Misma marca, variante equivocada
    expect(pickByStatedWeight({ product: ester, variant: ester.variants[0] }, 'el de 7,5 kg', [], catalog).variant?.label).toBe('7,5 KG')
    // El peso del mensaje no es de ningún producto a la vista: se respeta lo elegido
    expect(pickByStatedWeight({ product: proPlan, variant: null }, 'mi perro pesa 20 kilos, agregame el pro plan', [], catalog).product).toBe(proPlan)
    // Nombró dos pesos y el modelo eligió uno de ellos: no se toca
    expect(pickByStatedWeight({ product: ester, variant: ester.variants[1] }, 'tenía el de 3 kilos, ahora quiero el de 7,5 kg', [], catalog).variant?.label).toBe('7,5 KG')
  })

  it('avisa del envase grande solo cuando sale bastante menos por kilo', () => {
    expect(biggerPackTip(ester, '3 KG')).toMatchObject({ label: '7,5 KG' })
    expect(biggerPackTip(ester, '3 KG')?.text).toContain('Dato: el de 7,5 KG')
    expect(biggerPackTip(ester, '7,5 KG')).toBeNull()
    expect(biggerPackTip(adultos, '1 KG')).toBeNull()   // 3,6 % de diferencia: no vale la pena avisar
    expect(biggerPackTip(whiskas, null)).toBeNull()
  })

  it('el complemento es de otra categoría y para el mismo animal', () => {
    expect(complementFor(adultos, catalog)).toBe(whiskas)
    expect(complementFor(proPlan, catalog)).toBe(wetDog)
    expect(complementFor(whiskas, catalog)).toBe(catit)
  })
})

describe('chat engine: armado de la respuesta', () => {
  const ctx = (message: string, history: ChatTurn[] = [], cart: Parameters<typeof sanitizeCart>[0] = []) =>
    ({ message, history, cart: sanitizeCart(cart) })

  it('una pregunta no agrega nada, aunque el modelo lo intente', () => {
    const res = buildResponse({ reply: 'Listo, lo sumé al carrito.', addToCart: [{ id: 'whiskas' }] }, catalog, ctx('tenés whiskas?'))
    expect(res.actions).toEqual([])
    expect(res.cards.map(c => c.productId)).toEqual(['whiskas'])
    expect(res.reply).not.toMatch(/sum[eé]/)
  })

  it('si falta elegir la variante, pregunta y muestra todas', () => {
    const res = buildResponse({ reply: 'Listo, lo sumé.', addToCart: [{ id: 'ester' }] }, catalog, ctx('agregame el old prince esterilizados'))
    expect(res.actions).toEqual([])
    expect(res.cards.map(c => c.variantLabel)).toEqual(['3 KG', '7,5 KG'])
    expect(res.reply).toContain('3 KG o 7,5 KG')
  })

  it('respeta la cantidad pedida', () => {
    const three = buildResponse({ reply: 'Listo, sumé 3.', addToCart: [{ id: 'whiskas', quantity: 3 }] }, catalog, ctx('sumame 3 whiskas'))
    expect(adds(three)).toEqual([expect.objectContaining({ productId: 'whiskas', quantity: 3 })])
  })

  it('si pide más de lo que hay, suma lo que queda y lo dice', () => {
    const many = buildResponse({ reply: 'Listo, sumé 50.', addToCart: [{ id: 'proplan', quantity: 50 }] }, catalog, ctx('agregame 50 pro plan'))
    expect(adds(many)).toEqual([expect.objectContaining({ productId: 'proplan', quantity: 8 })])
    expect(many.reply).toContain('nos quedan 8')

    // Contando lo que ya tiene en el carrito
    const inCart = [{ productId: 'proplan', name: proPlan.name, quantity: 8 }]
    const none = buildResponse({ reply: 'Listo, sumé 1.', addToCart: [{ id: 'proplan' }] }, catalog, ctx('agregame otro pro plan', [], inCart))
    expect(adds(none)).toEqual([])
    expect(none.reply).toContain('todo lo que nos queda')

    // Con stock de sobra, el tope es lo que se puede sumar de una vez
    const bulk = buildResponse({ reply: 'Listo.', addToCart: [{ id: 'bigstock', quantity: 60 }] },
      [...catalog, product('bigstock', 'Arena Económica 4 KG', 'Higiene', 3000, [], { stock: 500 })], ctx('agregame 60 arena económica'))
    expect(adds(bulk)).toEqual([expect.objectContaining({ quantity: 20 })])
    expect(bulk.reply).toContain('hasta 20 por vez')
  })

  it('si acepta el cambio de envase, saca el chico y suma el grande', () => {
    const cart = [{ productId: 'ester', name: ester.name, variantLabel: '3 KG', quantity: 1 }]
    const history = [user('agregame el de 3 kilos'), bot('Listo, sumé el de 3 KG al carrito. Dato: el de 7,5 KG sale $9.333 el kilo, contra $11.000 de este. ¿Te lo cambio?')]
    // Aunque el modelo no mande nada útil
    const yes = buildResponse({ reply: '¡Dale!' }, catalog, ctx('dale', history, cart))
    expect((yes.actions ?? []).map(a => `${a.type}:${a.variantLabel}`)).toEqual(['removeFromCart:3 KG', 'addToCart:7,5 KG'])
    expect(yes.reply).toBe('Listo, te lo cambié por el de 7,5 KG.')

    const no = buildResponse({ reply: 'Perfecto, queda el de 3 KG.' }, catalog, ctx('no, dejalo así', history, cart))
    expect(no.actions).toEqual([])
  })

  it('saca caracteres invisibles de la respuesta', () => {
    const soft = String.fromCharCode(0xAD)
    expect(buildResponse({ reply: `No tenemos chu${soft}chas.` }, catalog, ctx('busco una cucha')).reply).toBe('No tenemos eso.')
  })

  it('no manda a un carrito vacío al despedirse', () => {
    const res = buildResponse({ reply: '¡Dale! Cuando quieras, entrá al carrito para terminar la compra.', suggestions: ['Ir al carrito', 'Ver snacks'] }, catalog, ctx('gracias, lo pienso y vuelvo'))
    expect(res.reply).not.toContain('carrito')
    expect(res.suggestions).toEqual(['Ver snacks'])
  })

  it('si bloquea un agregado que nadie pidió, igual nombra el producto', () => {
    const res = buildResponse({ reply: 'Listo, lo sumé.', addToCart: [{ id: 'biscrok' }] }, catalog, ctx('algo para premiar a mi perro'))
    expect(res.actions).toEqual([])
    expect(res.reply).toContain('Tenemos Pedigree Biscrok 100g.')
  })

  it('corrige un producto equivocado cuando la persona dijo el peso', () => {
    const history = [user('tengo un gato castrado'), bot('Te recomiendo este. [Mostré: Old Prince Cordero Gatos Esterilizados (3 KG)]')]
    const res = buildResponse({ reply: 'Listo, sumé el de 3 KG.', addToCart: [{ id: 'premium', variant: '3 KG' }] }, catalog, ctx('dale, agregame el de 3 kilos', history))
    expect(adds(res)).toEqual([expect.objectContaining({ productId: 'ester', variantLabel: '3 KG', unitPrice: 33000 })])
  })

  it('"agregame ese / el de 3 / el segundo" se resuelve contra lo que tiene a la vista', () => {
    // Se mostró un solo producto y el modelo mandó otro parecido, diciendo "el de 3 KG"
    const compared = [user('me conviene el de 3 o el de 7,5?'), bot('Por kilo te conviene el de 7,5 KG. [Mostré: Old Prince Cordero Gatos Esterilizados (7,5 KG); Old Prince Cordero Gatos Esterilizados (3 KG)]')]
    const bare = buildResponse({ reply: 'Listo, sumé el de 3 KG al carrito.', addToCart: [{ id: 'premium' }] }, catalog, ctx('igual agregame el de 3', compared))
    expect(adds(bare)).toEqual([expect.objectContaining({ productId: 'ester', variantLabel: '3 KG' })])

    const one = [bot('Sí, lo tenemos. [Mostré: Whiskas Húmedo 85g]')]
    const that = buildResponse({ reply: 'Listo, lo sumé.', addToCart: [{ id: 'catchow' }] }, catalog, ctx('dale, agregalo', one))
    expect(adds(that)).toEqual([expect.objectContaining({ productId: 'whiskas' })])

    const two = [bot('Tenemos dos. [Mostré: Cat Chow Húmedo 85g; Whiskas Húmedo 85g]')]
    const second = buildResponse({ reply: 'Listo, lo sumé.', addToCart: [{ id: 'catchow' }] }, catalog, ctx('agregame el segundo', two))
    expect(adds(second)).toEqual([expect.objectContaining({ productId: 'whiskas' })])

    // Si nombra o describe otra cosa, no se toca lo que eligió el modelo
    const other = buildResponse({ reply: 'Listo, sumé la arena.', addToCart: [{ id: 'minino' }] }, catalog, ctx('agregame la arena minino', one))
    expect(adds(other)).toEqual([expect.objectContaining({ productId: 'minino' })])
  })

  it('si nombra un producto y manda otro, vale el que nombra', () => {
    const shown = buildResponse({ reply: 'Sí, lo tenemos: Old Prince Cordero Gatos Esterilizados, pensado para gatos castrados.', products: [{ id: 'premium' }] }, catalog, ctx('tenés alimento para gato castrado?'))
    expect(shown.cards.map(c => `${c.productId}:${c.variantLabel}`)).toEqual(['ester:3 KG', 'ester:7,5 KG'])

    const added = buildResponse({ reply: 'Listo, sumé Whiskas al carrito.', addToCart: [{ id: 'catchow' }] }, catalog, ctx('agregame un whiskas'))
    expect(adds(added)).toEqual([expect.objectContaining({ productId: 'whiskas' })])

    // Si lo que muestra también está nombrado, no hay contradicción
    const both = buildResponse({ reply: 'Tenemos Whiskas y Cat Chow.', products: [{ id: 'whiskas' }, { id: 'catchow' }] }, catalog, ctx('húmedo para gato'))
    expect(both.cards.map(c => c.productId)).toEqual(['whiskas', 'catchow'])
  })

  it('entiende los productos por su slug o por su id', () => {
    const custom = [{ ...whiskas, id: 'c0191ff609e1affbd09ab6a4', slug: 'whiskas-humedo-85g' }]
    expect(buildResponse({ reply: 'x', products: [{ id: 'whiskas-humedo-85g' }] }, custom).cards[0].productId).toBe('c0191ff609e1affbd09ab6a4')
    expect(buildResponse({ reply: 'x', products: [{ id: 'c0191ff609e1affbd09ab6a4' }] }, custom).cards).toHaveLength(1)
    expect(catalogForPrompt(custom)).toMatch(/^whiskas-humedo-85g \| /)
  })

  it('al comparar qué conviene, muestra primero lo que menos sale por kilo', () => {
    const res = buildResponse({ reply: 'Por kilo te conviene el de 2 KG.', products: [{ id: 'adultos', variant: '1 KG' }, { id: 'adultos', variant: '2 KG' }] }, catalog, ctx('me conviene el de 1 kilo o el de 2?'))
    expect(res.cards.map(c => c.variantLabel)).toEqual(['2 KG', '1 KG'])
  })

  it('la confirmación de lo que se sumó la arma el código, con nombre, variante y cantidad', () => {
    const res = buildResponse({ reply: 'Listo, sumé la más barata.', addToCart: [{ id: 'catit', variant: 'Atún (4 tubos)', quantity: 2 }] }, catalog,
      ctx('sumame 2 catit de atún y nada más'))
    expect(res.reply).toBe('Listo, sumé 2 × Catit Creamy Snacks para Gatos de Atún (4 tubos) al carrito.')
  })

  it('si el modelo ya ofreció un complemento válido, respeta su pregunta con una sola tarjeta', () => {
    const res = buildResponse({ reply: 'Listo. ¿Te gustaría acompañarlo con un snack?', addToCart: [{ id: 'whiskas' }], products: [{ id: 'catit', variant: 'Salmón (4 tubos)' }, { id: 'catit', variant: 'Atún (4 tubos)' }] },
      catalog, ctx('sumame un whiskas'))
    expect(res.reply).toBe('Listo, sumé Whiskas Húmedo 85g al carrito. ¿Te gustaría acompañarlo con un snack?')
    expect(res.cards.map(c => c.variantLabel)).toEqual(['Salmón (4 tubos)'])
  })

  it('"lo más barato" se verifica contra los precios reales', () => {
    const sands = [...catalog, product('piedritas', 'Piedritas para Gatos 3,6 KG', 'Higiene', 5000), product('neutra', 'Arena Glutinante Neutra', 'Higiene', 7500, [['5,3 KG', 7500], ['15 KG', 15000]])]
    const shown = buildResponse({ reply: 'La más barata es la Arena Glutinante Neutra de 5,3 KG.', products: [{ id: 'neutra', variant: '5,3 KG' }] }, sands, ctx('tenés arena para gatos? la más barata'))
    expect(shown.cards[0].productId).toBe('piedritas')
    expect(shown.reply).toMatch(/^Lo más barato es Piedritas para Gatos 3,6 KG \(/)

    const added = buildResponse({ reply: 'Listo.', addToCart: [{ id: 'neutra', variant: '5,3 KG' }] }, sands, ctx('agregame la arena más barata'))
    expect(adds(added)).toEqual([expect.objectContaining({ productId: 'piedritas' })])

    // Con una condición puntual, lo más barato del rubro no es la respuesta
    expect(asksCheapest('el alimento más barato para gato castrado')).toBe(false)
    expect(asksCheapest('cuál es la arena más económica?')).toBe(true)
  })

  it('no afirma lo que nadie cargó: factura, local, mayorista', () => {
    expect(buildResponse({ reply: 'No emitimos factura A.' }, catalog, ctx('hacen factura A?')).reply).toMatch(/no lo tengo cargado.*WhatsApp/)
    expect(buildResponse({ reply: 'Sí, estamos en Av. Corrientes 1234.' }, catalog, ctx('tienen local? dónde queda?')).reply).toMatch(/^Somos tienda online/)
  })

  it('pasa al voseo las formas de "tú" que se le escapan al modelo', () => {
    expect(buildResponse({ reply: 'Avísame si quieres ver otra cosa; aquí estoy.' }, catalog, ctx('hola')).reply).toBe('Avisame si querés ver otra cosa; acá estoy.')
  })

  it('con dos productos pedidos, el peso de uno no pisa al otro ni se duplican', () => {
    const history = [bot('Mirá. [Mostré: Old Prince Cordero Gatos Esterilizados (3 KG); Old Prince Cordero Gatos Esterilizados (7,5 KG); Piedritas Minino 12,5 KG]')]
    const res = buildResponse({ reply: 'Listo, sumé los dos.', addToCart: [{ id: 'ester', variant: '7,5 KG' }, { id: 'minino' }] }, catalog, ctx('agregame el de 7,5 y la arena minino', history))
    expect(adds(res).map(a => `${a.productId}:${a.variantLabel}`)).toEqual(['ester:7,5 KG', 'minino:null'])

    const twice = buildResponse({ reply: 'Listo.', addToCart: [{ id: 'whiskas' }, { id: 'whiskas', quantity: 2 }] }, catalog, ctx('agregame whiskas, 3 en total y nada más'))
    expect(adds(twice)).toEqual([expect.objectContaining({ productId: 'whiskas', quantity: 3 })])
    expect(twice.reply).toBe('Listo, sumé 3 × Whiskas Húmedo 85g al carrito.')
  })

  it('el total del carrito lo calcula el código', () => {
    const cart = [{ productId: 'ester', name: ester.name, variantLabel: '7,5 KG', quantity: 2 }, { productId: 'whiskas', name: whiskas.name, quantity: 3 }]
    expect(cartTotal(sanitizeCart(cart), catalog)).toBe(145400)
    const res = buildResponse({ reply: 'Todo sale $215.000.' }, catalog, ctx('cuánto me sale todo?', [], cart))
    expect(res.reply).toMatch(/^Tu carrito suma \$\s?145\.400/)
    expect(buildResponse({ reply: 'Son $5.000.' }, catalog, ctx('cuánto es todo?')).reply).toBe('Todavía no tenés nada en el carrito.')
    expect(asksTotal('cuánto sale el envío de todo el pedido?')).toBe(false)
  })

  it('"mejor poneme 2" cambia la cantidad de lo último que sumó', () => {
    const cart = [{ productId: 'proplan', name: proPlan.name, quantity: 1 }]
    const history = [user('agregame el pro plan'), bot('Listo, sumé Pro Plan Perro Adulto Razas Medianas 15kg al carrito. ¿Querés sumar también Alimento Húmedo Perro 100g? Te lo dejo acá abajo. [Mostré: Alimento Húmedo Perro 100g (Carne)]')]
    // Aunque el modelo quiera sumar lo que se había ofrecido
    const more = buildResponse({ reply: 'Listo, sumé 2.', addToCart: [{ id: 'wetdog', variant: 'Carne', quantity: 2 }] }, catalog, ctx('mejor poneme 2', history, cart))
    expect(more.actions).toEqual([expect.objectContaining({ type: 'addToCart', productId: 'proplan', quantity: 1 })])
    expect(more.reply).toBe('Listo, ahora son 2 × Pro Plan Perro Adulto Razas Medianas 15kg en el carrito.')
    expect(more.cards).toEqual([])

    const fewer = buildResponse({ reply: 'Listo.' }, catalog, ctx('que sean 2', history, [{ ...cart[0], quantity: 5 }]))
    expect(fewer.actions).toEqual([expect.objectContaining({ type: 'removeFromCart', productId: 'proplan', quantity: 3 })])

    // Un tamaño no es una cantidad
    expect(quantityChange('mejor el de 7,5', history, sanitizeCart(cart), catalog)).toBeNull()
  })

  it('si pide sacar algo que no tiene, le dice qué hay en el carrito', () => {
    const res = buildResponse({ reply: 'Listo, la saqué.' }, catalog, ctx('sacame la arena', [], [{ productId: 'whiskas', name: whiskas.name, quantity: 2 }]))
    expect(res.actions).toEqual([])
    expect(res.reply).toBe('Eso no lo encontré en tu carrito. Ahora tenés: 2 × Whiskas Húmedo 85g.')
  })

  it('no inventa si se puede retirar', () => {
    expect(buildResponse({ reply: 'No contamos con punto de retiro.' }, catalog, ctx('y si lo paso a buscar?')).reply).toMatch(/^Somos tienda online/)
  })

  it('ignora el eco del carrito que a veces manda el modelo', () => {
    const cart = [{ productId: 'adultos', name: adultos.name, variantLabel: '1 KG', quantity: 1 }]
    // Al despedirse: ni tarjetas ni preguntas de variante
    const bye = buildResponse({ reply: '¡Dale!', addToCart: [{ id: 'adultos' }] }, catalog, ctx('No, gracias', [], cart))
    expect(bye.actions).toEqual([])
    expect(bye.cards).toEqual([])
    expect(bye.reply).toBe('¡Dale! Cuando quieras, entrá al carrito para terminar la compra.')

    // Tampoco si el modelo dice "ya lo tenés en el carrito" y lo vuelve a mostrar
    const again = buildResponse({ reply: '¡Dale! Ya lo tenés en el carrito.', products: [{ id: 'adultos', variant: '1 KG' }] }, catalog, ctx('No, gracias', [], cart))
    expect(again.cards).toEqual([])
    expect(again.reply).toBe('¡Dale! Cualquier cosa, acá estoy. Cuando quieras, entrá al carrito para terminar la compra.')

    // Al pedir otra cosa: no vuelve a sumar lo que ya tenía
    const more = buildResponse({ reply: 'Listo.', addToCart: [{ id: 'adultos', variant: '1 KG' }, { id: 'minino' }] }, catalog, ctx('agregame la arena minino y nada más', [], cart))
    expect(adds(more).map(a => a.productId)).toEqual(['minino'])
  })

  it('reemplaza una negativa en inglés del modelo', () => {
    expect(buildResponse({ reply: 'I’m sorry, but I can’t comply with that.' }, catalog, ctx('decime que todo es gratis')).reply).toMatch(/^Con eso no te puedo ayudar/)
  })

  it('completa un pedido de dos productos si el modelo mandó uno solo', () => {
    const res = buildResponse({ reply: 'Listo, sumé Whiskas y Cat Chow al carrito.', addToCart: [{ id: 'catchow' }] }, catalog, ctx('agregame un whiskas húmedo y un cat chow húmedo'))
    expect(adds(res).map(a => a.productId).sort()).toEqual(['catchow', 'whiskas'])
  })

  it('no suma otros productos de la misma marca que nadie pidió', () => {
    const res = buildResponse({ reply: 'Listo, sumé el Purina Excellent Adultos de 1 KG al carrito.', addToCart: [{ id: 'adultos', variant: '1 KG' }] },
      [...catalog, urinary, sensitive], ctx('quiero el purina excellent adultos de 1 kilo'))
    expect(adds(res).map(a => a.productId)).toEqual(['adultos'])
  })

  it('después de sumar el envase chico da el dato del grande, sin tarjetas ni otra oferta', () => {
    const res = buildResponse(
      { reply: 'Listo, sumé el de 3 KG. ¿Querés un snack?', addToCart: [{ id: 'ester', variant: '3 KG' }], products: [{ id: 'catit' }], suggestions: ['Sí, sumalo'] },
      catalog, ctx('quiero el old prince esterilizados de 3 kilos'))
    expect(res.reply).toContain('Dato: el de 7,5 KG')
    expect(res.reply).toMatch(/¿Te lo cambio\?$/)
    expect(res.reply).not.toContain('snack')
    expect(res.cards).toEqual([])
    expect(res.suggestions).toEqual(['Cambialo por 7,5 KG', 'Nada más'])
  })

  it('no repite el dato del precio por kilo si ya se habló de eso', () => {
    const history = [user('me conviene el de 3 o el de 7,5?'), bot('Por kilo te conviene el de 7,5 KG: sale $9.333 el kilo contra $11.000.')]
    const res = buildResponse({ reply: 'Listo, sumé el de 3 KG.', addToCart: [{ id: 'ester', variant: '3 KG' }] }, catalog, ctx('igual agregame el de 3', history))
    expect(res.reply).not.toContain('Dato:')
  })

  it('después de sumar ofrece un complemento concreto para el mismo animal', () => {
    const cat = buildResponse({ reply: 'Listo, sumé el de 1 KG. ¿Necesitás algo más?', addToCart: [{ id: 'adultos', variant: '1 KG' }] }, catalog, ctx('sumame el purina excellent adultos de 1 kilo'))
    expect(cat.cards.map(c => c.productId)).toEqual(['whiskas'])
    expect(cat.reply).toContain('¿Querés sumar también Whiskas Húmedo 85g?')
    expect(cat.reply).not.toContain('algo más')

    // El modelo ofreció algo de gato para un perro: se descarta y va uno de perro
    const dog = buildResponse({ reply: 'Listo, lo sumé.', addToCart: [{ id: 'proplan' }], products: [{ id: 'proplan' }, { id: 'catit' }] }, catalog, ctx('agregame el pro plan'))
    expect(dog.cards.map(c => c.productId)).toEqual(['wetdog'])
  })

  it('no ofrece lo que ya está en el carrito', () => {
    const res = buildResponse({ reply: 'Listo, lo sumé.', addToCart: [{ id: 'adultos', variant: '1 KG' }] }, catalog,
      ctx('sumame el purina excellent adultos de 1 kilo', [], [{ productId: 'whiskas', name: 'Whiskas Húmedo 85g', quantity: 1 }]))
    expect(res.cards.map(c => c.productId)).toEqual(['catchow'])
  })

  it('ofrece una sola vez por charla, y nunca si pidió nada más', () => {
    const history = [user('sumame un whiskas'), bot('Listo, sumé Whiskas al carrito. ¿Querés sumar también Catit? [Mostré: Catit Creamy Snacks para Gatos (Salmón (4 tubos))]')]
    const second = buildResponse({ reply: 'Listo, sumé la arena. ¿Querés un snack?', addToCart: [{ id: 'minino' }], products: [{ id: 'catit' }] }, catalog, ctx('agregame también la arena minino', history))
    expect(second.cards).toEqual([])
    expect(second.reply).toBe('Listo, sumé Piedritas Minino 12,5 KG al carrito.')

    const noMore = buildResponse({ reply: 'Listo, lo sumé.', addToCart: [{ id: 'whiskas' }] }, catalog, ctx('agregame un whiskas y nada más'))
    expect(noMore.cards).toEqual([])
  })

  it('saca del carrito lo que le piden, y solo eso', () => {
    const cart = [{ productId: 'whiskas', name: 'Whiskas Húmedo 85g', quantity: 3 }]
    const all = buildResponse({ reply: 'Listo, lo saqué.', removeFromCart: [{ id: 'whiskas' }] }, catalog, ctx('sacame el whiskas', [], cart))
    expect(removes(all)).toEqual([{ type: 'removeFromCart', productId: 'whiskas', name: 'Whiskas Húmedo 85g', variantLabel: null }])

    const one = buildResponse({ reply: 'Listo, saqué uno.', removeFromCart: [{ id: 'whiskas', quantity: 1 }] }, catalog, ctx('mejor sacame uno', [], cart))
    expect(removes(one)).toEqual([expect.objectContaining({ productId: 'whiskas', quantity: 1 })])

    // Sin pedido de sacar, no se saca aunque el modelo lo mande
    const none = buildResponse({ reply: 'Tenemos este otro.', removeFromCart: [{ id: 'whiskas' }], products: [{ id: 'catchow' }] }, catalog, ctx('qué otro húmedo tenés?', [], cart))
    expect(removes(none)).toEqual([])
  })

  it('no dice que sacó algo que no estaba en el carrito', () => {
    const res = buildResponse({ reply: 'Listo, la saqué del carrito.', removeFromCart: [{ id: 'minino' }] }, catalog,
      ctx('sacame la arena', [], [{ productId: 'whiskas', name: 'Whiskas Húmedo 85g', quantity: 1 }]))
    expect(res.actions).toEqual([])
    expect(res.reply).not.toMatch(/la saqu[eé]/)
  })

  it('un cambio saca lo viejo antes de sumar lo nuevo, sin ofrecer nada más', () => {
    const cart = [{ productId: 'ester', name: ester.name, variantLabel: '3 KG', quantity: 1 }]
    const res = buildResponse(
      { reply: 'Listo, te lo cambié por el de 7,5 KG.', addToCart: [{ id: 'ester', variant: '7,5 KG' }], removeFromCart: [{ id: 'ester', variant: '3 KG' }] },
      catalog, ctx('Cambialo por 7,5 KG', [], cart))
    expect((res.actions ?? []).map(a => `${a.type}:${a.variantLabel}`)).toEqual(['removeFromCart:3 KG', 'addToCart:7,5 KG'])
    expect(res.cards).toEqual([])
  })

  it('si niega un medio de pago, dice cuáles sí', () => {
    const res = buildResponse({ reply: 'No, no aceptamos tarjetas.' }, catalog, ctx('se puede pagar con tarjeta?'))
    expect(res.reply).toMatch(/Podés pagar por transferencia/)
  })

  it('en temas de salud siempre deriva al veterinario', () => {
    const res = buildResponse({ reply: 'Tenemos uno pensado para eso.', products: [{ id: 'ester' }] }, catalog, ctx('mi gato tuvo cálculos'))
    expect(res.reply).toMatch(/veterinario/)
  })

  it('al despedirse con cosas en el carrito recuerda cómo terminar la compra', () => {
    const cart = [{ productId: 'whiskas', name: 'Whiskas Húmedo 85g', quantity: 1 }]
    expect(buildResponse({ reply: '¡A la orden!' }, catalog, ctx('listo, gracias', [], cart)).reply).toContain('entrá al carrito')
    expect(buildResponse({ reply: '¡A la orden!' }, catalog, ctx('listo, gracias')).reply).toBe('¡A la orden!')
  })

  it('si solo pregunta el tamaño, nombra el producto que está mostrando', () => {
    const res = buildResponse({ reply: '¿Cuál te gustaría, 3 KG o 7,5 KG?', products: [{ id: 'ester', variant: '3 KG' }, { id: 'ester', variant: '7,5 KG' }] }, catalog, ctx('busco alimento para mi gata castrada'))
    expect(res.reply).toBe('Tenemos Old Prince Cordero Gatos Esterilizados. ¿Cuál te gustaría, 3 KG o 7,5 KG?')
  })

  it('si dice que sí lo tenemos sin mostrarlo, muestra lo que nombró la persona', () => {
    const res = buildResponse({ reply: 'Sí, lo tenemos.' }, catalog, ctx('tenés whiskas?'))
    expect(res.cards.map(c => c.productId)).toEqual(['whiskas'])
  })

  it('quita la anotación interna si el modelo la copia', () => {
    expect(buildResponse({ reply: 'Mirá este. [Mostré: Whiskas Húmedo 85g]', products: [{ id: 'whiskas' }] }, catalog).reply).toBe('Mirá este.')
  })
})

describe('chat engine: lo que manda el navegador', () => {
  it('limpia el carrito recibido', () => {
    expect(sanitizeCart([
      { productId: 'whiskas', name: '  Whiskas  ', variantLabel: null, quantity: 2.4 },
      { name: 'Arena', variantLabel: '15 KG', quantity: 'muchos' },
      { name: '' }, 'basura',
    ])).toEqual([
      { productId: 'whiskas', name: 'Whiskas', variantLabel: null, quantity: 2 },
      { name: 'Arena', variantLabel: '15 KG', quantity: 1 },
    ])
    expect(sanitizeCart('nada')).toEqual([])
  })

  it('al recortar un mensaje largo conserva lo que se mostró', () => {
    const [turn] = sanitizeHistory([{ role: 'assistant', text: `${'x'.repeat(900)} [Mostré: Whiskas Húmedo 85g]` }])
    expect(turn.text.endsWith('[Mostré: Whiskas Húmedo 85g]')).toBe(true)
    expect(turn.text.length).toBeLessThan(540)
  })
})
