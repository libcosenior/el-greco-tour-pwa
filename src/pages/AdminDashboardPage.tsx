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
        <div style={topBarStyle}>
          <div>
            <h1 style={titleStyle}>Správa obsadenosti</h1>
            <p style={textStyle}>
              Tu meníš obsadené apartmány. Verejná stránka zobrazuje voľné miesta automaticky.
            </p>
          </div>

          <button type="button" onClick={handleLogout} style={logoutButtonStyle} disabled={loggingOut}>
            {loggingOut ? 'Odhlasujem...' : 'Odhlásiť sa'}
          </button>
        </div>

        <div style={linksRowStyle}>
          <Link to="/" style={secondaryLinkStyle}>
            Verejná stránka
          </Link>
        </div>

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
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={tripCodeStyle}>{item.trip_code}</div>

                      <div style={highlightBoxStyle}>
                        <div style={dateStyle}>
                          {formatDate(item.start_date)} – {formatDate(item.end_date)}
                        </div>
                        <div style={metaStyle}>
                          {item.days_count} dní / {item.nights_count} nocí
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={apartmentSectionStyle}>
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

type ApartmentStepperProps = {
  label: string
  occupied: number
  total: number
  isSaving: boolean
  onMinus: () => void
  onPlus: () => void
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
      <div style={stepperLabelStyle}>{label}</div>

      <div style={stepperTopInfoStyle}>
        <span>Obsadené</span>
        <strong>{occupied}</strong>
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

      <div style={freeTextStyle}>Voľné {free} z {total}</div>
      {isSaving ? <div style={savingTextStyle}>Ukladám...</div> : null}
    </section>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  fontFamily: 'Arial, sans-serif',
  padding: '18px 12px 40px',
}

const loadingPageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f8fafc',
  fontFamily: 'Arial, sans-serif',
  fontSize: 22,
  color: '#475569',
}

const containerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 860,
  margin: '0 auto',
}

const topBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.1,
  color: '#111827',
}

const textStyle: CSSProperties = {
  marginTop: 12,
  marginBottom: 0,
  fontSize: 18,
  color: '#475569',
}

const logoutButtonStyle: CSSProperties = {
  minHeight: 50,
  padding: '0 18px',
  borderRadius: 14,
  border: 'none',
  background: '#111827',
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
}

const linksRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 18,
  marginBottom: 18,
}

const secondaryLinkStyle: CSSProperties = {
  color: '#1d4ed8',
  textDecoration: 'none',
  fontWeight: 700,
}

const errorStyle: CSSProperties = {
  borderRadius: 14,
  padding: '12px 14px',
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: 15,
  fontWeight: 700,
  marginBottom: 14,
}

const successStyle: CSSProperties = {
  borderRadius: 14,
  padding: '12px 14px',
  background: '#f0fdf4',
  color: '#166534',
  fontSize: 15,
  fontWeight: 700,
  marginBottom: 14,
}

const emptyCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 20,
  background: '#ffffff',
  boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
  fontSize: 18,
  color: '#475569',
}

const cardsGridStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  padding: 18,
  boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
  display: 'grid',
  gap: 16,
}

const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
}

const tripCodeStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: '#111827',
}

const highlightBoxStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 16,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
}

const dateStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: '#111827',
  lineHeight: 1.2,
}

const metaStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#334155',
}

const apartmentSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const stepperCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 18,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
}

const stepperLabelStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: '#111827',
}

const stepperTopInfoStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  fontSize: 18,
  color: '#475569',
}

const stepperRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const stepperButtonStyle = (disabled: boolean): CSSProperties => ({
  width: 72,
  height: 72,
  borderRadius: 18,
  border: 'none',
  background: disabled ? '#cbd5e1' : '#111827',
  color: '#ffffff',
  fontSize: 36,
  fontWeight: 800,
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const countBoxStyle: CSSProperties = {
  minWidth: 110,
  height: 72,
  borderRadius: 18,
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 34,
  fontWeight: 800,
  color: '#111827',
}

const freeTextStyle: CSSProperties = {
  fontSize: 18,
  color: '#475569',
  fontWeight: 700,
}

const savingTextStyle: CSSProperties = {
  fontSize: 15,
  color: '#1d4ed8',
  fontWeight: 700,
}

const noteStyle: CSSProperties = {
  borderRadius: 14,
  padding: '12px 14px',
  background: '#fff7ed',
  color: '#9a3412',
  fontSize: 15,
}