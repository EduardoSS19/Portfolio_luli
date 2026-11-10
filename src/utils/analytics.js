const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID

let analyticsEnabled = false

export function initializeAnalytics() {
  if (analyticsEnabled || !/^G-[A-Z0-9]+$/i.test(measurementId || '')) return

  const params = new URLSearchParams(window.location.search)
  // Pré-visualizações privadas e telas de diagnóstico não representam visitas públicas.
  if (params.has('preview_token') || params.get('grade-debug') === '1') return

  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments)
  }

  window.gtag('js', new Date())
  window.gtag('config', measurementId, {
    send_page_view: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  script.dataset.ga4 = measurementId
  document.head.appendChild(script)
  analyticsEnabled = true
}

export function trackAnalyticsEvent(eventName, parameters = {}) {
  if (!analyticsEnabled || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, parameters)
}
