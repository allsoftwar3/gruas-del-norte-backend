import axios from 'axios'

interface DirectionsResult {
  distanceKm: number
  durationMin: number
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function getDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<DirectionsResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey || apiKey.startsWith('AIza...') || apiKey === 'AIza...') {
    const km = haversineKm(originLat, originLng, destLat, destLng) * 1.3
    return { distanceKm: km, durationMin: Math.ceil(km / 30 * 60) }
  }

  try {
    const url = 'https://maps.googleapis.com/maps/api/directions/json'
    const { data } = await axios.get(url, {
      params: { origin: `${originLat},${originLng}`, destination: `${destLat},${destLng}`, key: apiKey },
    })

    if (data.status !== 'OK' || !data.routes.length) {
      const km = haversineKm(originLat, originLng, destLat, destLng) * 1.3
      return { distanceKm: km, durationMin: Math.ceil(km / 30 * 60) }
    }

    const leg = data.routes[0].legs[0]
    return { distanceKm: leg.distance.value / 1000, durationMin: Math.ceil(leg.duration.value / 60) }
  } catch {
    const km = haversineKm(originLat, originLng, destLat, destLng) * 1.3
    return { distanceKm: km, durationMin: Math.ceil(km / 30 * 60) }
  }
}
