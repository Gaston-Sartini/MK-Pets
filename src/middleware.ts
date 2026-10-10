import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/admin/login') return NextResponse.next()

  if (pathname.startsWith('/admin')) {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Propagate refreshed tokens to both request and response
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // getUser() validates the token server-side — more secure than getSession()
    const { data: { user } } = await supabase.auth.getUser()

    // Tener cuenta no alcanza: el panel exige app_metadata.role = 'admin'
    // (ver src/lib/admin-auth.ts).
    if (user?.app_metadata?.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
