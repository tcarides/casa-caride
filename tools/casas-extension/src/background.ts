/**
 * Background Service Worker
 *
 * Responsabilidades:
 * - Recibir propiedad extraída desde content scripts
 * - Responder al popup con la propiedad del tab activo
 * - Badge en el ícono cuando hay una propiedad disponible
 */

import type { ExtractedData, Message } from './shared/types'

// Mapa tabId → datos extraídos en esa pestaña
const tabProperties = new Map<number, ExtractedData>()

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  switch (message.type) {
    case 'PROPERTY_EXTRACTED': {
      const tabId = sender.tab?.id
      if (tabId) {
        tabProperties.set(tabId, message.data)
        // Mostrar badge verde para indicar que hay propiedad disponible
        chrome.action.setBadgeText({ text: '★', tabId })
        chrome.action.setBadgeBackgroundColor({ color: '#16a34a', tabId })
      }
      sendResponse({ ok: true })
      break
    }

    case 'GET_CURRENT_PROPERTY': {
      // El popup pregunta qué propiedad tiene el tab activo
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        const data = tabId ? tabProperties.get(tabId) : undefined
        sendResponse({ ok: true, data: data ?? null })
      })
      return true // Indica que sendResponse se llama async
    }

    default:
      sendResponse({ ok: false, error: 'Unknown message type' })
  }
})

// Limpiar datos cuando se cierra una pestaña
chrome.tabs.onRemoved.addListener((tabId) => {
  tabProperties.delete(tabId)
})

// Al navegar a otra URL en el mismo tab, limpiar datos anteriores
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    tabProperties.delete(tabId)
    chrome.action.setBadgeText({ text: '', tabId })
  }
})
