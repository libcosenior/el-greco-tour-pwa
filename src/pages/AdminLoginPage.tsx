import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isUserAdmin } from '../lib/adminAccess'

type ThemeStyleVars = CSSProperties & Record<`--${string}`, string>

export default function AdminLoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDarkMode(event.matches)
    }

    setIsDarkMode(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorText('')

    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password

    if (!cleanEmail || !cleanPassword) {
      setErrorText('Zadaj e-mail aj heslo.')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      })

      if (error) {
        setErrorText('Prihlásenie sa nepodarilo. Skontroluj e-mail a heslo.')
        return
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setErrorText('Prihlásenie sa nepodarilo.')
        return
      }

      const admin = await isUserAdmin(session.user.id)

      if (!admin) {
        await supabase.auth.signOut()
        setErrorText('Tento účet nemá povolený admin prístup.')
        return
      }

      navigate('/admin', { replace: true })
    } catch {
      setErrorText('Nastala chyba pri prihlasovaní.')
    } finally {
      setLoading(false)
    }
  }

  const themeVars: ThemeStyleVars = {
    '--page-bg': isDarkMode
      ? 'linear-gradient(180deg, #020617 0%, #0f172a 24%, #111827 100%)'
      : '#f8fafc',
    '--card-bg': isDarkMode ? 'rgba(15,23,42,0.96)' : '#ffffff',
    '--card-border': isDarkMode ? '#334155' : '#e2e8f0',
    '--card-shadow': isDarkMode
      ? '0 10px 30px rgba(0,0,0,0.28)'
      : '0 10px 30px rgba(0,0,0,0.08)',
    '--text-main': isDarkMode ? '#f8fafc' : '#0f172a',
    '--text-secondary': isDarkMode ? '#cbd5e1' : '#475569',
    '--label-text': isDarkMode ? '#e5eef7' : '#111827',
    '--input-bg': isDarkMode ? '#0b1220' : '#ffffff',
    '--input-border': isDarkMode ? '#475569' : '#cbd5e1',
    '--input-text': isDarkMode ? '#f8fafc' : '#0f172a',
    '--error-bg': isDarkMode ? '#3f1d1d' : '#fef2f2',
    '--error-text': isDarkMode ? '#fca5a5' : '#b91c1c',
    '--button-bg': isDarkMode ? '#1e293b' : '#111827',
    '--button-text': '#ffffff',
    '--link-text': isDarkMode ? '#93c5fd' : '#1d4ed8',
    '--hint-bg': isDarkMode ? '#082f49' : '#eff6ff',
    '--hint-border': isDarkMode ? '#155e75' : '#bfdbfe',
    '--hint-text': isDarkMode ? '#bae6fd' : '#1e3a8a',
  }

  return (
    <main
      style={{
        ...themeVars,
        ...pageStyle,
        colorScheme: isDarkMode ? 'dark' : 'light',
      }}
    >
      <div style={cardStyle}>
        <h1 style={titleStyle}>Admin prihlásenie</h1>

        <p style={textStyle}>
          Prihlásenie do správy obsadenosti EL GRECO TOUR.
        </p>

        

        <form onSubmit={handleSubmit} style={formBoxStyle}>
          <label style={labelStyle}>
            E-mail
            <input
              type="email"
              placeholder="admin@elgreco.sk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={inputStyle}
              required
            />
          </label>

          <label style={labelStyle}>
            Heslo
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={inputStyle}
              required
            />
          </label>

          {errorText ? <div style={errorStyle}>{errorText}</div> : null}

          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
          </button>
        </form>

        <div style={linksRowStyle}>
          <Link to="/" style={secondaryLinkStyle}>
            Verejná stránka
          </Link>

          <Link to="/admin" style={secondaryLinkStyle}>
            Admin dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: 24,
  background: 'var(--page-bg)',
  fontFamily: 'Arial, sans-serif',
  boxSizing: 'border-box',
}

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  margin: '0 auto',
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 20,
  padding: 24,
  boxShadow: 'var(--card-shadow)',
  boxSizing: 'border-box',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.1,
  color: 'var(--text-main)',
}

const textStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  fontSize: 18,
  color: 'var(--text-secondary)',
}

const hintStyle: CSSProperties = {
  marginTop: 16,
  borderRadius: 14,
  padding: '12px 14px',
  background: 'var(--hint-bg)',
  border: '1px solid var(--hint-border)',
  color: 'var(--hint-text)',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.45,
}

const formBoxStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  marginTop: 24,
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--label-text)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 52,
  borderRadius: 14,
  border: '1px solid var(--input-border)',
  padding: '0 14px',
  fontSize: 16,
  background: 'var(--input-bg)',
  color: 'var(--input-text)',
  WebkitTextFillColor: 'var(--input-text)',
  caretColor: 'var(--input-text)',
}

const errorStyle: CSSProperties = {
  borderRadius: 14,
  padding: '12px 14px',
  background: 'var(--error-bg)',
  color: 'var(--error-text)',
  fontSize: 15,
  fontWeight: 700,
}

const buttonStyle: CSSProperties = {
  height: 56,
  borderRadius: 16,
  border: 'none',
  background: 'var(--button-bg)',
  color: 'var(--button-text)',
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
}

const linksRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 24,
}

const secondaryLinkStyle: CSSProperties = {
  color: 'var(--link-text)',
  textDecoration: 'none',
  fontWeight: 700,
}