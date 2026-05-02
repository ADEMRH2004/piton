"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Location {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
}

const createMarkerIcon = () =>
  L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    iconSize: [25, 41],
    shadowSize: [41, 41],
  });

export default function MapClient({ locations }: { locations: Location[] }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerIcon = useMemo(() => createMarkerIcon(), []);

  useEffect(() => {
    if (!mapContainer.current) {
      return;
    }

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapContainer.current, {
        center: [locations[0]?.latitude ?? 0, locations[0]?.longitude ?? 0],
        zoom: locations.length ? 4 : 2,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      }).addTo(mapInstance.current);
    }

    const markers: L.Marker[] = [];
    const bounds: L.LatLngExpression[] = [];

    locations.forEach((location) => {
      const marker = L.marker([location.latitude, location.longitude], {
        icon: markerIcon,
      }).addTo(mapInstance.current!);

      marker.bindPopup(`
        <strong>${location.name}</strong><br />
        ${location.description ?? ""}
      `);
      markers.push(marker);
      bounds.push([location.latitude, location.longitude]);
    });

    if (bounds.length && mapInstance.current) {
      mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
    }

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [locations, markerIcon]);

  return (
    <div
      ref={mapContainer}
      className="h-[60vh] min-h-[420px] w-full rounded-3xl border border-gray-200 bg-slate-50"
    />
  );
}
