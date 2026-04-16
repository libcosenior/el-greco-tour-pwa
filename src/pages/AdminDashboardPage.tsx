import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type ThemeStyleVars = CSSProperties & Record<`--${string}`, string>

type Departure = {
  id: string
  trip_code: string
  start_date: string
  end_date: string
  days_count: number
  nights_count: number
  price_double: number
  price_triple: number
  price_quad: number
  bus_surcharge: number
  double_total: number
  triple_total: number
  quad_total: number
  double_occupied: number
  triple_occupied: number
  quad_occupied: number
  published: boolean
  sort_order: number | null
  note: string | null
}

type OccupiedKey = 'double_occupied' | 'triple_occupied' | 'quad_occupied'
type TotalKey = 'double_total' | 'triple_total' | 'quad_total'

type ApartmentStepperProps = {
  label: string
  occupied: number
  total: number
  isSaving: boolean
  onMinus: () => void
  onPlus: () => void
}

function formatDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('sk-SK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function freeCount(total: number, occupied: number): number {
  return Math.max(0, total - occupied)
}

function savingKey(departureId: string, occupiedKey: OccupiedKey): string {
  return `${departureId}:${occupiedKey}`
}

function ApartmentStepper({
  label,
  occupied,
  total,
  isSaving,
  onMinus,
  onPlus,
}: ApartmentStepperProps) {
  const free = freeCount(total, occupied)
  const minusDisabled = occupied <= 0 || isSaving
  const plusDisabled = occupied >= total || isSaving

  return (
    <section style={stepperCardStyle}>
      <div style={stepperHeaderStyle}>
        <div style={stepperLabelStyle}>{label}</div>

        <div style={stepperTopInfoStyle}>
          <span>Obsadené</span>
          <strong>{occupied}</strong>
        </div>
      </div>

      <div style={stepperRowStyle}>
        <button type="button" onClick={onMinus} style={stepperButtonStyle(minusDisabled)} disabled={minusDisabled}>
          −
        </button>

        <div style={countBoxStyle}>{occupied}</div>

        <button type="button" onClick={onPlus} style={stepperButtonStyle(plusDisabled)} disabled={plusDisabled}>
          +
        </button>
      </div>

      <div style={stepperFooterStyle}>
        <div style={freeBadgeStyle}>Voľné {free} z {total}</div>
        {isSaving ? <div style={savingTextStyle}>Ukladám...</div> : null}
      </div>
    </section>
  )
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()

  const [departures, setDepartures] = useState<Departure[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  async function loadDepartures() {
    setErrorText('')

    const { data, error } = await supabase
      .from('departures')
      .select(`
        id,
        trip_code,
        start_date,
        end_date,
        days_count,
        nights_count,
        price_double,
        price_triple,
        price_quad,
        bus_surcharge,
        double_total,
        triple_total,
        quad_total,
        double_occupied,
        triple_occupied,
        quad_occupied,
        published,
        sort_order,
        note
      `)
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true })

    if (error) {
      setErrorText('Nepodarilo sa načítať termíny.')
      setDepartures([])
      setLoading(false)
      return
    }

    setDepartures((data ?? []) as Departure[])
    setLoading(false)
  }

  useEffect(() => {
    let alive = true

    async function init() {
      await loadDepartures()
    }

    init()

    const channel = supabase
      .channel('admin-departures-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'departures',
        },
        async () => {
          if (!alive) return
          await loadDepartures()
        },
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

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

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      navigate('/admin/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  async function handleAdjust(
    departureId: string,
    occupiedKey: OccupiedKey,
    totalKey: TotalKey,
    delta: number,
  ) {
    const item = departures.find((departure) => departure.id === departureId)
    if (!item) return

    const currentValue = item[occupiedKey]
    const totalValue = item[totalKey]
    const nextValue = clamp(currentValue + delta, 0, totalValue)

    if (nextValue === currentValue) return

    const key = savingKey(departureId, occupiedKey)

    if (savingMap[key]) return

    setErrorText('')
    setSuccessText('')

    setDepartures((prev) =>
      prev.map((departure) =>
        departure.id === departureId
          ? { ...departure, [occupiedKey]: nextValue }
          : departure,
      ),
    )

    setSavingMap((prev) => ({ ...prev, [key]: true }))

    const { error } = await supabase
      .from('departures')
      .update({ [occupiedKey]: nextValue })
      .eq('id', departureId)

    if (error) {
      setDepartures((prev) =>
        prev.map((departure) =>
          departure.id === departureId
            ? { ...departure, [occupiedKey]: currentValue }
            : departure,
        ),
      )
      setErrorText('Zmena sa neuložila. Skús ešte raz.')
    } else {
      setSuccessText('Zmena uložená.')
      window.setTimeout(() => {
        setSuccessText('')
      }, 1400)
    }

    setSavingMap((prev) => ({ ...prev, [key]: false }))
  }

  const themeVars: ThemeStyleVars = {
    '--page-bg': isDarkMode
      ? 'linear-gradient(180deg, #020617 0%, #0f172a 24%, #111827 100%)'
      : 'linear-gradient(180deg, #eef4fb 0%, #f8fafc 100%)',
    '--text-main': isDarkMode ? '#e5eef7' : '#0f172a',
    '--text-strong': isDarkMode ? '#ffffff' : '#0f172a',
    '--text-secondary': isDarkMode ? '#cbd5e1' : '#475569',
    '--text-muted': isDarkMode ? '#94a3b8' : '#64748b',
    '--hero-bg': isDarkMode
      ? 'linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(17,24,39,0.96) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.96) 100%)',
    '--hero-border': isDarkMode ? 'rgba(71,85,105,0.72)' : '#e2e8f0',
    '--hero-shadow': isDarkMode
      ? '0 10px 26px rgba(0,0,0,0.30)'
      : '0 10px 26px rgba(15,23,42,0.06)',
    '--card-bg': isDarkMode ? '#0f172a' : '#ffffff',
    '--card-border': isDarkMode ? '#334155' : '#e2e8f0',
    '--card-shadow': isDarkMode
      ? '0 10px 26px rgba(0,0,0,0.26)'
      : '0 10px 26px rgba(15,23,42,0.06)',
    '--soft-bg': isDarkMode ? '#111827' : '#f8fafc',
    '--soft-border': isDarkMode ? '#334155' : '#e2e8f0',
    '--pill-bg': isDarkMode ? '#0b1220' : '#eff6ff',
    '--pill-border': isDarkMode ? '#1d4ed8' : '#bfdbfe',
    '--pill-text': isDarkMode ? '#93c5fd' : '#1d4ed8',
    '--date-bg': isDarkMode ? '#0b1220' : '#f8fafc',
    '--date-border': isDarkMode ? '#334155' : '#e2e8f0',
    '--date-text': isDarkMode ? '#ffffff' : '#0f172a',
    '--button-dark': isDarkMode ? '#1e293b' : '#0f172a',
    '--button-dark-disabled': isDarkMode ? '#334155' : '#cbd5e1',
    '--button-dark-text': '#ffffff',
    '--count-bg': isDarkMode ? '#0b1220' : '#ffffff',
    '--count-border': isDarkMode ? '#475569' : '#cbd5e1',
    '--count-text': isDarkMode ? '#ffffff' : '#0f172a',
    '--free-bg': isDarkMode ? '#082f49' : '#eff6ff',
    '--free-border': isDarkMode ? '#155e75' : '#bfdbfe',
    '--free-text': isDarkMode ? '#bae6fd' : '#1e3a8a',
    '--saving-text': isDarkMode ? '#67e8f9' : '#1d4ed8',
    '--danger-bg': isDarkMode ? '#3f1d1d' : '#fef2f2',
    '--danger-text': isDarkMode ? '#fca5a5' : '#b91c1c',
    '--success-bg': isDarkMode ? '#052e16' : '#f0fdf4',
    '--success-text': isDarkMode ? '#86efac' : '#166534',
    '--note-bg': isDarkMode ? '#3b2412' : '#fff7ed',
    '--note-border': isDarkMode ? '#9a3412' : '#fed7aa',
    '--note-text': isDarkMode ? '#fdba74' : '#9a3412',
    '--secondary-link-bg': isDarkMode ? '#0b1220' : '#ffffff',
    '--secondary-link-border': isDarkMode ? '#475569' : '#cbd5e1',
    '--secondary-link-text': isDarkMode ? '#93c5fd' : '#1d4ed8',
  }

  if (loading) {
    return (
      <main
        style={{
          ...themeVars,
          ...loadingPageStyle,
          colorScheme: isDarkMode ? 'dark' : 'light',
        }}
      >
        Načítavam admin termíny...
      </main>
    )
  }

  return (
    <main
      style={{
        ...themeVars,
        ...pageStyle,
        colorScheme: isDarkMode ? 'dark' : 'light',
      }}
    >
      <div style={containerStyle}>
        <section style={heroCardStyle}>
          <div style={heroTopRowStyle}>
            <div style={heroTextWrapStyle}>
              <div style={eyebrowStyle}>ADMIN</div>
              <h1 style={titleStyle}>Správa obsadenosti</h1>
              <p style={textStyle}>
                Meníš len obsadené apartmány. Verejná stránka dopočíta voľné automaticky.
              </p>
            </div>

            <div style={actionsWrapStyle}>
              <Link to="/" style={secondaryLinkButtonStyle}>
                Verejná stránka
              </Link>

              <button type="button" onClick={handleLogout} style={logoutButtonStyle} disabled={loggingOut}>
                {loggingOut ? 'Odhlasujem...' : 'Odhlásiť sa'}
              </button>
            </div>
          </div>
        </section>

        {errorText ? <div style={errorStyle}>{errorText}</div> : null}
        {successText ? <div style={successStyle}>{successText}</div> : null}

        {departures.length === 0 ? (
          <div style={emptyCardStyle}>V databáze zatiaľ nie sú žiadne termíny.</div>
        ) : (
          <div style={cardsGridStyle}>
            {departures.map((item) => {
              const doubleSaving = !!savingMap[savingKey(item.id, 'double_occupied')]
              const tripleSaving = !!savingMap[savingKey(item.id, 'triple_occupied')]
              const quadSaving = !!savingMap[savingKey(item.id, 'quad_occupied')]

              return (
                <article key={item.id} style={cardStyle}>
                  <div style={cardHeaderStyle}>
                    <div style={tripCodePillStyle}>{item.trip_code}</div>

                    <div style={datePanelStyle}>
                      <div style={dateStyle}>
                        {formatDate(item.start_date)} – {formatDate(item.end_date)}
                      </div>

                      <div style={metaStyle}>
                        {item.days_count} dní / {item.nights_count} nocí
                      </div>
                    </div>
                  </div>

                  <div style={apartmentGridStyle}>
                    <ApartmentStepper
                      label="2-lôžkový apartmán"
                      occupied={item.double_occupied}
                      total={item.double_total}
                      isSaving={doubleSaving}
                      onMinus={() => handleAdjust(item.id, 'double_occupied', 'double_total', -1)}
                      onPlus={() => handleAdjust(item.id, 'double_occupied', 'double_total', 1)}
                    />

                    <ApartmentStepper
                      label="3-lôžkový apartmán"
                      occupied={item.triple_occupied}
                      total={item.triple_total}
                      isSaving={tripleSaving}
                      onMinus={() => handleAdjust(item.id, 'triple_occupied', 'triple_total', -1)}
                      onPlus={() => handleAdjust(item.id, 'triple_occupied', 'triple_total', 1)}
                    />

                    <ApartmentStepper
                      label="4-lôžkový apartmán"
                      occupied={item.quad_occupied}
                      total={item.quad_total}
                      isSaving={quadSaving}
                      onMinus={() => handleAdjust(item.id, 'quad_occupied', 'quad_total', -1)}
                      onPlus={() => handleAdjust(item.id, 'quad_occupied', 'quad_total', 1)}
                    />
                  </div>

                  {item.note && item.note.trim().length > 0 ? (
                    <div style={noteStyle}>
                      <strong>Poznámka:</strong> {item.note}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--page-bg)',
  color: 'var(--text-main)',
  fontFamily: 'Arial, sans-serif',
  padding: '14px 10px 28px',
  boxSizing: 'border-box',
}

const loadingPageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--page-bg)',
  color: 'var(--text-secondary)',
  fontFamily: 'Arial, sans-serif',
  fontSize: 20,
}

const containerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 920,
  margin: '0 auto',
}

const heroCardStyle: CSSProperties = {
  background: 'var(--hero-bg)',
  border: '1px solid var(--hero-border)',
  borderRadius: 22,
  padding: 16,
  boxShadow: 'var(--hero-shadow)',
  marginBottom: 14,
}

const heroTopRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 14,
  flexWrap: 'wrap',
}

const heroTextWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  flex: '1 1 320px',
}

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1.1,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.05,
  color: 'var(--text-strong)',
}

const textStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.45,
  color: 'var(--text-secondary)',
}

const actionsWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  alignItems: 'center',
}

const logoutButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 16px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--button-dark)',
  color: 'var(--button-dark-text)',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryLinkButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 16px',
  borderRadius: 12,
  border: '1px solid var(--secondary-link-border)',
  background: 'var(--secondary-link-bg)',
  color: 'var(--secondary-link-text)',
  fontSize: 15,
  fontWeight: 800,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
}

const errorStyle: CSSProperties = {
  borderRadius: 14,
  padding: '11px 13px',
  background: 'var(--danger-bg)',
  color: 'var(--danger-text)',
  fontSize: 14,
  fontWeight: 800,
  marginBottom: 12,
}

const successStyle: CSSProperties = {
  borderRadius: 14,
  padding: '11px 13px',
  background: 'var(--success-bg)',
  color: 'var(--success-text)',
  fontSize: 14,
  fontWeight: 800,
  marginBottom: 12,
}

const emptyCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 18,
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  boxShadow: 'var(--card-shadow)',
  fontSize: 16,
  color: 'var(--text-secondary)',
}

const cardsGridStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const cardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  borderRadius: 20,
  padding: 14,
  border: '1px solid var(--card-border)',
  boxShadow: 'var(--card-shadow)',
  display: 'grid',
  gap: 14,
}

const cardHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const tripCodePillStyle: CSSProperties = {
  justifySelf: 'start',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--pill-bg)',
  border: '1px solid var(--pill-border)',
  color: 'var(--pill-text)',
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
}

const datePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 12,
  borderRadius: 16,
  background: 'var(--date-bg)',
  border: '1px solid var(--date-border)',
}

const dateStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: 'var(--date-text)',
  lineHeight: 1.2,
  textAlign: 'center',
}

const metaStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textAlign: 'center',
}

const apartmentGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const stepperCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 16,
  background: 'var(--soft-bg)',
  border: '1px solid var(--soft-border)',
}

const stepperHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const stepperLabelStyle: CSSProperties = {
  fontSize: 17,
  lineHeight: 1.2,
  fontWeight: 800,
  color: 'var(--text-strong)',
}

const stepperTopInfoStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  fontSize: 14,
  color: 'var(--text-secondary)',
}

const stepperRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'nowrap',
}

const stepperButtonStyle = (disabled: boolean): CSSProperties => ({
  width: 52,
  height: 52,
  borderRadius: 14,
  border: 'none',
  background: disabled ? 'var(--button-dark-disabled)' : 'var(--button-dark)',
  color: 'var(--button-dark-text)',
  fontSize: 30,
  fontWeight: 900,
  lineHeight: 1,
  cursor: disabled ? 'not-allowed' : 'pointer',
  flex: '0 0 auto',
})

const countBoxStyle: CSSProperties = {
  minWidth: 68,
  height: 52,
  borderRadius: 14,
  background: 'var(--count-bg)',
  border: '1px solid var(--count-border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  fontWeight: 900,
  color: 'var(--count-text)',
  flex: '1 1 auto',
}

const stepperFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const freeBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  background: 'var(--free-bg)',
  border: '1px solid var(--free-border)',
  color: 'var(--free-text)',
  fontSize: 13,
  fontWeight: 800,
}

const savingTextStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--saving-text)',
  fontWeight: 800,
}

const noteStyle: CSSProperties = {
  borderRadius: 14,
  padding: '12px 14px',
  background: 'var(--note-bg)',
  border: '1px solid var(--note-border)',
  color: 'var(--note-text)',
  fontSize: 14,
  lineHeight: 1.45,
}