import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix Leaflet default icon broken in Vite builds
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface BusinessMapProps {
  lat: number | null | undefined
  lng: number | null | undefined
  onChange: (lat: number, lng: number) => void
  readOnly?: boolean
}

interface GeocodeResult {
  display_name: string
  lat: string
  lon: string
}

const TILE_SOURCES = [
  {
    url: '/tiles/osm/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    url: '/tiles/osmde/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  {
    url: '/tiles/carto/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
] as const

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])
  return null
}

function EnsureMapSize() {
  const map = useMap()
  useEffect(() => {
    const t1 = window.setTimeout(() => map.invalidateSize(), 0)
    const t2 = window.setTimeout(() => map.invalidateSize(), 250)
    const onResize = () => map.invalidateSize()

    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', onResize)
    }
  }, [map])

  return null
}

export default function BusinessMap({ lat, lng, onChange, readOnly = false }: BusinessMapProps) {
  const hasPin = lat != null && lng != null && (lat !== 0 || lng !== 0)
  const center: [number, number] = hasPin ? [lat!, lng!] : [20.6597, -103.3496]
  const [tileIndex, setTileIndex] = useState(0)
  const [lastTileSourceFailed, setLastTileSourceFailed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [geoattempted, setGeoattempted] = useState(false)
  const tileSource = useMemo(() => TILE_SOURCES[tileIndex], [tileIndex])
  const tilesUnavailable = tileIndex >= TILE_SOURCES.length - 1 && lastTileSourceFailed

  // Obtener ubicacion actual como default si no hay pin y no es readOnly.
  useEffect(() => {
    if (hasPin || readOnly || geoattempted) return

    setGeoattempted(true)
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        // Silenciar errores de geolocalizacion.
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
    )
  }, [hasPin, readOnly, geoattempted, onChange])

  const searchLocation = async () => {
    const q = searchQuery.trim()
    if (!q || readOnly) return

    setSearching(true)
    setSearchError('')
    setSearchResults([])

    try {
      const params = new URLSearchParams({
        q,
        limit: '5',
        format: 'jsonv2',
        addressdetails: '1',
        countrycodes: 'mx',
      })
      const res = await fetch(`/geocode/search?${params.toString()}`)

      if (!res.ok) {
        throw new Error('No se pudo buscar la direccion')
      }

      const data = (await res.json()) as GeocodeResult[]
      setSearchResults(Array.isArray(data) ? data : [])

      if (!data || data.length === 0) {
        setSearchError('Sin resultados para esa busqueda')
      }
    } catch {
      setSearchError('No se pudo consultar el buscador de ubicaciones')
    } finally {
      setSearching(false)
    }
  }

  const applySearchResult = (result: GeocodeResult) => {
    const latResult = Number(result.lat)
    const lngResult = Number(result.lon)
    if (!Number.isFinite(latResult) || !Number.isFinite(lngResult)) return

    onChange(latResult, lngResult)
    setSearchResults([])
    setSearchQuery(result.display_name)
  }

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  searchLocation()
                }
              }}
              className="input"
              placeholder="Buscar direccion o colonia"
            />
            <button
              type="button"
              className="btn btn-sm shrink-0"
              onClick={searchLocation}
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="rounded-lg border border-[#dee2e6] bg-white max-h-36 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.lat},${result.lon}`}
                  type="button"
                  className="w-full text-left px-3 py-2 text-[12px] text-[#495057] hover:bg-[#f8f9fa] border-b border-[#f1f3f5] last:border-b-0"
                  onClick={() => applySearchResult(result)}
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          )}

          {searchError && (
            <p className="text-[11px] text-[#dc2626]">{searchError}</p>
          )}
        </div>
      )}

      <div className="relative rounded-xl overflow-hidden border border-[#dee2e6]" style={{ height: 240 }}>
        <MapContainer
          center={center}
          zoom={hasPin ? 16 : 12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <EnsureMapSize />
          <TileLayer
            key={tileSource.url}
            attribution={tileSource.attribution}
            url={tileSource.url}
            eventHandlers={{
              tileerror: () => {
                if (tileIndex < TILE_SOURCES.length - 1) {
                  setLastTileSourceFailed(false)
                  setTileIndex((idx) => Math.min(idx + 1, TILE_SOURCES.length - 1))
                } else {
                  setLastTileSourceFailed(true)
                }
              },
              tileload: () => {
                if (tileIndex >= TILE_SOURCES.length - 1) {
                  setLastTileSourceFailed(false)
                }
              },
            }}
          />
          {!readOnly && <ClickHandler onChange={onChange} />}
          {hasPin && (
            <>
              <Marker position={[lat!, lng!]} />
              <RecenterMap lat={lat!} lng={lng!} />
            </>
          )}
        </MapContainer>

        {tilesUnavailable && (
          <div className="absolute inset-x-3 bottom-3 rounded-md bg-white/90 border border-[#e9ecef] px-2 py-1 text-[11px] text-[#6c757d]">
            No se pudieron cargar los mosaicos del mapa. Aun asi puedes marcar la ubicacion con clic.
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-[#6c757d] flex-1 min-w-0">
            {hasPin
              ? `Pin: ${lat!.toFixed(5)}, ${lng!.toFixed(5)} - Haz clic para mover`
              : 'Haz clic en el mapa para marcar la ubicacion del negocio'}
          </p>
          {hasPin && (
            <button
              type="button"
              onClick={() => onChange(0, 0)}
              className="text-[11px] text-[#adb5bd] underline hover:text-[#6c757d] shrink-0"
            >
              Quitar pin
            </button>
          )}
        </div>
      )}

      {readOnly && hasPin && (
        <p className="text-[11px] text-[#6c757d]">
          Coordenadas: {lat!.toFixed(6)}, {lng!.toFixed(6)}
        </p>
      )}
    </div>
  )
}
