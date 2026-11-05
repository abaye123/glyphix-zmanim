import storage from '@system.storage'
import { CITIES } from './cities.js'

const KEY = 'city'

// The city the user picked, or null when none was picked yet.
export function loadCity() {
  try {
    const index = parseInt(storage.get(KEY), 10)
    return index >= 0 && index < CITIES.length ? index : null
  } catch (e) {
    console.warn('load city failed: ' + e)
    return null
  }
}

export function saveCity(index) {
  try {
    storage.set(KEY, String(index))
  } catch (e) {
    console.warn('save city failed: ' + e)
  }
}

export function nearestCity(lat, lon) {
  let best = 0, bestDistance = Infinity
  const scale = Math.cos(lat * Math.PI / 180)
  CITIES.forEach((c, i) => {
    const dLat = c.lat - lat, dLon = (c.lon - lon) * scale
    const distance = dLat * dLat + dLon * dLon
    if (distance < bestDistance) { best = i; bestDistance = distance }
  })
  return best
}

// Calls back with the nearest city. The watch gets a location only through a connected phone,
// so this stays silent when there is none.
export async function locateCity(callback) {
  try {
    const { default: geolocation } = await import('@system.geolocation')
    geolocation.getLocation({
      success: result => {
        const place = result.data || result
        callback(nearestCity(place.latitude, place.longitude))
      },
      fail: () => console.info('no location available')
    })
  } catch (e) {
    console.info('location not available: ' + e)
  }
}
