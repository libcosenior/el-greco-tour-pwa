export type TransportType = '' | 'own' | 'bus'

export type OrderFormValues = {
  departureId: string
  customerName: string
  birthDate: string
  permanentResidence: string
  mobile: string
  transport: TransportType
  boardingStopId: string
  adults: number
  children: number
  childrenAge0to6: number
  childrenAge7to15: number
  note: string
}

export function createInitialOrderForm(): OrderFormValues {
  return {
    departureId: '',
    customerName: '',
    birthDate: '',
    permanentResidence: '',
    mobile: '',
    transport: '',
    boardingStopId: '',
    adults: 1,
    children: 0,
    childrenAge0to6: 0,
    childrenAge7to15: 0,
    note: '',
  }
}
