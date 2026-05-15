/**
 * JsonLd — Generic JSON-LD structured data injector.
 * Renders a <script type="application/ld+json"> tag in the <head>.
 * Use with Next.js App Router: place inside Server Components only.
 */

interface JsonLdProps {
  data: Record<string, unknown>
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is safe structured data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
