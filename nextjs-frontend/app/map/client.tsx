"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface Location {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
}

export default function MapClient({ locations }: { locations: Location[] }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const [L, setL] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Dynamically import leaflet only on client side
    import('leaflet').then((leaflet: any) => {
      setL(leaflet.default);
    });
  }, []);

  const markerIcon = useMemo(() => {
    if (!L) return null;
    return L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      iconSize: [25, 41],
      shadowSize: [41, 41],
    });
  }, [L]);

  useEffect(() => {
    if (!L || !mapContainer.current || !isClient) {
      return;
    }

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapContainer.current, {
        center: [locations[0]?.latitude ?? 0, locations[0]?.longitude ?? 0],
        zoom: locations.length ? 4 : 2,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      }).addTo(mapInstance.current);
    }

    const markers: any[] = [];
    const bounds: any[] = [];

    locations.forEach((location) => {
      const marker = L.marker([location.latitude, location.longitude], {
        icon: markerIcon,
      }).addTo(mapInstance.current);

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
      markers.forEach((marker: any) => marker.remove());
    };
  }, [locations, markerIcon, L, isClient]);

  if (!isClient) {
    return (
      <div className="h-[60vh] min-h-[420px] w-full rounded-3xl border border-gray-200 bg-slate-50 flex items-center justify-center">
        <p>Loading map...</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className="h-[60vh] min-h-[420px] w-full rounded-3xl border border-gray-200 bg-slate-50"
    />
  );
}
