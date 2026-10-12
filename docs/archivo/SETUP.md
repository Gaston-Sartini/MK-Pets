# MK-Pets — Guía de Setup para el Dev

## 1. Crear el proyecto Next.js

```bash
npx create-next-app@latest mkpets \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd mkpets
```

## 2. Instalar dependencias

```bash
npm install \
  @prisma/client prisma \
  zustand \
  mercadopago \
  zod \
  js-cookie \
  clsx tailwind-merge \
  lucide-react \
  @radix-ui/react-dialog \
  @radix-ui/react-toast

npm install -D @types/js-cookie prettier prettier-plugin-tailwindcss
```

## 3. Copiar archivos del proyecto

Copiar desde `D:\MK-Pets\` al proyecto:

```
tailwind.config.ts          → raíz del proyecto
middleware.ts               → raíz del proyecto
.env.example                → raíz (renombrar a .env.local y completar valores)
prisma/schema.prisma        → prisma/
src/app/globals.css         → src/app/
src/app/layout.tsx          → src/app/
src/app/(shop)/page.tsx     → src/app/(shop)/
src/app/(shop)/productos/   → src/app/(shop)/productos/
src/app/(shop)/producto/    → src/app/(shop)/producto/
src/app/api/                → src/app/api/
src/components/             → src/components/
src/store/                  → src/store/
src/lib/                    → src/lib/
src/types/                  → src/types/
```

## 4. Configurar la base de datos

```bash
# Crear archivo .env.local con DATABASE_URL
cp .env.example .env.local

# Inicializar Prisma y crear las tablas
npx prisma migrate dev --name init

# (Opcional) Ver la DB en el browser
npx prisma studio
```

## 5. Correr en desarrollo

```bash
npm run dev
# → http://localhost:3000
```

## 6. Componentes faltantes a implementar

Los siguientes componentes están especificados en `UI-COMPONENTS.tsx`
pero aún no tienen su archivo propio — copiar desde ahí:

- [ ] `src/components/layout/Navbar.tsx`
- [ ] `src/components/layout/HeroBanner.tsx`
- [ ] `src/components/layout/Footer.tsx`
- [ ] `src/components/layout/ShippingBanner.tsx`
- [ ] `src/components/cart/CartDrawer.tsx`
- [ ] `src/components/checkout/PaymentSelector.tsx`
- [ ] `src/components/checkout/StepIndicator.tsx`
- [ ] `src/components/checkout/OrderNumberDisplay.tsx`
- [ ] `src/components/ui/Toast.tsx`
- [ ] `src/components/ui/Button.tsx`
- [ ] `src/components/ui/Badge.tsx`

## 7. Assets de marca a agregar en /public

- [ ] `/public/logo.svg`         ← vectorizar desde D:\MK-Pets\Logo MK_Pets\Logo de MK-pets V2.1.png
- [ ] `/public/logo-white.svg`
- [ ] `/public/favicon.ico`
- [ ] `/public/og-image.png`
- [ ] `/public/assets/hero-main.webp` ← convertir D:\MK-Pets\Logo MK_Pets\Main.png

## 8. Próximos sprints

Ver `D:\MK-Pets\PROJECT.md` para el plan de sprints completo.
Siguiente: Sprint 3 (Checkout) → Sprint 4 (MercadoPago).
