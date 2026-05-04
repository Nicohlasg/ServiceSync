import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  // SEC-H4: Validate redirect to prevent open redirect via protocol-relative URLs
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Safe to ignore from Server Components; middleware handles session refresh.
          }
        },
      },
    }
  )

  // --- Path 1: PKCE code exchange (OAuth: Google, Apple) ---
  const code = searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${await resolvePostAuthRedirect(supabase, next, origin)}`)
    }
    return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+link`)
  }

  // --- Path 2: Token hash exchange (email links: password reset, email confirmation) ---
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      // Password recovery always goes to /update-password regardless of `next`
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/update-password`)
      }
      // Email confirmation (signup) — check onboarding status
      return NextResponse.redirect(`${origin}${await resolvePostAuthRedirect(supabase, next, origin)}`)
    }
    return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+link`)
  }

  // No recognised params — send to error
  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+link`)
}

/**
 * After a successful auth exchange, decide where to send the user.
 * - If targeting the dashboard, check onboarding completion.
 * - Otherwise honour the `next` param.
 */
async function resolvePostAuthRedirect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  next: string,
  origin: string
): Promise<string> {
  if (next === '/dashboard' || next === '/') {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      if (!profile?.name) {
        return '/dashboard/onboarding'
      }
    }
  }
  return next
}
