/*
 * Geocoding and drive time (INTEGRATIONS §5). The default adapter is manual: it places an address at
 * its ZIP centroid (quality "zip"), which is enough for service-area checks and rough drive-time
 * ranking. A Mapbox or Google adapter returns rooftop points and a real drive matrix; business code
 * only sees this interface.
 */

export type GeocodeInput = { address1: string; city: string; state: string; postalCode: string }
export type GeocodeResult = { lat: string | null; lng: string | null; quality: 'rooftop' | 'interpolated' | 'zip' | 'failed'; postalCode: string; timeZone: string }

export interface GeocodeAdapter {
  readonly key: string
  geocode(input: GeocodeInput): Promise<GeocodeResult>
}

/** Approximate ZIP centroids for the Summit service area (ranking only; never shown as an address). */
export const ZIP_CENTROIDS: Record<string, [string, string]> = {
  '78701': ['30.271100', '-97.743700'], '78702': ['30.263300', '-97.716600'], '78703': ['30.294400', '-97.766000'],
  '78704': ['30.242800', '-97.765800'], '78705': ['30.294800', '-97.738600'], '78721': ['30.272200', '-97.683700'],
  '78722': ['30.289600', '-97.714900'], '78723': ['30.304600', '-97.685600'], '78741': ['30.231000', '-97.721000'],
  '78744': ['30.183800', '-97.739500'], '78745': ['30.206700', '-97.795600'], '78746': ['30.294400', '-97.810900'],
  '78748': ['30.162600', '-97.822700'], '78749': ['30.213300', '-97.858600'], '78751': ['30.310500', '-97.723400'],
  '78756': ['30.322300', '-97.739800'], '78757': ['30.351600', '-97.731700'], '78758': ['30.387600', '-97.706500'],
  '78759': ['30.403500', '-97.752500'], '78613': ['30.505200', '-97.820300'], '78660': ['30.439400', '-97.620000'],
  '78664': ['30.514600', '-97.668300'], '78665': ['30.545000', '-97.644300'], '78681': ['30.518500', '-97.714400'],
  '78717': ['30.490000', '-97.753900'], '78727': ['30.426800', '-97.718900'], '78728': ['30.450200', '-97.688900'],
  '78729': ['30.452100', '-97.768800'], '78750': ['30.422000', '-97.796600'],
}

export function manualGeocoder(timeZone = 'America/Chicago'): GeocodeAdapter {
  return {
    key: 'manual',
    async geocode(input) {
      const zip = input.postalCode.trim().slice(0, 5)
      const point = ZIP_CENTROIDS[zip]
      return point ? { lat: point[0], lng: point[1], quality: 'zip', postalCode: zip, timeZone } : { lat: null, lng: null, quality: 'failed', postalCode: zip, timeZone }
    },
  }
}

let current: GeocodeAdapter = manualGeocoder()
export const geocoder = () => current
/** Tests and the integration settings screen swap the adapter; business code never constructs one. */
export function setGeocoder(adapter: GeocodeAdapter) {
  current = adapter
}
