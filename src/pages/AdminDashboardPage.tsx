import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

  if (loading) {
    return (
      <main style={loadingPageStyle}>
        Načítavam admin termíny...
      </main>
    )
  }

  return (
    <main style={pageStyle}>
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
  background: 'linear-gradient(180deg, #eef4fb 0%, #f8fafc 100%)',
  fontFamily: 'Arial, sans-serif',
  padding: '14px 10px 28px',
  boxSizing: 'border-box',
}

const loadingPageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f8fafc',
  fontFamily: 'Arial, sans-serif',
  fontSize: 20,
  color: '#475569',
}

const containerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 920,
  margin: '0 auto',
}

const heroCardStyle: CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.96) 100%)',
  border: '1px solid #e2e8f0',
  borderRadius: 22,
  padding: 16,
  boxShadow: '0 10px 26px rgba(15,23,42,0.06)',
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
  color: '#64748b',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.05,
  color: '#0f172a',
}

const textStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.45,
  color: '#475569',
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
  background: '#0f172a',
  color: '#ffffff',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryLinkButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 16px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#1d4ed8',
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
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: 14,
  fontWeight: 800,
  marginBottom: 12,
}

const successStyle: CSSProperties = {
  borderRadius: 14,
  padding: '11px 13px',
  background: '#f0fdf4',
  color: '#166534',
  fontSize: 14,
  fontWeight: 800,
  marginBottom: 12,
}

const emptyCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 18,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 26px rgba(15,23,42,0.06)',
  fontSize: 16,
  color: '#475569',
}

const cardsGridStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  padding: 14,
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 26px rgba(15,23,42,0.06)',
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
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1d4ed8',
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
}

const datePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 12,
  borderRadius: 16,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
}

const dateStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: '#0f172a',
  lineHeight: 1.2,
  textAlign: 'center',
}

const metaStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#475569',
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
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
}

const stepperHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const stepperLabelStyle: CSSProperties = {
  fontSize: 17,
  lineHeight: 1.2,
  fontWeight: 800,
  color: '#0f172a',
}

const stepperTopInfoStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  fontSize: 14,
  color: '#475569',
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
  background: disabled ? '#cbd5e1' : '#0f172a',
  color: '#ffffff',
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
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  fontWeight: 900,
  color: '#0f172a',
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
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1e3a8a',
  fontSize: 13,
  fontWeight: 800,
}

const savingTextStyle: CSSProperties = {
  fontSize: 13,
  color: '#1d4ed8',
  fontWeight: 800,
}

const noteStyle: CSSProperties = {
  borderRadius: 14,
  padding: '12px 14px',
  background: '#fff7ed',
  border: '1px solid #fed7aa',
  color: '#9a3412',
  fontSize: 14,
  lineHeight: 1.45,
}