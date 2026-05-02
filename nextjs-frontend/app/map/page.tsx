import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const MapClient = dynamic(() => import("./client"), { ssr: false });

interface Location {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
}

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export default async function MapPage() {
  const response = await fetch(`${API_BASE_URL}/locations`, {
    cache: "no-store",
  });
  const locations: Location[] = await response.json();

  return (
    <main className="min-h-screen bg-gray-50 p-8 dark:bg-gray-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-lg">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Fullstack Leaflet Starter
              </p>
              <h1 className="text-4xl font-semibold text-slate-900 dark:text-white">
                Interactive Map Example
              </h1>
            </div>
            <Link href="/">
              <Button variant="outline">Back to home</Button>
            </Link>
          </div>
          <p className="max-w-3xl text-slate-600 dark:text-slate-300">
            This page loads sample locations from the FastAPI backend and
            renders them with Leaflet. The backend stores coordinates in PostGIS
            and returns latitude/longitude for the frontend.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <MapClient locations={locations} />
        </div>
      </div>
    </main>
  );
}
