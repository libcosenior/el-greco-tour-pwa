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

function formatBirthDate(dateIso: string): string {
  if (!dateIso) return ''
  const parts = dateIso.split('-')

  if (parts.length !== 3) return dateIso

  const [year, month, day] = parts
  return `${day}.${month}.${year}`
}

function checkbox(checked: boolean): string {
  return checked ? '☒' : '☐'
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
    'OBJEDNÁVATEĽ',
    `Titul, meno a priezvisko: ${form.customerName}`,
    `Dátum narodenia: ${formatBirthDate(form.birthDate)}`,
    `Trvalý pobyt: ${form.permanentResidence}`,
    `Mobil: ${form.mobile}`,
    '',
    'DOPRAVA',
    `${checkbox(form.transport === 'own')} vlastná`,
    `${checkbox(form.transport === 'bus')} autobusom`,
  ]

  if (form.transport === 'bus') {
    lines.push('', 'NÁSTUPNÉ ZASTÁVKY')

    BOARDING_STOPS.forEach((stop) => {
      lines.push(`${checkbox(stop.id === form.boardingStopId)} ${stop.label} — ${stop.time}`)
    })

    lines.push('', `Vybraná nástupná zastávka: ${selectedStop ? `${selectedStop.label} — ${selectedStop.time}` : '-'}`)
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