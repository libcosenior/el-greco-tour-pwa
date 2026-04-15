import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BOARDING_STOPS } from '../features/order/orderConstants'
import { buildOrderMailtoUrl, formatTripDateRange } from '../features/order/orderMail'
import { createInitialOrderForm, type OrderFormValues, type TransportType } from '../features/order/orderTypes'

const CK_ORDER_EMAIL = import.meta.env.VITE_CK_ORDER_EMAIL ?? ''

type DepartureOption = {
  id: string
  trip_code: string
  start_date: string
  end_date: string
  days_count: number
  nights_count: number
}

type CounterCardProps = {
  label: string
  value: number
  onMinus: () => void
  onPlus: () => void
}

function CounterCard({ label, value, onMinus, onPlus }: CounterCardProps) {
  return (
    <div style={counterCardStyle}>
      <div style={counterLabelStyle}>{label}</div>

      <div style={counterControlsStyle}>
        <button type="button" style={counterButtonStyle} onClick={onMinus}>
          −
        </button>

        <div style={counterValueStyle}>{value}</div>

        <button type="button" style={counterButtonStyle} onClick={onPlus}>
          +
        </button>
      </div>
    </div>
  )
}

function clampChildGroups(totalChildren: number, age0to6: number, age7to15: number) {
  let next0to6 = Math.max(0, age0to6)
  let next7to15 = Math.max(0, age7to15)

  while (next0to6 + next7to15 > totalChildren) {
    if (next7to15 > 0) {
      next7to15 -= 1
    } else if (next0to6 > 0) {
      next0to6 -= 1
    } else {
      break
    }
  }

  return {
    childrenAge0to6: next0to6,
    childrenAge7to15: next7to15,
  }
}

export default function OrderPage() {
  const navigate = useNavigate()

  const [departures, setDepartures] = useState<DepartureOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<OrderFormValues>(createInitialOrderForm())

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
        nights_count
      `)
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true })

    if (error) {
      setError('Nepodarilo sa načítať termíny zájazdov.')
      setDepartures([])
      setLoading(false)
      return
    }

    setDepartures((data ?? []) as DepartureOption[])
    setLoading(false)
  }

  function updateField<K extends keyof OrderFormValues>(field: K, value: OrderFormValues[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function setTransport(value: TransportType) {
    setForm((prev) => ({
      ...prev,
      transport: value,
      boardingStopId: value === 'bus' ? prev.boardingStopId : '',
    }))
  }

  function adjustAdults(delta: number) {
    setForm((prev) => ({
      ...prev,
      adults: Math.max(0, prev.adults + delta),
    }))
  }

  function adjustChildren(delta: number) {
    setForm((prev) => {
      const nextChildren = Math.max(0, prev.children + delta)
      const nextGroups = clampChildGroups(nextChildren, prev.childrenAge0to6, prev.childrenAge7to15)

      return {
        ...prev,
        children: nextChildren,
        ...nextGroups,
      }
    })
  }

  function adjustChildrenAge0to6(delta: number) {
    setForm((prev) => {
      const nextAge0to6 = Math.max(0, prev.childrenAge0to6 + delta)
      const nextChildren = Math.max(prev.children, nextAge0to6 + prev.childrenAge7to15)

      return {
        ...prev,
        childrenAge0to6: nextAge0to6,
        children: nextChildren,
      }
    })
  }

  function adjustChildrenAge7to15(delta: number) {
    setForm((prev) => {
      const nextAge7to15 = Math.max(0, prev.childrenAge7to15 + delta)
      const nextChildren = Math.max(prev.children, prev.childrenAge0to6 + nextAge7to15)

      return {
        ...prev,
        childrenAge7to15: nextAge7to15,
        children: nextChildren,
      }
    })
  }

  function validateForm(selectedDeparture: DepartureOption | null): string | null {
    if (!CK_ORDER_EMAIL || CK_ORDER_EMAIL === 'SEM_DAJ_EMAIL_CK') {
      return 'Najprv doplň VITE_CK_ORDER_EMAIL do .env súboru.'
    }

    if (!selectedDeparture) {
      return 'Vyber zájazd.'
    }

    if (!form.customerName.trim()) {
      return 'Vyplň titul, meno a priezvisko.'
    }

    if (!form.birthDate) {
      return 'Vyplň dátum narodenia.'
    }

    if (!form.permanentResidence.trim()) {
      return 'Vyplň trvalý pobyt.'
    }

    if (!form.mobile.trim()) {
      return 'Vyplň mobil.'
    }

    if (!form.transport) {
      return 'Vyber dopravu.'
    }

    if (form.transport === 'bus' && !form.boardingStopId) {
      return 'Vyber nástupnú zastávku.'
    }

    if (form.adults + form.children <= 0) {
      return 'Zadaj aspoň jedného člena zájazdu.'
    }

    return null
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    const selectedDeparture = departures.find((item) => item.id === form.departureId) ?? null
    const validationError = validateForm(selectedDeparture)

    if (validationError) {
      setSubmitError(validationError)
      return
    }

    const mailtoUrl = buildOrderMailtoUrl(CK_ORDER_EMAIL, selectedDeparture!, form)
    window.location.href = mailtoUrl
  }

  useEffect(() => {
    loadDepartures()
  }, [])

  useEffect(() => {
    if (!form.departureId && departures.length > 0) {
      setForm((prev) => ({
        ...prev,
        departureId: departures[0].id,
      }))
    }
  }, [departures, form.departureId])

  const selectedDeparture = useMemo(() => {
    return departures.find((item) => item.id === form.departureId) ?? null
  }, [departures, form.departureId])

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <button type="button" style={backButtonStyle} onClick={() => navigate('/')}>
          ← Späť na ponuku termínov
        </button>

        <section style={cardStyle}>
          <div style={headerBlockStyle}>
            <div style={eyebrowStyle}>CK EL GRECO TOUR</div>
            <h1 style={titleStyle}>Objednávka zájazdu</h1>
            <p style={subtitleStyle}>
              Vyplň formulár a potom sa otvorí e-mailová správa s pripraveným textom objednávky.
            </p>
            <p style={requiredLegendStyle}>
              <span style={requiredMarkStyle}>*</span> Povinné pole
            </p>
          </div>

          {loading ? <div style={stateBoxStyle}>Načítavam termíny...</div> : null}
          {!loading && error ? <div style={{ ...stateBoxStyle, color: '#b91c1c' }}>{error}</div> : null}
          {!loading && !error && departures.length === 0 ? (
            <div style={stateBoxStyle}>Momentálne nie sú dostupné žiadne termíny.</div>
          ) : null}

          {!loading && !error && departures.length > 0 ? (
            <form style={formStyle} onSubmit={handleSubmit}>
              <section style={sectionStyle}>
                <div style={sectionTitleStyle}>Zájazd</div>

                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>
                    Zájazd číslo <span style={requiredMarkStyle}>*</span>
                  </span>
                  <select
                    style={inputStyle}
                    value={form.departureId}
                    onChange={(event) => updateField('departureId', event.target.value)}
                    required
                  >
                    {departures.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.trip_code} | {formatTripDateRange(item)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedDeparture ? (
                  <div style={hintBoxStyle}>
                    Termín: {formatTripDateRange(selectedDeparture)} | {selectedDeparture.days_count} dní / {selectedDeparture.nights_count} nocí
                  </div>
                ) : null}
              </section>

              <section style={sectionStyle}>
                <div style={sectionTitleStyle}>Objednávateľ</div>

                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>
                    Titul, meno a priezvisko <span style={requiredMarkStyle}>*</span>
                  </span>
                  <input
                    style={inputStyle}
                    value={form.customerName}
                    onChange={(event) => updateField('customerName', event.target.value)}
                    placeholder="Napr. Mgr. Ján Novák"
                    required
                  />
                </label>

                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>
                    Dátum narodenia <span style={requiredMarkStyle}>*</span>
                  </span>
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.birthDate}
                    onChange={(event) => updateField('birthDate', event.target.value)}
                    required
                  />
                </label>

                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>
                    Trvalý pobyt <span style={requiredMarkStyle}>*</span>
                  </span>
                  <textarea
                    style={textareaStyle}
                    rows={3}
                    value={form.permanentResidence}
                    onChange={(event) => updateField('permanentResidence', event.target.value)}
                    placeholder="Ulica, číslo, PSČ, mesto"
                    required
                  />
                </label>

                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>
                    Mobil <span style={requiredMarkStyle}>*</span>
                  </span>
                  <input
                    style={inputStyle}
                    inputMode="tel"
                    value={form.mobile}
                    onChange={(event) => updateField('mobile', event.target.value)}
                    placeholder="+421..."
                    required
                  />
                </label>
              </section>

              <section style={sectionStyle}>
                <div style={sectionTitleStyle}>
                  Doprava <span style={requiredMarkStyle}>*</span>
                </div>

                <div style={choiceGridStyle}>
                  <button
                    type="button"
                    style={{
                      ...choiceButtonStyle,
                      ...(form.transport === 'own' ? selectedChoiceButtonStyle : undefined),
                    }}
                    onClick={() => setTransport('own')}
                  >
                    <span style={choiceCheckboxStyle}>{form.transport === 'own' ? '☒' : '☐'}</span>
                    <span>Vlastná</span>
                  </button>

                  <button
                    type="button"
                    style={{
                      ...choiceButtonStyle,
                      ...(form.transport === 'bus' ? selectedChoiceButtonStyle : undefined),
                    }}
                    onClick={() => setTransport('bus')}
                  >
                    <span style={choiceCheckboxStyle}>{form.transport === 'bus' ? '☒' : '☐'}</span>
                    <span>Autobusom</span>
                  </button>
                </div>

                {form.transport === 'bus' ? (
                  <div style={stopsWrapStyle}>
                    <div style={smallSectionLabelStyle}>
                      Nástupná zastávka <span style={requiredMarkStyle}>*</span>
                    </div>

                    <div style={stopsGridStyle}>
                      {BOARDING_STOPS.map((stop) => (
                        <button
                          key={stop.id}
                          type="button"
                          style={{
                            ...stopButtonStyle,
                            ...(form.boardingStopId === stop.id ? selectedStopButtonStyle : undefined),
                          }}
                          onClick={() => updateField('boardingStopId', stop.id)}
                        >
                          <div style={stopTopRowStyle}>
                            <span style={choiceCheckboxStyle}>{form.boardingStopId === stop.id ? '☒' : '☐'}</span>
                            <span style={stopTimeStyle}>{stop.time}</span>
                          </div>

                          <div style={stopLabelStyle}>{stop.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section style={sectionStyle}>
                <div style={sectionTitleStyle}>Členovia zájazdu</div>

                <div style={counterGridStyle}>
                  <CounterCard label="Dospelí" value={form.adults} onMinus={() => adjustAdults(-1)} onPlus={() => adjustAdults(1)} />
                  <CounterCard label="Deti" value={form.children} onMinus={() => adjustChildren(-1)} onPlus={() => adjustChildren(1)} />
                </div>
              </section>

              <section style={sectionStyle}>
                <div style={sectionTitleStyle}>Vek detí</div>

                <div style={counterGridStyle}>
                  <CounterCard
                    label="Od 0 do 6 rokov"
                    value={form.childrenAge0to6}
                    onMinus={() => adjustChildrenAge0to6(-1)}
                    onPlus={() => adjustChildrenAge0to6(1)}
                  />
                  <CounterCard
                    label="Nad 6 do 15 rokov"
                    value={form.childrenAge7to15}
                    onMinus={() => adjustChildrenAge7to15(-1)}
                    onPlus={() => adjustChildrenAge7to15(1)}
                  />
                </div>

                <div style={smallHintStyle}>
                  Počet detí sa automaticky dorovná podľa vekových skupín.
                </div>
              </section>

              <section style={sectionStyle}>
                <div style={sectionTitleStyle}>Poznámka</div>

                <label style={fieldWrapStyle}>
                  <span style={fieldLabelStyle}>Ďalšie požiadavky</span>
                  <textarea
                    style={textareaStyle}
                    rows={5}
                    value={form.note}
                    onChange={(event) => updateField('note', event.target.value)}
                    placeholder="Sem môžeš doplniť ďalšie požiadavky..."
                  />
                </label>
              </section>

              {submitError ? <div style={errorBoxStyle}>{submitError}</div> : null}

              <div style={footerActionsStyle}>
                <button type="button" style={secondaryButtonStyle} onClick={() => navigate('/')}>
                  Zrušiť
                </button>

                <button type="submit" style={primaryButtonStyle}>
                  Otvoriť e-mail s objednávkou
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #e8f4ff 0%, #f4f8fc 24%, #f6f8fb 100%)',
  color: '#0f172a',
  padding: '18px 14px 32px',
  boxSizing: 'border-box',
}

const containerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 760,
  margin: '0 auto',
}

const backButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#0f766e',
  fontSize: 15,
  fontWeight: 800,
  padding: '8px 0 14px',
  cursor: 'pointer',
}

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: 20,
  borderRadius: 28,
  padding: 20,
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(226,232,240,0.9)',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
}

const headerBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  color: '#64748b',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.1,
  fontWeight: 900,
}

const subtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.5,
  color: '#475569',
}

const requiredLegendStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.4,
  color: '#64748b',
  fontWeight: 700,
}

const requiredMarkStyle: CSSProperties = {
  color: '#dc2626',
  fontWeight: 900,
}

const stateBoxStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  fontSize: 16,
  fontWeight: 700,
}

const formStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
}

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 20,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: '#0f172a',
}

const fieldWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: '#334155',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 16,
  boxSizing: 'border-box',
  background: '#ffffff',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 16,
  boxSizing: 'border-box',
  background: '#ffffff',
  resize: 'vertical',
  fontFamily: 'inherit',
}

const hintBoxStyle: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: '#ecfeff',
  border: '1px solid #a5f3fc',
  color: '#155e75',
  fontSize: 14,
  fontWeight: 700,
}

const choiceGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const choiceButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 50,
  padding: '0 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  fontSize: 16,
  fontWeight: 800,
  color: '#0f172a',
  cursor: 'pointer',
  textAlign: 'left',
}

const selectedChoiceButtonStyle: CSSProperties = {
  border: '1px solid #14b8a6',
  background: '#f0fdfa',
  boxShadow: '0 0 0 2px rgba(20, 184, 166, 0.12)',
}

const choiceCheckboxStyle: CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
}

const stopsWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const smallSectionLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: '#334155',
}

const stopsGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const stopButtonStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 12,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  cursor: 'pointer',
  textAlign: 'left',
}

const selectedStopButtonStyle: CSSProperties = {
  border: '1px solid #14b8a6',
  background: '#f0fdfa',
  boxShadow: '0 0 0 2px rgba(20, 184, 166, 0.12)',
}

const stopTopRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
}

const stopTimeStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: '#0f766e',
}

const stopLabelStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.45,
  fontWeight: 700,
  color: '#1e293b',
}

const counterGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const counterCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 14,
  borderRadius: 16,
  background: '#ffffff',
  border: '1px solid #cbd5e1',
}

const counterLabelStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: '#1e293b',
}

const counterControlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
}

const counterButtonStyle: CSSProperties = {
  width: 46,
  height: 46,
  border: 'none',
  borderRadius: 14,
  background: '#0f766e',
  color: '#ffffff',
  fontSize: 28,
  lineHeight: 1,
  fontWeight: 900,
  cursor: 'pointer',
}

const counterValueStyle: CSSProperties = {
  minWidth: 56,
  textAlign: 'center',
  fontSize: 24,
  fontWeight: 900,
  color: '#0f172a',
}

const smallHintStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  color: '#64748b',
  fontWeight: 700,
}

const errorBoxStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  fontSize: 14,
  fontWeight: 800,
}

const footerActionsStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const secondaryButtonStyle: CSSProperties = {
  minHeight: 52,
  border: '1px solid #cbd5e1',
  borderRadius: 16,
  background: '#ffffff',
  color: '#0f172a',
  fontSize: 16,
  fontWeight: 900,
  cursor: 'pointer',
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 56,
  border: 'none',
  borderRadius: 18,
  background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 55%, #2dd4bf 100%)',
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 900,
  letterSpacing: 0.3,
  cursor: 'pointer',
  boxShadow: '0 16px 34px rgba(15, 118, 110, 0.22)',
}