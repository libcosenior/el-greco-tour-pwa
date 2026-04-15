export type BoardingStop = {
  id: string
  label: string
  time: string
}

export const BOARDING_STOPS: BoardingStop[] = [
  { id: 'bb', label: 'Banská Bystrica pri aut. stanici benz. pumpa Shell', time: '4,00 h' },
  { id: 'mt', label: 'Martin – Tesco pri aut. zastavke', time: '4,50 h' },
  { id: 'za', label: 'Žilina - hypertesco pri benz. pumpe Tesco', time: '5,30 h' },
  { id: 'pb', label: 'Pov. Bystrica - centrum parkovisko', time: '6,00 h' },
  { id: 'tn', label: 'Trenčín – želez. stanica aut. zastavka č. 5', time: '6,40 h' },
  { id: 'ze', label: 'Zeleneč dialnica pri benz. pumpe OMV', time: '7,40 h' },
  { id: 'ba', label: 'Bratislava – výpadovka na Šamorín benz. pumpa Slovnaft', time: '8,20 h' },
  { id: 'sa', label: 'Šamorín aut. stanica pri benz. pumpe Slovnaft', time: '8,50 h' },
  { id: 'ds', label: 'Dunajská Streda - želez. stanica', time: '9,30 h' },
  { id: 'vm', label: 'Veľký Meder - benz. pumpa Slovnaft na začiatku mesta', time: '10,00 h' },
  { id: 'kn', label: 'Komárno - benz. pumpa HOFFER na začiatku mesta', time: '10,40 h' },
]