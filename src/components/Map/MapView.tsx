import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Popup, CircleMarker, Tooltip } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import L from 'leaflet';
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
import { featureBounds } from '../../lib/geo';

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
  userLocation,
  onClose,
}: {
  zones: ZoneFeatureCollection;
  aggregates: Map<string, ZoneAggregate>;
  selectedZoneId: string | null;
  user: User | null;
  reports: Report[];
  userLocation: LatLng | null;
  onClose: () => void;
}) {
  const feature = useMemo(
    () => zones.features.find((f) => f.properties.id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );

  if (!feature) return null;
  const bounds = featureBounds(feature);
  if (!bounds) return null;
  const center = L.latLngBounds(bounds as L.LatLngBoundsLiteral).getCenter();

  return (
    <Popup
      key={feature.properties.id}
      position={center}
      eventHandlers={{ remove: onClose }}
        closeButton
        autoPan
        autoPanPadding={[24, 80]}
        minWidth={240}
        maxWidth={360}
      >
      <ZonePopup
        zone={feature.properties as ZoneProperties}
        aggregate={aggregates.get(feature.properties.id)}
        user={user}
        reports={reports}
        userLocation={userLocation}
        zoneCenter={{ lat: center.lat, lng: center.lng }}
        onClose={onClose}
      />
    </Popup>
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
      <PopupBridge
        zones={zones}
        aggregates={aggregates}
        selectedZoneId={selectedZoneId}
        user={user}
        reports={reports}
        userLocation={userLocation}
        onClose={() => onSelectZone(null)}
      />
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
            Votre position
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
