import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'

type ThemeStyleVars = CSSProperties & Record<`--${string}`, string>

type BoardingPoint = {
  place: string
  time: string
}

const INCLUDED_ITEMS = [
  'ubytovanie podľa počtu nocí za apartmán',
  'spotreba vody, elektriny, DPH, posteľné prádlo',
  'záverečné upratovanie',
  'zákonné poistenie CK voči insolventnosti',
]

const EXTRA_ITEMS = [
  'poistné KCP Union poisťovňa a.s.',
  'doprava 160 € / osoba',
  'dvojsedadlo v autobuse: 50 €',
  'pobytová taxa / enviromentálna: 1,50 € / noc / apartmán',
  'spojenie 2 termínov: 50 € / osoba',
  'za príplatok klimatizačné zariadenie',
]

const DISCOUNT_ITEMS = [
  'dieťa nad 6 – 15 r., ak cestuje s dvomi dospelými osobami, platí iba dopravu 160 €',
  'ak cestujú 2 deti, platí sa 1× trojlôžkový apartmán + 4× doprava',
  'dieťa 0 – 6 r. úplne zadarmo pri doprave Interbus s.r.o., ak cestuje ako 3. osoba s dvoma platiacimi osobami',
  'ak cestuje 1 dospelá osoba s dieťaťom 0 – 15 r., platí sa celý apartmán a 2× doprava',
  'vernostná zľava 10 %',
  '1 dospelá osoba, ak cestuje sama, platí celý dvojlôžkový apartmán podľa katalógovej ceny s 10 % zľavou',
  'skupinové zľavy nad 10 osôb podľa dohody',
]

const PROGRAM_ITEMS = [
  '1. deň: v ranných hodinách odchod zo SR z Banskej Bystrice o 4:00, cesta trvá cca 17 h od hraničného priechodu.',
  '2. deň: príchod do Paralie v ranných hodinách, do 13:00 ubytovanie, potom individuálny voľný program.',
  '16. deň: do 9:00 opustenie apartmánu, individuálny voľný program, odchod z Paralie o 13:00 gréckeho času.',
  '17. deň: príchod v ranných hodinách na Slovensko.',
]

const BOARDING_POINTS: BoardingPoint[] = [
  { place: 'Banská Bystrica – pri autobusovej stanici, benz. pumpa Shell', time: '4:00' },
  { place: 'Martin – Tesco pri autobusovej zastávke', time: '4:50' },
  { place: 'Žilina – hypertesco pri benz. pumpe Tesco', time: '5:30' },
  { place: 'Považská Bystrica – centrum parkovisko', time: '6:00' },
  { place: 'Trenčín – železničná stanica, autobusová zastávka č. 5', time: '6:40' },
  { place: 'Zeleneč – diaľnica pri benz. pumpe OMV', time: '7:40' },
  { place: 'Bratislava – výpadovka na Šamorín, benz. pumpa Slovnaft', time: '8:20' },
  { place: 'Šamorín – autobusová stanica pri benz. pumpe Slovnaft', time: '8:50' },
  { place: 'Dunajská Streda – železničná stanica', time: '9:30' },
  { place: 'Veľký Meder – benz. pumpa Slovnaft na začiatku mesta', time: '10:00' },
  { place: 'Komárno – benz. pumpa HOFFER na začiatku mesta', time: '10:40' },
]

export default function Pricelist2026Page() {
  const navigate = useNavigate()

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

  const themeVars: ThemeStyleVars = {
    '--page-bg': isDarkMode
      ? 'linear-gradient(180deg, #020617 0%, #0f172a 24%, #111827 100%)'
      : 'linear-gradient(180deg, #e8f4ff 0%, #f4f8fc 24%, #f6f8fb 100%)',
    '--text-main': isDarkMode ? '#f8fafc' : '#0f172a',
    '--text-secondary': isDarkMode ? '#cbd5e1' : '#475569',
    '--text-muted': isDarkMode ? '#94a3b8' : '#64748b',
    '--hero-bg': isDarkMode
      ? 'linear-gradient(145deg, rgba(15,23,42,0.96) 0%, rgba(17,24,39,0.94) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(240,249,255,0.94) 100%)',
    '--hero-border': isDarkMode ? 'rgba(71,85,105,0.68)' : 'rgba(255,255,255,0.8)',
    '--hero-shadow': isDarkMode
      ? '0 18px 50px rgba(0, 0, 0, 0.34)'
      : '0 18px 50px rgba(15, 23, 42, 0.08)',
    '--card-bg': isDarkMode
      ? 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(17,24,39,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
    '--card-border': isDarkMode ? 'rgba(71,85,105,0.72)' : 'rgba(226,232,240,0.9)',
    '--card-shadow': isDarkMode
      ? '0 16px 42px rgba(0, 0, 0, 0.28)'
      : '0 16px 42px rgba(15, 23, 42, 0.07)',
    '--panel-bg': isDarkMode ? 'rgba(11,18,32,0.92)' : 'rgba(248,250,252,0.96)',
    '--panel-border': isDarkMode ? '#334155' : '#e2e8f0',
    '--highlight-bg': isDarkMode ? 'rgba(8,47,73,0.86)' : 'rgba(240,249,255,0.95)',
    '--highlight-border': isDarkMode ? '#155e75' : '#dbeafe',
    '--warning-bg': isDarkMode ? '#3b2412' : '#fff7ed',
    '--warning-border': isDarkMode ? '#9a3412' : '#fed7aa',
    '--warning-text': isDarkMode ? '#fdba74' : '#9a3412',
    '--accent': '#0f766e',
    '--button-shadow': isDarkMode
      ? '0 16px 34px rgba(20, 184, 166, 0.18)'
      : '0 16px 34px rgba(15, 118, 110, 0.22)',
    '--orb-top': isDarkMode
      ? 'radial-gradient(circle, rgba(20,184,166,0.16) 0%, rgba(20,184,166,0) 72%)'
      : 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 72%)',
    '--orb-bottom': isDarkMode
      ? 'radial-gradient(circle, rgba(45,212,191,0.14) 0%, rgba(45,212,191,0) 72%)'
      : 'radial-gradient(circle, rgba(16,185,129,0.16) 0%, rgba(16,185,129,0) 72%)',
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
        <div style={topActionsStyle}>
          <button type="button" style={backButtonStyle} onClick={() => navigate('/')}>
            ← Späť na verejnú stránku
          </button>
        </div>

        <header style={heroStyle}>
          <div style={heroEyebrowStyle}>CK EL GRECO TOUR</div>
          <h1 style={heroTitleStyle}>Informácie o zájazde</h1>
          <p style={heroSubtitleStyle}>
            Katerini – Paralia, rušné letovisko na Olympskej riviére v okrese Pieria
          </p>

          <div style={heroInfoGridStyle}>
            <div style={heroInfoCardStyle}>
              <div style={heroInfoLabelStyle}>Hotel</div>
              <div style={heroInfoValueStyle}>aparthotel EL Greco **</div>
            </div>

            <div style={heroInfoCardStyle}>
              <div style={heroInfoLabelStyle}>Doprava</div>
              <div style={heroInfoValueStyle}>Interbus s.r.o.</div>
            </div>

            <div style={heroInfoCardStyle}>
              <div style={heroInfoLabelStyle}>Autobus</div>
              <div style={heroInfoValueStyle}>klimatizovaný luxusný autobus Setra</div>
            </div>

            <div style={heroInfoCardStyle}>
              <div style={heroInfoLabelStyle}>Trasa 2026</div>
              <div style={heroInfoValueStyle}>Maďarsko • Srbsko • Severné Macedónsko</div>
            </div>
          </div>
        </header>

        <section style={noteCardStyle}>
          Cena je uvedená za celý apartmán podľa typu a počtu nocí. Vlastná doprava je viazaná
          na autobusové termíny.
        </section>

        <section style={twoColumnSectionStyle}>
          <div style={infoPanelStyle}>
            <div style={panelTitleStyle}>Zľavy</div>
            <div style={listWrapStyle}>
              {DISCOUNT_ITEMS.map((item) => (
                <div key={item} style={listItemStyle}>
                  <span style={listBulletStyle}>•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={infoPanelStyle}>
            <div style={panelTitleStyle}>V cene je zahrnuté</div>
            <div style={listWrapStyle}>
              {INCLUDED_ITEMS.map((item) => (
                <div key={item} style={listItemStyle}>
                  <span style={listBulletStyle}>•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div style={panelDividerStyle} />

            <div style={panelTitleStyle}>Príplatky</div>
            <div style={listWrapStyle}>
              {EXTRA_ITEMS.map((item) => (
                <div key={item} style={listItemStyle}>
                  <span style={listBulletStyle}>•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div style={sectionEyebrowStyle}>Rámcový program</div>
            <h2 style={sectionTitleStyle}>Priebeh zájazdu</h2>
          </div>

          <div style={timelineGridStyle}>
            {PROGRAM_ITEMS.map((item, index) => (
              <div key={item} style={timelineItemStyle}>
                <div style={timelineNumberStyle}>{index + 1}</div>
                <div style={timelineTextStyle}>{item}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div style={sectionEyebrowStyle}>Nástupné miesta</div>
            <h2 style={sectionTitleStyle}>Časový rozpis</h2>
          </div>

          <div style={boardingGridStyle}>
            {BOARDING_POINTS.map((point) => (
              <div key={`${point.place}-${point.time}`} style={boardingCardStyle}>
                <div style={boardingPlaceStyle}>{point.place}</div>
                <div style={boardingTimeStyle}>{point.time}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={twoColumnSectionStyle}>
          <div style={infoPanelStyle}>
            <div style={panelTitleStyle}>Dôležité informácie</div>
            <div style={listWrapStyle}>
              <div style={listItemStyle}>
                <span style={listBulletStyle}>•</span>
                <span>
                  Počas pobytu je k dispozícii majiteľka hotela a aj slovensky hovoriaca
                  zamestnankyňa hotela.
                </span>
              </div>
              <div style={listItemStyle}>
                <span style={listBulletStyle}>•</span>
                <span>
                  Pri výmene turnusov je k dispozícii batožinový priestor, denný bar a toaleta.
                </span>
              </div>
              <div style={listItemStyle}>
                <span style={listBulletStyle}>•</span>
                <span>
                  Adresa hotela: Katerini Paralia, Pavlou Mela 18, 60100, tel.: 00302351064017
                </span>
              </div>
            </div>
          </div>

          <div style={warningPanelStyle}>
            <div style={panelTitleStyle}>Upozornenie</div>
            <div style={warningTextStyle}>
              Cestovné poistenie nie je povinný príplatok, ale CK odporúča si ho doobjednať.
              Každá osoba bez ohľadu na vek musí mať platné doklady: občiansky preukaz alebo
              cestovný pas. Dieťa musí mať platný cestovný pas alebo OP s fotografiou.
            </div>
          </div>
        </section>

        <div style={bottomActionsStyle}>
          <button type="button" style={primaryButtonStyle} onClick={() => navigate('/')}>
            Späť na verejnú stránku
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
  maxWidth: 1100,
  margin: '0 auto',
  padding: '18px 14px 34px',
  boxSizing: 'border-box',
  display: 'grid',
  gap: 18,
}

const topActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-start',
}

const backButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  fontSize: 15,
  fontWeight: 800,
  padding: '8px 0 4px',
  cursor: 'pointer',
}

const heroStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  borderRadius: 28,
  padding: 22,
  background: 'var(--hero-bg)',
  border: '1px solid var(--hero-border)',
  boxShadow: 'var(--hero-shadow)',
}

const heroEyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  textAlign: 'center',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.08,
  fontWeight: 900,
  textAlign: 'center',
  color: 'var(--text-main)',
}

const heroSubtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.5,
  fontWeight: 600,
  textAlign: 'center',
  color: 'var(--text-secondary)',
}

const heroInfoGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const heroInfoCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  background: 'var(--panel-bg)',
  border: '1px solid var(--panel-border)',
  textAlign: 'center',
}

const heroInfoLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-muted)',
}

const heroInfoValueStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 17,
  fontWeight: 900,
  color: 'var(--text-main)',
}

const noteCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: 'var(--highlight-bg)',
  border: '1px solid var(--highlight-border)',
  fontSize: 15,
  lineHeight: 1.5,
  fontWeight: 800,
  color: 'var(--text-main)',
  textAlign: 'center',
}

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
}

const sectionEyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.1,
  fontWeight: 900,
  color: 'var(--text-main)',
}

const twoColumnSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
}

const infoPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 24,
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  boxShadow: 'var(--card-shadow)',
}

const warningPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 24,
  background: 'var(--warning-bg)',
  border: '1px solid var(--warning-border)',
  boxShadow: 'var(--card-shadow)',
}

const panelTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: 'var(--text-main)',
}

const panelDividerStyle: CSSProperties = {
  height: 1,
  background: 'var(--panel-border)',
}

const listWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const listItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '16px 1fr',
  gap: 10,
  alignItems: 'start',
  fontSize: 15,
  lineHeight: 1.5,
  fontWeight: 600,
  color: 'var(--text-secondary)',
}

const listBulletStyle: CSSProperties = {
  color: 'var(--accent)',
  fontWeight: 900,
}

const timelineGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const timelineItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '44px 1fr',
  gap: 12,
  alignItems: 'center',
  padding: 14,
  borderRadius: 18,
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  boxShadow: 'var(--card-shadow)',
}

const timelineNumberStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
  color: '#ffffff',
  fontWeight: 900,
  fontSize: 18,
}

const timelineTextStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
  fontWeight: 700,
  color: 'var(--text-main)',
}

const boardingGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
}

const boardingCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 18,
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  boxShadow: 'var(--card-shadow)',
}

const boardingPlaceStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.45,
  fontWeight: 800,
  color: 'var(--text-main)',
}

const boardingTimeStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: 'var(--accent)',
}

const warningTextStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.55,
  fontWeight: 700,
  color: 'var(--warning-text)',
}

const bottomActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  paddingTop: 4,
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 56,
  border: 'none',
  borderRadius: 18,
  padding: '0 24px',
  background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 55%, #2dd4bf 100%)',
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 900,
  letterSpacing: 0.3,
  cursor: 'pointer',
  boxShadow: 'var(--button-shadow)',
}