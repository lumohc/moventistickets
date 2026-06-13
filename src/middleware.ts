import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Rotas protegidas do produtor (exceto login e cadastro)
  const protectedProdutor = path.startsWith('/produtor') &&
    !path.startsWith('/produtor/login') &&
    !path.startsWith('/produtor/cadastro')

  // Rotas protegidas do admin
  const protectedAdmin = path.startsWith('/admin')

  if ((protectedProdutor || protectedAdmin) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/produtor/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // Redireciona usuário logado que tenta acessar login/cadastro
  if (user && (path === '/produtor/login' || path === '/produtor/cadastro')) {
    const url = request.nextUrl.clone()
    url.pathname = '/produtor/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/produtor/:path*', '/admin/:path*'],
}
