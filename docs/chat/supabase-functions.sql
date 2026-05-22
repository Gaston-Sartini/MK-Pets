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
-- 2) top_promos(limit_n)
-- Productos con originalPrice o badge='sale'.
-- limit_n = 0 devuelve [] (lo usa el flow para el caso intent='chat').
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION top_promos(limit_n integer DEFAULT 6)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
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
    ORDER BY p."isFeatured" DESC, p."createdAt" DESC
    LIMIT GREATEST(limit_n, 0)
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
GRANT EXECUTE ON FUNCTION top_promos(integer)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION products_by_category(text, integer)     TO anon, authenticated;
