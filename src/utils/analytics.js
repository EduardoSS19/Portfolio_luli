const containerId = import.meta.env.VITE_GTM_ID

let analyticsEnabled = false

export function initializeAnalytics() {
  if (analyticsEnabled || !/^GTM-[A-Z0-9]+$/i.test(containerId || '')) return

  const params = new URLSearchParams(window.location.search)
  // Pré-visualizações privadas e telas de diagnóstico não representam visitas públicas.
  if (params.has('preview_token') || params.get('grade-debug') === '1') return

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    'gtm.start': Date.now(),
    event: 'gtm.js',
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`
  script.dataset.gtm = containerId
  document.head.appendChild(script)
  analyticsEnabled = true
}

export function trackAnalyticsEvent(eventName, parameters = {}) {
  if (!analyticsEnabled) return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    ...parameters,
    event: eventName,
  })
}
