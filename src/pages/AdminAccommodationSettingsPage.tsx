import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { AccommodationSettings } from '../types/accommodationSettings'
import type { Departure } from '../types/departure'

type ThemeStyleVars = CSSProperties & Record<`--${string}`, string>
type CapacityKey = 'double_total' | 'triple_total' | 'quad_total'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function SettingsStepper({
  label,
  value,
  min,
  onMinus,
  onPlus,
}: {
  label: string
  value: number
  min: number
  onMinus: () => void
  onPlus: () => void
}) {
  return (
    <section style={stepperCardStyle}>
      <div style={stepperLabelStyle}>{label}</div>
      <div style={stepperHintStyle}>Minimum podľa už obsadených: {min}</div>

      <div style={stepperRowStyle}>
        <button type="button" style={stepperButtonStyle(value <= min)} disabled={value <= min} onClick={onMinus}>
          −
        </button>

        <div style={countBoxStyle}>{value}</div>

        <button type="button" style={stepperButtonStyle(false)} onClick={onPlus}>
          +
        </button>
      </div>
    </section>
  )
}

export default function AdminAccommodationSettingsPage() {
  const navigate = useNavigate()

  const [settings, setSettings] = useState<AccommodationSettings | null>(null)
  const [draft, setDraft] = useState<AccommodationSettings | null>(null)
  const [departures, setDepartures] = useState<Departure[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  async function loadData() {
    setErrorText('')

    const [settingsResult, departuresResult] = await Promise.all([
      supabase
        .from('accommodation_settings')
        .select('id, double_total, triple_total, quad_total, updated_at')
        .eq('id', 1)
        .maybeSingle(),
      supabase
        .from('departures')
        .select('id, double_total, triple_total, quad_total, double_occupied, triple_occupied, quad_occupied')
        .order('start_date', { ascending: true }),
    ])

    if (settingsResult.error) {
      setErrorText('Nepodarilo sa načítať nastavenie apartmánov.')
      setLoading(false)
      return
    }

    if (departuresResult.error) {
      setErrorText('Nepodarilo sa načítať termíny pre kontrolu obsadenosti.')
      setLoading(false)
      return
    }

    const loadedSettings: AccommodationSettings = settingsResult.data ?? {
      id: 1,
      double_total: 10,
      triple_total: 10,
      quad_total: 10,
    }

    setSettings(loadedSettings)
    setDraft(loadedSettings)
    setDepartures((departuresResult.data ?? []) as Departure[])
    setLoading(false)
  }

  useEffect(() => {
    let alive = true

    loadData()

    const settingsChannel = supabase
      .channel('admin-accommodation-settings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accommodation_settings' }, async () => {
        if (!alive) return
        await loadData()
      })
      .subscribe()

    const departuresChannel = supabase
      .channel('admin-accommodation-settings-departures-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departures' }, async () => {
        if (!alive) return
        await loadData()
      })
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(settingsChannel)
      supabase.removeChannel(departuresChannel)
    }
  }, [])

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

  const minimums = useMemo(
    () => ({
      double_total: departures.reduce((max, item) => Math.max(max, item.double_occupied), 0),
      triple_total: departures.reduce((max, item) => Math.max(max, item.triple_occupied), 0),
      quad_total: departures.reduce((max, item) => Math.max(max, item.quad_occupied), 0),
    }),
    [departures],
  )

  const hasChanges =
    !!draft &&
    !!settings &&
    (draft.double_total !== settings.double_total ||
      draft.triple_total !== settings.triple_total ||
      draft.quad_total !== settings.quad_total)

  function adjust(key: CapacityKey, delta: number) {
    setDraft((prev) => {
      if (!prev) return prev
      const min = minimums[key]
      return { ...prev, [key]: clamp(prev[key] + delta, min, 999) }
    })
  }

  async function handleSave() {
    if (!draft) return

    setSaving(true)
    setErrorText('')
    setSuccessText('')

    const payload = {
      id: 1,
      double_total: Math.max(draft.double_total, minimums.double_total),
      triple_total: Math.max(draft.triple_total, minimums.triple_total),
      quad_total: Math.max(draft.quad_total, minimums.quad_total),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('accommodation_settings')
      .upsert(payload, { onConflict: 'id' })
      .select('id, double_total, triple_total, quad_total, updated_at')
      .single()

    if (error) {
      setErrorText('Zmena sa neuložila. Skús ešte raz.')
    } else {
      setSettings(data as AccommodationSettings)
      setDraft(data as AccommodationSettings)
      setSuccessText('Kapacity apartmánov boli uložené.')
      window.setTimeout(() => setSuccessText(''), 1600)
    }

    setSaving(false)
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      navigate('/admin/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
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
    '--hero-shadow': isDarkMode ? '0 10px 26px rgba(0,0,0,0.30)' : '0 10px 26px rgba(15,23,42,0.06)',
    '--card-bg': isDarkMode ? '#0f172a' : '#ffffff',
    '--card-border': isDarkMode ? '#334155' : '#e2e8f0',
    '--card-shadow': isDarkMode ? '0 10px 26px rgba(0,0,0,0.26)' : '0 10px 26px rgba(15,23,42,0.06)',
    '--soft-bg': isDarkMode ? '#111827' : '#f8fafc',
    '--soft-border': isDarkMode ? '#334155' : '#e2e8f0',
    '--button-dark': isDarkMode ? '#1e293b' : '#0f172a',
    '--button-dark-disabled': isDarkMode ? '#334155' : '#cbd5e1',
    '--button-dark-text': '#ffffff',
    '--count-bg': isDarkMode ? '#0b1220' : '#ffffff',
    '--count-border': isDarkMode ? '#475569' : '#cbd5e1',
    '--count-text': isDarkMode ? '#ffffff' : '#0f172a',
    '--success-bg': isDarkMode ? '#052e16' : '#f0fdf4',
    '--success-text': isDarkMode ? '#86efac' : '#166534',
    '--danger-bg': isDarkMode ? '#3f1d1d' : '#fef2f2',
    '--danger-text': isDarkMode ? '#fca5a5' : '#b91c1c',
    '--secondary-link-bg': isDarkMode ? '#0b1220' : '#ffffff',
    '--secondary-link-border': isDarkMode ? '#475569' : '#cbd5e1',
    '--secondary-link-text': isDarkMode ? '#93c5fd' : '#1d4ed8',
    '--accent-bg': isDarkMode ? '#082f49' : '#eff6ff',
    '--accent-border': isDarkMode ? '#155e75' : '#bfdbfe',
    '--accent-text': isDarkMode ? '#bae6fd' : '#1e3a8a',
    '--primary-shadow': isDarkMode
      ? '0 16px 34px rgba(20, 184, 166, 0.18)'
      : '0 16px 34px rgba(15, 118, 110, 0.22)',
  }

  if (loading || !draft) {
    return (
      <main
        style={{
          ...themeVars,
          ...loadingPageStyle,
          colorScheme: isDarkMode ? 'dark' : 'light',
        }}
      >
        Načítavam nastavenie apartmánov...
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
              <h1 style={titleStyle}>Nastavenie apartmánov</h1>
              <p style={textStyle}>
                Tu meníš globálny počet funkčných apartmánov. Verejná stránka aj admin zmeny automaticky prepočítajú.
              </p>
            </div>

            <div style={actionsWrapStyle}>
              <Link to="/admin" style={secondaryLinkButtonStyle}>
                Späť do adminu
              </Link>

              <button type="button" onClick={handleLogout} style={logoutButtonStyle} disabled={loggingOut}>
                {loggingOut ? 'Odhlasujem...' : 'Odhlásiť sa'}
              </button>
            </div>
          </div>
        </section>

        {errorText ? <div style={errorStyle}>{errorText}</div> : null}
        {successText ? <div style={successStyle}>{successText}</div> : null}

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Globálne kapacity pre všetky termíny</div>

          <div style={settingsGridStyle}>
            <SettingsStepper
              label="2-lôžkové apartmány"
              value={draft.double_total}
              min={minimums.double_total}
              onMinus={() => adjust('double_total', -1)}
              onPlus={() => adjust('double_total', 1)}
            />

            <SettingsStepper
              label="3-lôžkové apartmány"
              value={draft.triple_total}
              min={minimums.triple_total}
              onMinus={() => adjust('triple_total', -1)}
              onPlus={() => adjust('triple_total', 1)}
            />

            <SettingsStepper
              label="4-lôžkové apartmány"
              value={draft.quad_total}
              min={minimums.quad_total}
              onMinus={() => adjust('quad_total', -1)}
              onPlus={() => adjust('quad_total', 1)}
            />
          </div>

          <div style={infoCardStyle}>
            Hodnotu nejde znížiť pod už obsadený počet v niektorom termíne. Tak sa zabráni tomu, aby bolo obsadených viac apartmánov než funkčných.
          </div>

          <div style={footerActionsStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={() => setDraft(settings)} disabled={!hasChanges || saving}>
              Obnoviť pôvodné
            </button>

            <button type="button" style={primaryButtonStyle} onClick={handleSave} disabled={!hasChanges || saving}>
              {saving ? 'Ukladám...' : 'Uložiť nastavenie'}
            </button>
          </div>
        </section>
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

const cardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  borderRadius: 20,
  padding: 14,
  border: '1px solid var(--card-border)',
  boxShadow: 'var(--card-shadow)',
  display: 'grid',
  gap: 14,
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: 'var(--text-strong)',
}

const settingsGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const stepperCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 14,
  borderRadius: 16,
  background: 'var(--soft-bg)',
  border: '1px solid var(--soft-border)',
}

const stepperLabelStyle: CSSProperties = {
  fontSize: 17,
  lineHeight: 1.25,
  fontWeight: 800,
  color: 'var(--text-strong)',
}

const stepperHintStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.4,
  color: 'var(--text-muted)',
  fontWeight: 700,
}

const stepperRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
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

const infoCardStyle: CSSProperties = {
  borderRadius: 16,
  padding: 14,
  background: 'var(--accent-bg)',
  border: '1px solid var(--accent-border)',
  color: 'var(--accent-text)',
  fontSize: 14,
  lineHeight: 1.45,
  fontWeight: 700,
}

const footerActionsStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const secondaryButtonStyle: CSSProperties = {
  minHeight: 52,
  border: '1px solid var(--secondary-link-border)',
  borderRadius: 16,
  background: 'var(--secondary-link-bg)',
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