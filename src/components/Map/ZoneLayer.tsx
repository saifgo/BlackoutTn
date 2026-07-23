import { useEffect, useMemo, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import type { Feature } from 'geojson';
import type { Layer, PathOptions } from 'leaflet';
import type { GeoJSON as LeafletGeoJSON } from 'leaflet';
import type { User } from 'firebase/auth';
import type {
  Report,
  ZoneAggregate,
  ZoneFeatureCollection,
  ZoneProperties,
} from '../../types';
import { STATUS_COLORS } from '../../lib/status';

interface ZoneLayerProps {
  data: ZoneFeatureCollection;
  aggregates: Map<string, ZoneAggregate>;
  user: User | null;
  reports: Report[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string | null) => void;
}

function styleForZone(props: ZoneProperties, aggregates: Map<string, ZoneAggregate>): PathOptions {
  // Coloring is aggregated at the sector (imada) level, so each sector only
  // reflects the reports that target it, not its whole parent delegation.
  const agg = aggregates.get(props.id);
  const status = agg?.status ?? 'gray';
  return {
    fillColor: STATUS_COLORS[status],
    fillOpacity: status === 'gray' ? 0.15 : 0.55,
    color: '#0f172a',
    weight: 0.8,
    opacity: 0.9,
  };
}

export function ZoneLayer({
  data,
  aggregates,
  selectedZoneId,
  onSelectZone,
}: ZoneLayerProps) {
  const map = useMap();
  const layerRef = useRef<LeafletGeoJSON | null>(null);
  const aggregatesRef = useRef(aggregates);
  aggregatesRef.current = aggregates;

  const onEachFeature = useMemo(
    () =>
      (feature: Feature, layer: Layer) => {
        const props = feature.properties as ZoneProperties;
        layer.bindTooltip(`${props.name} — ${props.delegation}`, {
          sticky: true,
          direction: 'top',
          opacity: 0.9,
        });
        (layer as unknown as { _zoneId?: string })._zoneId = props.id;
        layer.on({
          click: () => onSelectZone(props.id),
          keydown: (e) => {
            const kev = (e as unknown as { originalEvent: KeyboardEvent }).originalEvent;
            if (kev.key === 'Enter' || kev.key === ' ') {
              kev.preventDefault();
              onSelectZone(props.id);
            }
          },
        });
      },
    [onSelectZone],
  );

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((sub) => {
      const zoneId = (sub as unknown as { _zoneId?: string })._zoneId;
      if (!zoneId) return;
      const feature = (sub as unknown as { feature?: Feature }).feature;
      if (!feature) return;
      const style = styleForZone(feature.properties as ZoneProperties, aggregatesRef.current);
      if (zoneId === selectedZoneId) {
        style.weight = 2.5;
        style.color = '#f8fafc';
      }
      (sub as unknown as { setStyle: (s: PathOptions) => void }).setStyle(style);
    });
  }, [aggregates, selectedZoneId]);

  useEffect(() => {
    if (!selectedZoneId) return;
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((sub) => {
      const zoneId = (sub as unknown as { _zoneId?: string })._zoneId;
      if (zoneId !== selectedZoneId) return;
      const withBounds = sub as unknown as { getBounds?: () => L.LatLngBounds };
      if (withBounds.getBounds) {
        const bounds = withBounds.getBounds();
        map.flyToBounds(bounds, { padding: [40, 40], duration: 0.5, maxZoom: 11 });
      }
    });
  }, [selectedZoneId, map]);

  return (
    <GeoJSON
      data={data}
      ref={(instance) => {
        layerRef.current = instance ?? null;
      }}
      style={(feature) =>
        feature
          ? styleForZone(feature.properties as ZoneProperties, aggregates)
          : { fillOpacity: 0 }
      }
      onEachFeature={onEachFeature}
    />
  );
}
