import { BOARDING_STOPS } from './orderConstants'
import type { OrderFormValues } from './orderTypes'

export type OrderDeparture = {
  trip_code: string
  start_date: string
  end_date: string
  days_count: number
  nights_count: number
}

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

export function formatTripDateRange(departure: OrderDeparture): string {
  return `${formatDate(departure.start_date)} – ${formatDate(departure.end_date)}`
}

export function buildOrderEmailBody(departure: OrderDeparture, form: OrderFormValues): string {
  const selectedStop = BOARDING_STOPS.find((item) => item.id === form.boardingStopId)

  const lines: string[] = [
    'OBJEDNÁVKA ZÁJAZDU',
    '',
    `Zájazd číslo: ${departure.trip_code}`,
    `Termín: ${formatTripDateRange(departure)}`,
    `Počet dní / nocí: ${departure.days_count} dní / ${departure.nights_count} nocí`,
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
  ]

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
    form.note.trim() ? form.note.trim() : '-',
  )

  return lines.join('\n')
}

export function buildOrderMailtoUrl(toEmail: string, departure: OrderDeparture, form: OrderFormValues): string {
  const subject = `Objednávka zájazdu ${departure.trip_code}`
  const body = buildOrderEmailBody(departure, form)

  return `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}