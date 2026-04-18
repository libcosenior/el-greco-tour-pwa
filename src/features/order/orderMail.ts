import { BOARDING_STOPS } from './orderConstants'
import type { OrderFormValues } from './orderTypes'

export type OrderDeparture = {
  trip_code: string
  start_date: string
  end_date: string
  days_count: number
  nights_count: number
}

const NOTE_PREFIX = 'Prosím o cenovú ponuku.'

function formatDate(dateIso: string): string {
  const onlyDate = dateIso.split('T')[0]
  const parts = onlyDate.split('-')

  if (parts.length !== 3) return dateIso

  const [year, month, day] = parts
  return `${day}.${month}.${year}`
}

function formatBirthDate(value: string): string {
  if (!value) return ''

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    return value
  }

  const parts = value.split('-')

  if (parts.length !== 3) return value

  const [year, month, day] = parts
  return `${day}.${month}.${year}`
}

function getTotalBeds(form: OrderFormValues): number {
  return form.doubleApartments * 2 + form.tripleApartments * 3 + form.quadApartments * 4
}

function getTripCodesLabel(departures: OrderDeparture[]): string {
  return departures.map((item) => item.trip_code).join(' + ')
}

function getCombinedTripDateRange(departures: OrderDeparture[]): string {
  if (departures.length === 0) return '-'

  const first = departures[0]
  const last = departures[departures.length - 1]

  return `${formatDate(first.start_date)} – ${formatDate(last.end_date)}`
}

function getCombinedDaysAndNights(departures: OrderDeparture[]) {
  return departures.reduce(
    (acc, item) => ({
      days: acc.days + item.days_count,
      nights: acc.nights + item.nights_count,
    }),
    { days: 0, nights: 0 },
  )
}

function buildFinalNote(note: string): string {
  const trimmed = note.trim()

  if (!trimmed) {
    return NOTE_PREFIX
  }

  if (trimmed.startsWith(NOTE_PREFIX)) {
    return trimmed
  }

  return `${NOTE_PREFIX}\n\n${trimmed}`
}

export function formatTripDateRange(departure: OrderDeparture): string {
  return `${formatDate(departure.start_date)} – ${formatDate(departure.end_date)}`
}

export function buildOrderEmailBody(departures: OrderDeparture[], form: OrderFormValues): string {
  const selectedStop = BOARDING_STOPS.find((item) => item.id === form.boardingStopId)
  const combined = getCombinedDaysAndNights(departures)
  const tripCodesLabel = getTripCodesLabel(departures)

  const lines: string[] = [
    'OBJEDNÁVKA ZÁJAZDU',
    '',
    `Zájazd číslo: ${tripCodesLabel || '-'}`,
  ]

  if (departures.length <= 1) {
    const departure = departures[0]

    if (departure) {
      lines.push(
        `Termín: ${formatTripDateRange(departure)}`,
        `Počet dní / nocí: ${departure.days_count} dní / ${departure.nights_count} nocí`,
      )
    } else {
      lines.push(
        'Termín: -',
        'Počet dní / nocí: -',
      )
    }
  } else {
    lines.push(
      '',
      'ZVOLENÉ TERMÍNY',
      ...departures.map((item) => `- ${item.trip_code} | ${formatTripDateRange(item)} | ${item.days_count} dní / ${item.nights_count} nocí`),
      '',
      `Spolu pobyt: ${getCombinedTripDateRange(departures)}`,
      `Počet dní / nocí spolu: ${combined.days} dní / ${combined.nights} nocí`,
    )
  }

  lines.push(
    '',
    'UBYTOVANIE',
    `Dvojlôžkový apartmán: ${form.doubleApartments}`,
    `Trojlôžkový apartmán: ${form.tripleApartments}`,
    `Štvorlôžkový apartmán: ${form.quadApartments}`,
    `Spolu lôžok: ${getTotalBeds(form)}`,
    '',
    'OBJEDNÁVATEĽ',
    `Titul, meno a priezvisko: ${form.customerName}`,
    `Dátum narodenia: ${formatBirthDate(form.birthDate)}`,
    `Trvalý pobyt: ${form.permanentResidence}`,
    `Mobil: ${form.mobile}`,
    `Email: ${form.email}`,
    '',
    'DOPRAVA',
    form.transport === 'bus' ? 'Autobusom' : 'Vlastná',
  )

  if (form.transport === 'bus') {
    lines.push(
      '',
      'NÁSTUPNÁ ZASTÁVKA',
      selectedStop ? `${selectedStop.label} — ${selectedStop.time}` : '-',
    )
  }

  lines.push(
    '',
    'ČLENOVIA ZÁJAZDU',
    `Dospelí: ${form.adults}`,
    `Deti: ${form.children}`,
    '',
    'VEK DETÍ',
    `Od 0 do 6 rokov: ${form.childrenAge0to6}`,
    `Nad 6 do 15 rokov: ${form.childrenAge7to15}`,
    '',
    'POZNÁMKA',
    buildFinalNote(form.note),
  )

  return lines.join('\n')
}

export function buildOrderMailtoUrl(toEmail: string, departures: OrderDeparture[], form: OrderFormValues): string {
  const subjectTripCodes = getTripCodesLabel(departures)
  const subject = subjectTripCodes ? `Objednávka zájazdu ${subjectTripCodes}` : 'Objednávka zájazdu'
  const body = buildOrderEmailBody(departures, form)

  return `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}