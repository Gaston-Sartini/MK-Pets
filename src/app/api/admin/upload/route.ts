import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

const BUCKET = 'products'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB per file
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

/** Pick a clean extension from the file type or original name. */
function extFromFile(file: File): string {
  const fromType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'image/gif':  'gif',
    'image/avif': 'avif',
  }
  if (fromType[file.type]) return fromType[file.type]
  const dot = file.name.lastIndexOf('.')
  if (dot === -1) return 'bin'
  return file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
}

/** ¿Los primeros bytes son los de un JPG, PNG, GIF, WebP o AVIF? */
function looksLikeImage(b: Uint8Array): boolean {
  const ascii = (from: number, text: string) => [...text].every((ch, i) => b[from + i] === ch.charCodeAt(0))
  return (
    (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) ||                       // JPG
    (b[0] === 0x89 && ascii(1, 'PNG')) ||                                      // PNG
    ascii(0, 'GIF8') ||                                                        // GIF
    (ascii(0, 'RIFF') && ascii(8, 'WEBP')) ||                                  // WebP
    (ascii(4, 'ftyp') && (ascii(8, 'avif') || ascii(8, 'avis')))               // AVIF
  )
}

/** Upload a product image. Returns the public URL. */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Esperaba multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo (campo "file")' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Tipo no permitido: ${file.type || 'desconocido'}. Usá JPG, PNG, WebP, GIF o AVIF.` },
      { status: 415 },
    )
  }

  // El tipo que declara el navegador se puede falsear: se mira cómo empieza el archivo.
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (!looksLikeImage(head)) {
    return NextResponse.json({ error: 'El archivo no es una imagen válida.' }, { status: 415 })
  }

  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return NextResponse.json(
      { error: `La imagen pesa ${mb} MB. Máximo permitido: 5 MB.` },
      { status: 413 },
    )
  }

  // Build a unique key: products/yyyy-mm/<random>.<ext>
  const ext = extFromFile(file)
  const now = new Date()
  const yyyymm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const random = crypto.randomUUID()
  const objectPath = `${yyyymm}/${random}.${ext}`

  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, bytes, {
      contentType: file.type,
      cacheControl: '31536000', // 1 year — files are immutable (random names)
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `No se pudo subir: ${uploadError.message}` },
      { status: 500 },
    )
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)

  return NextResponse.json({
    url:  pub.publicUrl,
    path: objectPath,
  })
}

/** Delete an uploaded image. Body: { path: string } */
export async function DELETE(req: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  let body: { path?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const path = body.path?.trim()
  if (!path || path.length > 300 || path.startsWith('/') || path.includes('..')) {
    return NextResponse.json({ error: '"path" inválido' }, { status: 400 })
  }

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
