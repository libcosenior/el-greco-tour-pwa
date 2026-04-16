import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type ThemeStyleVars = CSSProperties & Record<`--${string}`, string>

const FALLBACK_BUS_SURCHARGE_PER_PERSON = 160

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
  sort_order: number | null
  note: string | null
}

type ApartmentCompactRowProps = {
  label: string
  price: number
  free: number
  total: number
}

function formatDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('sk-SK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('sk-SK', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function freeCount(total: number, occupied: number): number {
  return Math.max(0, total - occupied)
}

function freeBadgeStyle(free: number, total: number): CSSProperties {
  const ratio = total > 0 ? free / total : 0

  if (ratio <= 0.2) {
    return {
      background: 'var(--badge-danger-bg)',
      color: 'var(--badge-danger-text)',
      border: '1px solid var(--badge-danger-border)',
    }
  }

  if (ratio <= 0.5) {
    return {
      background: 'var(--badge-warn-bg)',
      color: 'var(--badge-warn-text)',
      border: '1px solid var(--badge-warn-border)',
    }
  }

  return {
    background: 'var(--badge-ok-bg)',
    color: 'var(--badge-ok-text)',
    border: '1px solid var(--badge-ok-border)',
  }
}

function ApartmentCompactRow({ label, price, free, total }: ApartmentCompactRowProps) {
  return (
    <div style={apartmentRowStyle}>
      <div style={apartmentRowLeftStyle}>
        <div style={apartmentLabelStyle}>{label}</div>
        <div style={apartmentPriceStyle}>cena {formatPrice(price)}</div>
      </div>

      <div style={{ ...freeBadgeBaseStyle, ...freeBadgeStyle(free, total) }}>
        Voľné {free} z {total}
      </div>
    </div>
  )
}

export default function PublicHomePage() {
  const navigate = useNavigate()

  const [departures, setDepartures] = useState<Departure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminTarget, setAdminTarget] = useState('/admin/login')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const adminTapCountRef = useRef(0)
  const adminTapTimerRef = useRef<number | null>(null)

  async function loadDepartures() {
    setError(null)

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
        sort_order,
        note
      `)
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true })

    if (error) {
      setError('Nepodarilo sa načítať termíny.')
      setDepartures([])
      setLoading(false)
      return
    }

    setDepartures((data ?? []) as Departure[])
    setLoading(false)
  }

  function handleAdminSecretTap() {
    adminTapCountRef.current += 1

    if (adminTapTimerRef.current) {
      window.clearTimeout(adminTapTimerRef.current)
    }

    if (adminTapCountRef.current >= 5) {
      adminTapCountRef.current = 0
      adminTapTimerRef.current = null
      navigate(adminTarget)
      return
    }

    adminTapTimerRef.current = window.setTimeout(() => {
      adminTapCountRef.current = 0
      adminTapTimerRef.current = null
    }, 1500)
  }

  function handleRefreshTap() {
    const url = new URL(window.location.href)
    url.searchParams.set('_refresh', Date.now().toString())
    window.location.href = url.toString()
  }

  function handleOrderTripClick() {
    navigate('/objednavka')
  }

  useEffect(() => {
    let alive = true

    async function init() {
      const { data } = await supabase.auth.getSession()

      if (alive) {
        setAdminTarget(data.session ? '/admin' : '/admin/login')
      }

      await loadDepartures()
    }

    init()

    const departuresChannel = supabase
      .channel('public-departures-live')
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

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      setAdminTarget(session ? '/admin' : '/admin/login')
    })

    return () => {
      alive = false
      authSubscription.unsubscribe()
      supabase.removeChannel(departuresChannel)

      if (adminTapTimerRef.current) {
        window.clearTimeout(adminTapTimerRef.current)
      }
    }
  }, [navigate])

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

  const busSurchargePerPerson = useMemo(() => {
    const firstValue = departures.find((item) => typeof item.bus_surcharge === 'number')?.bus_surcharge
    return firstValue ?? FALLBACK_BUS_SURCHARGE_PER_PERSON
  }, [departures])

  const content = useMemo(() => {
    if (loading) {
      return <div style={stateCardStyle}>Načítavam termíny...</div>
    }

    if (error) {
      return <div style={{ ...stateCardStyle, color: 'var(--danger-text)' }}>{error}</div>
    }

    if (departures.length === 0) {
      return <div style={stateCardStyle}>Momentálne nie sú dostupné žiadne termíny.</div>
    }

    return (
      <div style={cardsGridStyle}>
        {departures.map((item) => {
          const freeDouble = freeCount(item.double_total, item.double_occupied)
          const freeTriple = freeCount(item.triple_total, item.triple_occupied)
          const freeQuad = freeCount(item.quad_total, item.quad_occupied)

          return (
            <article key={item.id} style={cardStyle}>
              <div style={cardGlowStyle} />

              <div style={cardHeaderStyle}>
                <div style={tripHeaderBoxStyle}>
                  <div style={topMiniLabelStyle}>ZÁJAZD</div>
                  <div style={tripCodeStyle}>{item.trip_code}</div>
                </div>

                <div style={datePanelStyle}>
                  <div style={topMiniLabelStyle}>TERMÍN</div>
                  <div style={datePanelDateStyle}>
                    {formatDate(item.start_date)} – {formatDate(item.end_date)}
                  </div>
                  <div style={datePanelMetaStyle}>
                    {item.days_count} dní / {item.nights_count} nocí
                  </div>
                </div>
              </div>

              <div style={sectionStyle}>
                <div style={sectionHeadingStyle}>Voľné apartmány</div>

                <div style={compactRowsGridStyle}>
                  <ApartmentCompactRow
                    label="Dvojlôžkový"
                    price={item.price_double}
                    free={freeDouble}
                    total={item.double_total}
                  />

                  <ApartmentCompactRow
                    label="Trojlôžkový"
                    price={item.price_triple}
                    free={freeTriple}
                    total={item.triple_total}
                  />

                  <ApartmentCompactRow
                    label="Štvorlôžkový"
                    price={item.price_quad}
                    free={freeQuad}
                    total={item.quad_total}
                  />
                </div>
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
    )
  }, [departures, error, loading])

  const themeVars: ThemeStyleVars = {
    '--page-bg': isDarkMode
      ? 'linear-gradient(180deg, #020617 0%, #0f172a 24%, #111827 100%)'
      : 'linear-gradient(180deg, #e8f4ff 0%, #f4f8fc 24%, #f6f8fb 100%)',
    '--text-main': isDarkMode ? '#f8fafc' : '#0f172a',
    '--text-strong': isDarkMode ? '#ffffff' : '#0f172a',
    '--text-secondary': isDarkMode ? '#cbd5e1' : '#475569',
    '--text-muted': isDarkMode ? '#94a3b8' : '#64748b',
    '--hero-card-bg': isDarkMode
      ? 'linear-gradient(145deg, rgba(15,23,42,0.96) 0%, rgba(17,24,39,0.94) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(240,249,255,0.94) 100%)',
    '--hero-card-border': isDarkMode ? 'rgba(71,85,105,0.68)' : 'rgba(255,255,255,0.8)',
    '--hero-card-shadow': isDarkMode
      ? '0 18px 50px rgba(0, 0, 0, 0.34)'
      : '0 18px 50px rgba(15, 23, 42, 0.08)',
    '--tag-bg': isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.82)',
    '--tag-border': isDarkMode ? 'rgba(71,85,105,0.72)' : 'rgba(148,163,184,0.25)',
    '--tag-text': isDarkMode ? '#f8fafc' : '#0f172a',
    '--info-card-bg': isDarkMode ? 'rgba(11,18,32,0.88)' : 'rgba(255,255,255,0.84)',
    '--info-card-border': isDarkMode ? 'rgba(71,85,105,0.78)' : 'rgba(226,232,240,0.9)',
    '--info-card-shadow': isDarkMode
      ? '0 8px 24px rgba(0, 0, 0, 0.24)'
      : '0 8px 24px rgba(15, 23, 42, 0.04)',
    '--state-bg': isDarkMode ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.9)',
    '--state-shadow': isDarkMode
      ? '0 14px 36px rgba(0, 0, 0, 0.26)'
      : '0 14px 36px rgba(15, 23, 42, 0.06)',
    '--card-bg': isDarkMode
      ? 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(17,24,39,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
    '--card-border': isDarkMode ? 'rgba(71,85,105,0.72)' : 'rgba(226,232,240,0.9)',
    '--card-shadow': isDarkMode
      ? '0 16px 42px rgba(0, 0, 0, 0.28)'
      : '0 16px 42px rgba(15, 23, 42, 0.07)',
    '--date-panel-bg': isDarkMode
      ? 'linear-gradient(180deg, rgba(8,47,73,0.86) 0%, rgba(15,23,42,0.9) 100%)'
      : 'linear-gradient(180deg, rgba(240,249,255,0.95) 0%, rgba(255,255,255,0.92) 100%)',
    '--date-panel-border': isDarkMode ? '#155e75' : '#dbeafe',
    '--date-panel-shadow': isDarkMode
      ? 'inset 0 1px 0 rgba(186,230,253,0.08)'
      : 'inset 0 1px 0 rgba(255,255,255,0.75)',
    '--row-bg': isDarkMode ? 'rgba(11,18,32,0.92)' : 'rgba(248,250,252,0.96)',
    '--row-border': isDarkMode ? '#334155' : '#e2e8f0',
    '--note-bg': isDarkMode ? '#3b2412' : '#fff7ed',
    '--note-border': isDarkMode ? '#9a3412' : '#fed7aa',
    '--note-text': isDarkMode ? '#fdba74' : '#9a3412',
    '--danger-text': isDarkMode ? '#fca5a5' : '#b91c1c',
    '--badge-danger-bg': isDarkMode ? '#3f1d1d' : '#fef2f2',
    '--badge-danger-text': isDarkMode ? '#fca5a5' : '#b91c1c',
    '--badge-danger-border': isDarkMode ? '#7f1d1d' : '#fecaca',
    '--badge-warn-bg': isDarkMode ? '#3b2412' : '#fff7ed',
    '--badge-warn-text': isDarkMode ? '#fdba74' : '#c2410c',
    '--badge-warn-border': isDarkMode ? '#9a3412' : '#fdba74',
    '--badge-ok-bg': isDarkMode ? '#052e16' : '#f0fdf4',
    '--badge-ok-text': isDarkMode ? '#86efac' : '#166534',
    '--badge-ok-border': isDarkMode ? '#166534' : '#bbf7d0',
    '--button-shadow': isDarkMode
      ? '0 16px 34px rgba(20, 184, 166, 0.18)'
      : '0 16px 34px rgba(15, 118, 110, 0.28)',
    '--fixed-bar-bg': isDarkMode
      ? 'linear-gradient(180deg, rgba(2,6,23,0) 0%, rgba(2,6,23,0.88) 32%, rgba(2,6,23,1) 100%)'
      : 'linear-gradient(180deg, rgba(246,248,251,0) 0%, rgba(246,248,251,0.9) 32%, rgba(246,248,251,1) 100%)',
    '--orb-top': isDarkMode
      ? 'radial-gradient(circle, rgba(20,184,166,0.16) 0%, rgba(20,184,166,0) 72%)'
      : 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 72%)',
    '--orb-bottom': isDarkMode
      ? 'radial-gradient(circle, rgba(45,212,191,0.14) 0%, rgba(45,212,191,0) 72%)'
      : 'radial-gradient(circle, rgba(16,185,129,0.16) 0%, rgba(16,185,129,0) 72%)',
    '--card-glow': isDarkMode
      ? 'radial-gradient(circle, rgba(45,212,191,0.16) 0%, rgba(45,212,191,0) 72%)'
      : 'radial-gradient(circle, rgba(125,211,252,0.22) 0%, rgba(125,211,252,0) 72%)',
  }

  return (
    <main
      style={{
        ...themeVars,
        ...pageStyle,
        colorScheme: isDarkMode ? 'dark' : 'light',
      }}
    >
      <div style={backgroundOrbTopStyle} />
      <div style={backgroundOrbBottomStyle} />

      <div style={containerStyle}>
        <header style={heroWrapStyle}>
          <section style={heroCardStyle}>
            <div style={heroTopRowStyle}>
              <span style={refreshHeroTagStyle} onClick={handleRefreshTap}>
                Aktualizovať
              </span>

              <span style={secretHeroTagStyle} onClick={handleAdminSecretTap}>
                CK EL GRECO TOUR
              </span>
            </div>

            <h1 style={titleStyle}>EL GRECO TOUR</h1>

            <p style={topInfoPrimaryStyle}>
              Grécko, Katerini Paralia, Pavlou Mela 18
            </p>

            <p style={topInfoSecondaryStyle}>
              Prehľad voľných termínov a cien apartmánov
            </p>

            <div style={heroInfoGridStyle}>
              <div style={heroInfoCardStyle}>
                <div style={heroInfoLabelStyle}>Autobusový príplatok na osobu</div>
                <div style={heroInfoValueStyle}>{formatPrice(busSurchargePerPerson)}</div>
              </div>

              <div style={heroInfoCardStyle}>
                <div style={heroInfoLabelStyle}>Dôležité</div>
                <div style={heroInfoTextStyle}>Ceny sú uvedené za apartmán</div>
              </div>
            </div>
          </section>
        </header>

        {content}
      </div>

      <div style={fixedOrderBarStyle}>
        <div style={fixedOrderBarInnerStyle}>
          <button type="button" style={fixedOrderButtonStyle} onClick={handleOrderTripClick}>
            OBJEDNAŤ ZÁJAZD
          </button>
        </div>
      </div>
    </main>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background: 'var(--page-bg)',
  color: 'var(--text-main)',
}

const backgroundOrbTopStyle: CSSProperties = {
  position: 'absolute',
  top: -120,
  right: -80,
  width: 260,
  height: 260,
  borderRadius: '50%',
  background: 'var(--orb-top)',
  pointerEvents: 'none',
}

const backgroundOrbBottomStyle: CSSProperties = {
  position: 'absolute',
  bottom: -140,
  left: -90,
  width: 280,
  height: 280,
  borderRadius: '50%',
  background: 'var(--orb-bottom)',
  pointerEvents: 'none',
}

const containerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  maxWidth: 980,
  margin: '0 auto',
  padding: '18px 14px 132px',
  boxSizing: 'border-box',
}

const heroWrapStyle: CSSProperties = {
  marginBottom: 18,
}

const heroCardStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 28,
  padding: 22,
  background: 'var(--hero-card-bg)',
  boxShadow: 'var(--hero-card-shadow)',
  border: '1px solid var(--hero-card-border)',
  backdropFilter: 'blur(8px)',
}

const heroTopRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 14,
}

const secretHeroTagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.2,
  color: 'var(--tag-text)',
  background: 'var(--tag-bg)',
  border: '1px solid var(--tag-border)',
  cursor: 'pointer',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
}

const refreshHeroTagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.2,
  color: 'var(--tag-text)',
  background: 'var(--tag-bg)',
  border: '1px solid var(--tag-border)',
  cursor: 'pointer',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
}

const titleStyle: CSSProperties = {
  margin: 0,
  textAlign: 'center',
  fontSize: 32,
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: 0.2,
  color: 'var(--text-strong)',
  opacity: 1,
  position: 'relative',
  zIndex: 1,
  textShadow: '0 1px 0 rgba(255,255,255,0.08)',
}

const topInfoPrimaryStyle: CSSProperties = {
  margin: '12px 0 0',
  textAlign: 'center',
  fontSize: 16,
  fontWeight: 800,
  color: 'var(--text-strong)',
}

const topInfoSecondaryStyle: CSSProperties = {
  margin: '8px 0 0',
  textAlign: 'center',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text-secondary)',
}

const heroInfoGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 18,
}

const heroInfoCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  background: 'var(--info-card-bg)',
  border: '1px solid var(--info-card-border)',
  boxShadow: 'var(--info-card-shadow)',
  textAlign: 'center',
}

const heroInfoLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-muted)',
}

const heroInfoValueStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 24,
  fontWeight: 900,
  color: 'var(--text-strong)',
}

const heroInfoTextStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 16,
  fontWeight: 800,
  color: 'var(--text-strong)',
}

const stateCardStyle: CSSProperties = {
  borderRadius: 22,
  padding: 20,
  background: 'var(--state-bg)',
  boxShadow: 'var(--state-shadow)',
  color: 'var(--text-main)',
  fontSize: 18,
}

const cardsGridStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
}

const cardStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: 16,
  borderRadius: 24,
  padding: 18,
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  boxShadow: 'var(--card-shadow)',
}

const cardGlowStyle: CSSProperties = {
  position: 'absolute',
  top: -60,
  right: -40,
  width: 160,
  height: 160,
  borderRadius: '50%',
  background: 'var(--card-glow)',
  pointerEvents: 'none',
}

const cardHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const tripHeaderBoxStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  justifyItems: 'center',
}

const topMiniLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
}

const tripCodeStyle: CSSProperties = {
  fontSize: 30,
  lineHeight: 1,
  fontWeight: 900,
  color: 'var(--text-strong)',
  textAlign: 'center',
}

const datePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 18,
  borderRadius: 22,
  background: 'var(--date-panel-bg)',
  border: '1px solid var(--date-panel-border)',
  boxShadow: 'var(--date-panel-shadow)',
  textAlign: 'center',
}

const datePanelDateStyle: CSSProperties = {
  fontSize: 28,
  lineHeight: 1.15,
  fontWeight: 900,
  color: 'var(--text-strong)',
}

const datePanelMetaStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--text-secondary)',
}

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const sectionHeadingStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  textAlign: 'center',
  color: 'var(--text-strong)',
}

const compactRowsGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const apartmentRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 14,
  padding: 16,
  borderRadius: 18,
  background: 'var(--row-bg)',
  border: '1px solid var(--row-border)',
  flexWrap: 'wrap',
}

const apartmentRowLeftStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
}

const apartmentLabelStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: 'var(--text-strong)',
}

const apartmentPriceStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--text-secondary)',
}

const freeBadgeBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 999,
  fontSize: 15,
  fontWeight: 900,
  whiteSpace: 'nowrap',
}

const noteStyle: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: 'var(--note-bg)',
  border: '1px solid var(--note-border)',
  color: 'var(--note-text)',
  fontSize: 14,
  lineHeight: 1.45,
}

const fixedOrderBarStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  padding: '12px 14px calc(12px + env(safe-area-inset-bottom))',
  background: 'var(--fixed-bar-bg)',
  pointerEvents: 'none',
  boxSizing: 'border-box',
}

const fixedOrderBarInnerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 980,
  margin: '0 auto',
  pointerEvents: 'auto',
}

const fixedOrderButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: 60,
  border: 'none',
  borderRadius: 22,
  padding: '16px 20px',
  background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 55%, #2dd4bf 100%)',
  color: '#ffffff',
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  boxShadow: 'var(--button-shadow)',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}