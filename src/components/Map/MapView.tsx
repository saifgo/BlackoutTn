import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { User } from 'firebase/auth';
import type {
  Report,
  ZoneAggregate,
  ZoneFeatureCollection,
  ZoneProperties,
} from '../../types';
import { ZoneLayer } from './ZoneLayer';
import { ZonePopup } from './ZonePopup';
type LatLng = { lat: number; lng: number };

const TUNISIA_BOUNDS: LatLngBoundsExpression = [
  [30.2, 7.5],
  [37.6, 11.6],
];

interface MapViewProps {
  zones: ZoneFeatureCollection;
  aggregates: Map<string, ZoneAggregate>;
  user: User | null;
  reports: Report[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string | null) => void;
  userLocation: { lat: number; lng: number } | null;
}

function PopupBridge({
  zones,
  aggregates,
  selectedZoneId,
  user,
  reports,
  onClose,
}: {
  zones: ZoneFeatureCollection;
  aggregates: Map<string, ZoneAggregate>;
  selectedZoneId: string | null;
  user: User | null;
  reports: Report[];
  onClose: () => void;
}) {
  const feature = useMemo(
    () => zones.features.find((f) => f.properties.id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );

  if (!feature) return null;

  // Rendered as a screen-fixed floating panel (not anchored to the map marker)
  // so it can size itself to the viewport instead of being clipped by the map.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={feature.properties.name}
      className="fixed inset-0 z-[1100] flex items-end justify-center p-3 sm:items-center sm:p-6"
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="card pointer-events-auto relative z-10 max-h-[85vh] w-full max-w-sm overflow-y-auto p-4 sm:p-5">
        <ZonePopup
          zone={feature.properties as ZoneProperties}
          aggregate={aggregates.get(feature.properties.id)}
          user={user}
          reports={reports}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

export function MapView({
  zones,
  aggregates,
  user,
  reports,
  selectedZoneId,
  onSelectZone,
  userLocation,
}: MapViewProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <>
      <MapContainer
        bounds={TUNISIA_BOUNDS}
        maxBounds={[
          [28.5, 5.5],
          [38.5, 13.5],
        ]}
        minZoom={5}
        maxZoom={13}
        zoomControl
        className="h-full w-full"
        preferCanvas
        attributionControl
        whenReady={() => setReady(true)}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          crossOrigin
        />
        {ready && (
          <ZoneLayer
            data={zones}
            aggregates={aggregates}
            user={user}
            reports={reports}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
          />
        )}
        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: '#2563eb',
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
              موقعك
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
      <PopupBridge
        zones={zones}
        aggregates={aggregates}
        selectedZoneId={selectedZoneId}
        user={user}
        reports={reports}
        onClose={() => onSelectZone(null)}
      />
    </>
  );
}
