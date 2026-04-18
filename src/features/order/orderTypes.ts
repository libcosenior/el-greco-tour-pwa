export type TransportType = '' | 'own' | 'bus'
export type ChainLength = 1 | 2 | 3

export type OrderFormValues = {
  departureId: string
  chainLength: ChainLength
  customerName: string
  birthDate: string
  permanentResidence: string
  mobile: string
  email: string
  transport: TransportType
  boardingStopId: string
  adults: number
  children: number
  childrenAge0to6: number
  childrenAge7to15: number
  doubleApartments: number
  tripleApartments: number
  quadApartments: number
  note: string
}

export function createInitialOrderForm(): OrderFormValues {
  return {
    departureId: '',
    chainLength: 1,
    customerName: '',
    birthDate: '',
    permanentResidence: '',
    mobile: '',
    email: '',
    transport: '',
    boardingStopId: '',
    adults: 1,
    children: 0,
    childrenAge0to6: 0,
    childrenAge7to15: 0,
    doubleApartments: 0,
    tripleApartments: 0,
    quadApartments: 0,
    note: 'Prosím o cenovú ponuku.',
  }
}