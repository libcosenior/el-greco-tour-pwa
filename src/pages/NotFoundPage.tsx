import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={codeStyle}>404</div>
        <h1 style={titleStyle}>Stránka neexistuje</h1>
        <p style={textStyle}>
          Táto adresa v appke EL GRECO TOUR zatiaľ neexistuje.
        </p>

        <div style={linksRowStyle}>
          <Link to="/" style={primaryLinkStyle}>
            Ísť na verejnú stránku
          </Link>

          <Link to="/admin/login" style={secondaryLinkStyle}>
            Admin login
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  background: '#ffffff',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
  textAlign: 'center',
}

const codeStyle: CSSProperties = {
  fontSize: 64,
  fontWeight: 800,
  lineHeight: 1,
  color: '#111827',
}

const titleStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  fontSize: 32,
  lineHeight: 1.1,
  color: '#111827',
}

const textStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  fontSize: 18,
  color: '#475569',
}

const linksRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'center',
  flexWrap: 'wrap',
  marginTop: 24,
}

const primaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  padding: '0 18px',
  borderRadius: 14,
  background: '#111827',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
}

const secondaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  padding: '0 18px',
  borderRadius: 14,
  background: '#e2e8f0',
  color: '#111827',
  textDecoration: 'none',
  fontWeight: 700,
}