-- ─────────────────────────────────────────────────────────────────────────────
-- MK-Pets chat: RPCs que el flow de n8n consulta vía REST API.
-- Idempotente: pueden correrse cuantas veces quieras.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) search_product_with_alternatives(query)
--
-- Devuelve { exact: product | null, alternatives: product[] }.
-- Estrategia de match:
--   a) match exacto contra el nombre completo (ILIKE %query%)
--   b) fallback por cada palabra >=3 chars de la query
--   c) si nada hace match con stock, intenta inferir categoría (incluso sin stock)
--   d) alternatives = otros productos activos con stock de la misma categoría,
--      o búsqueda libre por keyword si la categoría no se pudo inferir
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_product_with_alternatives(query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  q            text := lower(trim(coalesce(query, '')));
  exact_prod   jsonb;
  exact_cat    text;
  alts         jsonb;
  words        text[];
  w            text;
BEGIN
  IF q = '' THEN
    RETURN jsonb_build_object('exact', null, 'alternatives', '[]'::jsonb);
  END IF;

  -- a) match exacto con stock
  SELECT to_jsonb(p) || jsonb_build_object(
           'variants', coalesce(
             (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.price)
              FROM "ProductVariant" v WHERE v."productId" = p.id),
             '[]'::jsonb)
         ),
         p."categoryId"
  INTO exact_prod, exact_cat
  FROM "Product" p
  WHERE p."isActive" AND p.stock > 0 AND lower(p.name) ILIKE '%' || q || '%'
  ORDER BY p."isFeatured" DESC,
           position(q in lower(p.name)) ASC,
           p."createdAt" DESC
  LIMIT 1;

  -- b) fallback por palabra significativa
  IF exact_prod IS NULL THEN
    words := regexp_split_to_array(q, '\s+');
    FOREACH w IN ARRAY words LOOP
      IF length(w) >= 3 THEN
        SELECT to_jsonb(p) || jsonb_build_object(
                 'variants', coalesce(
                   (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.price)
                    FROM "ProductVariant" v WHERE v."productId" = p.id),
                   '[]'::jsonb)
               ),
               p."categoryId"
        INTO exact_prod, exact_cat
        FROM "Product" p
        WHERE p."isActive" AND p.stock > 0 AND lower(p.name) ILIKE '%' || w || '%'
        ORDER BY p."isFeatured" DESC,
                 position(w in lower(p.name)) ASC,
                 p."createdAt" DESC
        LIMIT 1;
        EXIT WHEN exact_prod IS NOT NULL;
      END IF;
    END LOOP;
  END IF;

  -- c) inferir categoría incluso si no había stock (para sugerir alternativas)
  IF exact_prod IS NULL THEN
    SELECT p."categoryId"
    INTO exact_cat
    FROM "Product" p
    WHERE p."isActive" AND lower(p.name) ILIKE '%' || q || '%'
    ORDER BY p."isFeatured" DESC, p."createdAt" DESC
    LIMIT 1;
  END IF;

  -- d) alternatives
  SELECT coalesce(jsonb_agg(item ORDER BY (item->>'isFeatured')::boolean DESC, item->>'name'), '[]'::jsonb)
  INTO alts
  FROM (
    SELECT to_jsonb(p) || jsonb_build_object(
             'variants', coalesce(
               (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.price)
                FROM "ProductVariant" v WHERE v."productId" = p.id),
               '[]'::jsonb)
           ) AS item
    FROM "Product" p
    WHERE p."isActive" AND p.stock > 0
      AND (
        (exact_cat IS NOT NULL AND p."categoryId" = exact_cat)
        OR (exact_cat IS NULL AND EXISTS (
             SELECT 1 FROM unnest(regexp_split_to_array(q,'\s+')) qw
             WHERE length(qw) >= 3 AND lower(p.name) ILIKE '%' || qw || '%'
           ))
      )
      AND (exact_prod IS NULL OR p.id <> (exact_prod->>'id'))
    ORDER BY p."isFeatured" DESC, p."createdAt" DESC
    LIMIT 5
  ) s;

  RETURN jsonb_build_object('exact', exact_prod, 'alternatives', alts);
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) top_promos(limit_n, category_slug)
-- Productos con originalPrice o badge='sale'.
-- limit_n = 0 devuelve [] (lo usa el flow v1 para el caso intent='chat').
-- category_slug (opcional): filtra promos por categoría — usado por v2 para
-- "ofertas en humedo gato" → top_promos(6, 'humedos').
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION top_promos(limit_n integer DEFAULT 6, category_slug text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH cat AS (
    SELECT id FROM "Category" WHERE slug = category_slug LIMIT 1
  )
  SELECT coalesce(jsonb_agg(item ORDER BY (item->>'isFeatured')::boolean DESC), '[]'::jsonb)
  FROM (
    SELECT to_jsonb(p) || jsonb_build_object(
             'variants', coalesce(
               (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.price)
                FROM "ProductVariant" v WHERE v."productId" = p.id),
               '[]'::jsonb)
           ) AS item
    FROM "Product" p
    WHERE p."isActive" AND p.stock > 0
      AND (p."originalPrice" IS NOT NULL OR p.badge = 'sale')
      AND (category_slug IS NULL OR p."categoryId" = (SELECT id FROM cat))
    ORDER BY p."isFeatured" DESC, p."createdAt" DESC
    LIMIT GREATEST(limit_n, 0)
  ) s;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) categories_with_sample() — usada por el flow v2 (LLM Understand)
-- Devuelve la lista de categorías con un sample de 4 productos por categoría,
-- para que el LLM sepa qué pertenece a cada slug.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION categories_with_sample()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(jsonb_agg(item ORDER BY item->>'order'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
             'slug', c.slug,
             'name', c.name,
             'emoji', c.emoji,
             'order', c."order",
             'sample_products', coalesce((
               SELECT jsonb_agg(jsonb_build_object('name', p.name, 'slug', p.slug, 'badge', p.badge))
               FROM (
                 SELECT name, slug, badge
                 FROM "Product" p2
                 WHERE p2."categoryId" = c.id AND p2."isActive" AND p2.stock > 0
                 ORDER BY p2."isFeatured" DESC, p2."createdAt" DESC
                 LIMIT 4
               ) p
             ), '[]'::jsonb)
           ) AS item
    FROM "Category" c
  ) s;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) products_by_category(category_slug, limit_n)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION products_by_category(category_slug text, limit_n integer DEFAULT 6)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH cat AS (SELECT id FROM "Category" WHERE slug = category_slug LIMIT 1)
  SELECT coalesce(jsonb_agg(item), '[]'::jsonb)
  FROM (
    SELECT to_jsonb(p) || jsonb_build_object(
             'variants', coalesce(
               (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.price)
                FROM "ProductVariant" v WHERE v."productId" = p.id),
               '[]'::jsonb)
           ) AS item
    FROM "Product" p, cat
    WHERE p."categoryId" = cat.id
      AND p."isActive" AND p.stock > 0
    ORDER BY p."isFeatured" DESC, p."createdAt" DESC
    LIMIT limit_n
  ) s;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION search_product_with_alternatives(text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION top_promos(integer, text)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION products_by_category(text, integer)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION categories_with_sample()                TO anon, authenticated;
