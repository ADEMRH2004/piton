"use client";

import { useRef } from "react";
import { MapContainer, TileLayer, FeatureGroup, GeoJSON } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

// Fix Leaflet default marker icons for Next.js
type DefaultIconPrototype = { _getIconUrl?: () => void };
delete (L.Icon.Default.prototype as DefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapViewProps {
  onPolygonDrawn: (geoJson: GeoJSON.Feature<GeoJSON.Polygon>) => void;
  resultsGeoJson: GeoJSON.FeatureCollection | null;
  isProcessing: boolean;
  jobId: string | null;
}

export default function MapView({
  onPolygonDrawn,
  resultsGeoJson,
  isProcessing,
  jobId,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);

  const onCreated = (e: L.DrawEvents.Created) => {
    const layer = e.layer;
    if (layer instanceof L.Polygon) {
      const geoJson = layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>;
      onPolygonDrawn(geoJson);
    }
  };

  const styleFeatures = (feature?: GeoJSON.Feature) => {
    const system = feature?.properties?.system;
    let color = "#3388ff"; // default blue
    if (system === "extensive") color = "#22c55e"; // green
    if (system === "intensive") color = "#eab308"; // yellow
    if (system === "hyper-intensive") color = "#ef4444"; // red

    return {
      fillColor: color,
      weight: 2,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: 0.7,
    };
  };

  return (
    <div className="h-[600px] w-full relative border rounded-lg overflow-hidden shadow-sm">
      {isProcessing && (
        <div className="absolute inset-0 bg-white/70 z-[1000] flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="font-semibold text-blue-800">
              Processing satellite imagery...
            </p>
            {jobId && (
              <p className="text-xs text-gray-500 font-mono">Job ID: {jobId}</p>
            )}
            <p className="text-sm text-gray-600 max-w-xs">
              Waiting for external data injection via mock endpoint.
            </p>
          </div>
        </div>
      )}
      <MapContainer
        center={[34.74056, 10.76028]}
        zoom={12}
        className="h-full w-full"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <FeatureGroup>
          <EditControl
            position="topright"
            onCreated={onCreated}
            draw={{
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
              polygon: {
                allowIntersection: false,
                shapeOptions: { color: "#3b82f6" },
              },
            }}
          />
        </FeatureGroup>
        {resultsGeoJson && (
          <GeoJSON data={resultsGeoJson} style={styleFeatures} />
        )}
      </MapContainer>
    </div>
  );
}
