import { supabase } from './supabase'

type PushSubscriptionJson = {
  endpoint: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

type SubscribeAvailabilityResult =
  | { status: 'enabled' }
  | { status: 'unsupported'; message: string }
  | { status: 'denied'; message: string }
  | { status: 'error'; message: string }

export type PushSubscriptionStatus = 'unsupported' | 'subscribed' | 'not-subscribed'

export type AvailabilityPushPayload = {
  departureId: string
  tripCode: string
  startDate: string
  endDate: string
  apartmentType: 'double' | 'triple' | 'quad'
  freeCount: number
}

function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.ready
  return registration
}

function extractSubscriptionJson(subscription: PushSubscription): PushSubscriptionJson {
  const json = subscription.toJSON() as PushSubscriptionJson
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
  }
}

async function persistSubscription(subscription: PushSubscription): Promise<void> {
  const subscriptionJson = extractSubscriptionJson(subscription)

  const { error } = await supabase.functions.invoke('register-push-subscription', {
    body: {
      subscription: subscriptionJson,
    },
  })

  if (error) {
    throw new Error('Nepodarilo sa uložiť odber notifikácií na server.')
  }
}

export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  if (!isPushSupported()) return 'unsupported'

  const registration = await getServiceWorkerRegistration()
  const subscription = await registration.pushManager.getSubscription()
  return subscription ? 'subscribed' : 'not-subscribed'
}

export async function subscribeAvailabilityNotifications(): Promise<SubscribeAvailabilityResult> {
  if (!isPushSupported()) {
    return {
      status: 'unsupported',
      message: 'Toto zariadenie nepodporuje webové notifikácie.',
    }
  }

  if (Notification.permission === 'denied') {
    return {
      status: 'denied',
      message: 'Notifikácie sú v prehliadači zablokované. Povoľ ich v nastaveniach prehliadača.',
    }
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    return {
      status: 'error',
      message: 'Chýba VITE_VAPID_PUBLIC_KEY v .env.local.',
    }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return {
        status: 'denied',
        message: 'Bez povolenia notifikácií ti appka nevie posielať upozornenia.',
      }
    }

    const registration = await getServiceWorkerRegistration()

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
      })
    }

    await persistSubscription(subscription)

    return { status: 'enabled' }
  } catch (error) {
    console.error('Push subscribe failed:', error)
    return {
      status: 'error',
      message: 'Nepodarilo sa zapnúť upozornenia. Skús to ešte raz.',
    }
  }
}

export async function sendAvailabilityReleasedNotification(payload: AvailabilityPushPayload): Promise<{ sentCount: number }> {
  const { data, error } = await supabase.functions.invoke('send-availability-push', {
    body: payload,
  })

  if (error) {
    throw new Error('Nepodarilo sa odoslať push notifikáciu.')
  }

  const sentCount = typeof data?.sentCount === 'number' ? data.sentCount : 0
  return { sentCount }
}