import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

export default function BusinessMap({ lat, lng, onChange, readOnly = false }: BusinessMapProps) {
  const hasPin = lat != null && lng != null && (lat !== 0 || lng !== 0)
  const center: [number, number] = hasPin ? [lat!, lng!] : [20.6597, -103.3496]

  const handleGeolocate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden border border-[#dee2e6]" style={{ height: 240 }}>
        <MapContainer
          center={center}
          zoom={hasPin ? 16 : 12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && <ClickHandler onChange={onChange} />}
          {hasPin && (
            <>
              <Marker position={[lat!, lng!]} />
              <RecenterMap lat={lat!} lng={lng!} />
            </>
          )}
        </MapContainer>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-[#6c757d] flex-1 min-w-0">
            {hasPin
              ? `Pin: ${lat!.toFixed(5)}, ${lng!.toFixed(5)} — Haz clic para mover`
              : 'Haz clic en el mapa para marcar la ubicación del negocio'}
          </p>
          {'geolocation' in navigator && (
            <button type="button" onClick={handleGeolocate} className="btn btn-sm text-xs shrink-0">
              Mi ubicación
            </button>
          )}
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
