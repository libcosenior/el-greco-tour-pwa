import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
type ThemeStyleVars = CSSProperties & Record<`--${string}`, string>
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

function formatBirthDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)

  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

export default function OrderPage() {
  const navigate = useNavigate()

  const [departures, setDepartures] = useState<DepartureOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<OrderFormValues>(createInitialOrderForm())
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

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

    if (!form.birthDate.trim()) {
			return 'Vyplň dátum narodenia.'
		}

		if (!/^\d{2}\.\d{2}\.\d{4}$/.test(form.birthDate.trim())) {
			return 'Dátum narodenia zadaj vo formáte DD.MM.RRRR.'
		}

    if (!form.permanentResidence.trim()) {
      return 'Vyplň trvalý pobyt.'
    }

    if (!form.mobile.trim()) {
			return 'Vyplň mobil.'
		}

		if (!form.email.trim()) {
			return 'Vyplň email.'
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

  const selectedDeparture = useMemo(() => {
    return departures.find((item) => item.id === form.departureId) ?? null
  }, [departures, form.departureId])

  const themeVars: ThemeStyleVars = {
  '--page-bg': isDarkMode
    ? 'linear-gradient(180deg, #020617 0%, #0f172a 24%, #111827 100%)'
    : 'linear-gradient(180deg, #e8f4ff 0%, #f4f8fc 24%, #f6f8fb 100%)',
  '--text-main': isDarkMode ? '#e5eef7' : '#0f172a',
  '--text-secondary': isDarkMode ? '#cbd5e1' : '#475569',
  '--text-muted': isDarkMode ? '#94a3b8' : '#64748b',
  '--text-label': isDarkMode ? '#dbe5f0' : '#334155',
  '--card-bg': isDarkMode ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.96)',
  '--card-border': isDarkMode ? 'rgba(71,85,105,0.72)' : 'rgba(226,232,240,0.9)',
  '--card-shadow': isDarkMode
    ? '0 18px 50px rgba(0, 0, 0, 0.34)'
    : '0 18px 50px rgba(15, 23, 42, 0.08)',
  '--section-bg': isDarkMode ? '#111827' : '#f8fafc',
  '--section-border': isDarkMode ? '#334155' : '#e2e8f0',
  '--state-bg': isDarkMode ? '#111827' : '#f8fafc',
  '--state-border': isDarkMode ? '#334155' : '#e2e8f0',
  '--input-bg': isDarkMode ? '#0b1220' : '#ffffff',
  '--input-border': isDarkMode ? '#475569' : '#cbd5e1',
  '--input-text': isDarkMode ? '#f8fafc' : '#0f172a',
  '--input-placeholder': isDarkMode ? '#94a3b8' : '#64748b',
  '--hint-bg': isDarkMode ? '#082f49' : '#ecfeff',
  '--hint-border': isDarkMode ? '#155e75' : '#a5f3fc',
  '--hint-text': isDarkMode ? '#bae6fd' : '#155e75',
  '--choice-bg': isDarkMode ? '#0b1220' : '#ffffff',
  '--choice-border': isDarkMode ? '#475569' : '#cbd5e1',
  '--selected-bg': isDarkMode ? '#042f2e' : '#f0fdfa',
  '--selected-border': '#14b8a6',
  '--selected-shadow': isDarkMode
    ? '0 0 0 2px rgba(45,212,191,0.16)'
    : '0 0 0 2px rgba(20,184,166,0.12)',
  '--accent': '#0f766e',
  '--danger-bg': isDarkMode ? '#3f1d1d' : '#fef2f2',
  '--danger-border': isDarkMode ? '#7f1d1d' : '#fecaca',
  '--danger-text': isDarkMode ? '#fca5a5' : '#b91c1c',
  '--secondary-button-bg': isDarkMode ? '#111827' : '#ffffff',
  '--secondary-button-border': isDarkMode ? '#475569' : '#cbd5e1',
  '--primary-shadow': isDarkMode
    ? '0 16px 34px rgba(20, 184, 166, 0.18)'
    : '0 16px 34px rgba(15, 118, 110, 0.22)',
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
          {!loading && error ? <div style={{ ...stateBoxStyle, color: 'var(--danger-text)' }}>{error}</div> : null}
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
										type="text"
										inputMode="numeric"
										style={inputStyle}
										value={form.birthDate}
										onChange={(event) => updateField('birthDate', formatBirthDateInput(event.target.value))}
										placeholder="DD.MM.RRRR"
										maxLength={10}
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

							<label style={fieldWrapStyle}>
								<span style={fieldLabelStyle}>
									Email <span style={requiredMarkStyle}>*</span>
								</span>
								<input
									type="email"
									inputMode="email"
									autoCapitalize="none"
									autoCorrect="off"
									style={inputStyle}
									value={form.email}
									onChange={(event) => updateField('email', event.target.value)}
									placeholder="napr. meno@email.sk"
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
  background: 'var(--page-bg)',
  color: 'var(--text-main)',
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
  color: 'var(--accent)',
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
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  boxShadow: 'var(--card-shadow)',
}

const headerBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.1,
  fontWeight: 900,
  color: 'var(--text-main)',
}

const subtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.5,
  color: 'var(--text-secondary)',
}

const requiredLegendStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.4,
  color: 'var(--text-muted)',
  fontWeight: 700,
}

const requiredMarkStyle: CSSProperties = {
  color: '#dc2626',
  fontWeight: 900,
}

const stateBoxStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'var(--state-bg)',
  border: '1px solid var(--state-border)',
  color: 'var(--text-main)',
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
  background: 'var(--section-bg)',
  border: '1px solid var(--section-border)',
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: 'var(--text-main)',
}

const fieldWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: 'var(--text-label)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 14,
  border: '1px solid var(--input-border)',
  fontSize: 16,
  boxSizing: 'border-box',
  background: 'var(--input-bg)',
  color: 'var(--input-text)',
  WebkitTextFillColor: 'var(--input-text)',
  caretColor: 'var(--input-text)',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid var(--input-border)',
  fontSize: 16,
  boxSizing: 'border-box',
  background: 'var(--input-bg)',
  color: 'var(--input-text)',
  WebkitTextFillColor: 'var(--input-text)',
  caretColor: 'var(--input-text)',
  resize: 'vertical',
  fontFamily: 'inherit',
}

const hintBoxStyle: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: 'var(--hint-bg)',
  border: '1px solid var(--hint-border)',
  color: 'var(--hint-text)',
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
  border: '1px solid var(--choice-border)',
  background: 'var(--choice-bg)',
  fontSize: 16,
  fontWeight: 800,
  color: 'var(--text-main)',
  cursor: 'pointer',
  textAlign: 'left',
}

const selectedChoiceButtonStyle: CSSProperties = {
  border: '1px solid var(--selected-border)',
  background: 'var(--selected-bg)',
  boxShadow: 'var(--selected-shadow)',
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
  color: 'var(--text-label)',
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
  border: '1px solid var(--choice-border)',
  background: 'var(--choice-bg)',
  color: 'var(--text-main)',
  cursor: 'pointer',
  textAlign: 'left',
}

const selectedStopButtonStyle: CSSProperties = {
  border: '1px solid var(--selected-border)',
  background: 'var(--selected-bg)',
  boxShadow: 'var(--selected-shadow)',
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
  color: 'var(--accent)',
}

const stopLabelStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.45,
  fontWeight: 700,
  color: 'var(--text-main)',
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
  background: 'var(--choice-bg)',
  border: '1px solid var(--choice-border)',
}

const counterLabelStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: 'var(--text-main)',
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
  color: 'var(--text-main)',
}

const smallHintStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  color: 'var(--text-muted)',
  fontWeight: 700,
}

const errorBoxStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: 'var(--danger-bg)',
  border: '1px solid var(--danger-border)',
  color: 'var(--danger-text)',
  fontSize: 14,
  fontWeight: 800,
}

const footerActionsStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const secondaryButtonStyle: CSSProperties = {
  minHeight: 52,
  border: '1px solid var(--secondary-button-border)',
  borderRadius: 16,
  background: 'var(--secondary-button-bg)',
  color: 'var(--text-main)',
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
  boxShadow: 'var(--primary-shadow)',
}