import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminLoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')

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

      navigate('/admin')
    } catch {
      setErrorText('Nastala chyba pri prihlasovaní.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={pageStyle}>
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
  background: '#f8fafc',
  fontFamily: 'Arial, sans-serif',
}

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  margin: '0 auto',
  background: '#ffffff',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.1,
}

const textStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  fontSize: 18,
  color: '#475569',
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
  color: '#111827',
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 52,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  padding: '0 14px',
  fontSize: 16,
}

const errorStyle: CSSProperties = {
  borderRadius: 14,
  padding: '12px 14px',
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: 15,
  fontWeight: 700,
}

const buttonStyle: CSSProperties = {
  height: 56,
  borderRadius: 16,
  border: 'none',
  background: '#111827',
  color: '#ffffff',
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
  color: '#1d4ed8',
  textDecoration: 'none',
  fontWeight: 700,
}