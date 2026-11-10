let analyticsEnabled = false

export function initializeAnalytics() {
  // O snippet do GTM é executado no <head>, antes do bundle React.
  // Aqui apenas liberamos os eventos da aplicação para a dataLayer já existente.
  if (analyticsEnabled || !window.dataLayer) return
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
