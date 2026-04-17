import React, { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, LayersControl, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom divIcon factory — avoids the broken default-icon paths under vite/webpack
// and gives us tighter control over styling per marker kind (site / comp / employer).
function makeIcon(color, letter, size = 22) {
  const html = `
    <div style="
      background:${color};
      color:#fff;
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      border:2px solid #0b1020;
      box-shadow:0 1px 3px rgba(0,0,0,0.55);
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:11px;font-family:system-ui,sans-serif;
    ">${letter}</div>`
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2],
  })
}

const ICONS = {
  site:     makeIcon('#f97316', 'S', 26),  // orange — Subject site (larger)
  comp:     makeIcon('#3b82f6', 'C', 20),  // blue — rent Comp
  employer: makeIcon('#8b5cf6', 'E', 20),  // purple — Employer
  amenity:  makeIcon('#10b981', 'A', 18),  // emerald — Amenity
  hot:      makeIcon('#22c55e', 'H', 18),  // green — Hot neighbor
  cold:     makeIcon('#ef4444', 'L', 18),  // red — Low / cold neighbor
}

// Renders a satellite-first map with the subject site centered, plus any
// supplied comps / employers / amenities. Returns null if no center is available.
//
// Props:
//   site:     { lat, lng, label }                      — required (shown in orange)
//   comps:    [{ lat, lng, label, rent?, sf? }]        — optional (blue)
//   employers:[{ lat, lng, label, employees? }]        — optional (purple)
//   amenities:[{ lat, lng, label, kind? }]             — optional (green)
//   hotSpots: [{ lat, lng, label }]                    — hot-by-level nearby
//   coldSpots:[{ lat, lng, label }]                    — cold-by-level nearby
//   height:   px (default 380)
//
// Tile providers (Esri World Imagery for satellite + OSM streets overlay) are
// free and do not require an API key. Attribution is included as required.
export default function SiteMap({ site, comps = [], employers = [], amenities = [], hotSpots = [], coldSpots = [], height = 380 }) {
  const hasSite = site && typeof site.lat === 'number' && typeof site.lng === 'number'
  if (!hasSite) return null

  const markers = useMemo(() => ([
    { lat: site.lat, lng: site.lng, label: site.label || 'Subject site', kind: 'site' },
    ...comps.filter(c => c && typeof c.lat === 'number' && typeof c.lng === 'number')
            .map(c => ({ ...c, kind: 'comp' })),
    ...employers.filter(c => c && typeof c.lat === 'number' && typeof c.lng === 'number')
                .map(c => ({ ...c, kind: 'employer' })),
    ...amenities.filter(c => c && typeof c.lat === 'number' && typeof c.lng === 'number')
                .map(c => ({ ...c, kind: 'amenity' })),
    ...hotSpots.filter(c => c && typeof c.lat === 'number' && typeof c.lng === 'number')
               .map(c => ({ ...c, kind: 'hot' })),
    ...coldSpots.filter(c => c && typeof c.lat === 'number' && typeof c.lng === 'number')
                .map(c => ({ ...c, kind: 'cold' })),
  ]), [site, comps, employers, amenities, hotSpots, coldSpots])

  // Zoom: 14 ≈ neighborhood scale (roughly 2-mile view)
  const zoom = 14

  return (
    <div className="rounded-lg overflow-hidden border border-cw-border relative" style={{ height }}>
      <MapContainer
        center={[site.lat, site.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay name="Labels (over satellite)">
            <TileLayer
              attribution='Labels &copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              opacity={0.9}
            />
          </LayersControl.Overlay>
        </LayersControl>
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={ICONS[m.kind] || ICONS.amenity}>
            <Popup>
              <div className="text-xs">
                <div className="font-semibold">{m.label || m.kind}</div>
                {m.kind === 'comp' && (m.rent || m.sf) && (
                  <div className="text-gray-600 mt-0.5">
                    {m.rent && <>Rent ${m.rent}{m.sf ? ` · ${m.sf} SF` : ''}</>}
                    {m.rent && m.sf && <> · ${(m.rent / m.sf).toFixed(2)}/SF</>}
                  </div>
                )}
                {m.kind === 'employer' && m.employees && (
                  <div className="text-gray-600 mt-0.5">{m.employees.toLocaleString()} employees</div>
                )}
                {m.note && <div className="text-gray-600 mt-0.5">{m.note}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-cw-dark/90 border border-cw-border rounded px-2 py-1.5 text-[10px] text-gray-300 flex flex-wrap gap-x-3 gap-y-1 z-[500]">
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-orange-500 border border-black/40" /> Site</div>
        {comps.length > 0 && <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-500 border border-black/40" /> Comps</div>}
        {employers.length > 0 && <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-violet-500 border border-black/40" /> Employers</div>}
        {amenities.length > 0 && <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500 border border-black/40" /> Amenities</div>}
        {hotSpots.length > 0 && <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-green-500 border border-black/40" /> Hot</div>}
        {coldSpots.length > 0 && <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500 border border-black/40" /> Cold</div>}
      </div>
    </div>
  )
}
