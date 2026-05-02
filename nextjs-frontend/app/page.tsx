"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import StatsTable from "../components/StatsTable";

// Disable SSR for Leaflet map component to prevent window undefined errors
const MapView = dynamic(() => import("../components/MapView"), { ssr: false });

type StatsData = {
  total: number;
  total_surface_ha: number;
  breakdown: {
    extensive: number;
    intensive: number;
    "hyper-intensive": number;
  };
};

type AnalysisResults = {
  geojson: GeoJSON.FeatureCollection;
  stats: StatsData;
  message?: string;
  received_polygon?: unknown;
} | null;

export default function HackTheHarvestPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<AnalysisResults>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePolygonDrawn = useCallback(
    async (polygonGeoJson: GeoJSON.Feature<GeoJSON.Polygon>) => {
      setIsProcessing(true);
      setError(null);
      setResults(null);

      try {
        const res = await fetch("http://localhost:8000/api/cartographier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ perimeter_polygon: polygonGeoJson }),
        });

        if (!res.ok) throw new Error("Failed to start analysis job");
        const data = await res.json();
        setJobId(data.job_id);
        pollJobStatus(data.job_id);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An error occurred while creating job";
        setError(message);
        setIsProcessing(false);
      }
    },
    [],
  );

  const pollJobStatus = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/job/${id}`);
        const data = await res.json();

        if (data.status === "done") {
          clearInterval(interval);
          setResults({
            geojson: data.olive_groves,
            stats: data.stats,
            message: data.message,
            received_polygon: data.received_polygon,
          });
          setIsProcessing(false);
        } else if (data.status === "error") {
          clearInterval(interval);
          setError("Job processing failed remotely");
          setIsProcessing(false);
        }
      } catch {
        clearInterval(interval);
        setError("Failed to poll job status");
        setIsProcessing(false);
      }
    }, 2000); // Poll every 2 seconds
  };

  const downloadGeoJson = async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/export/${jobId}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/geo+json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `olive_groves_${jobId.substring(0, 8)}.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download GeoJSON", err);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Hack The Harvest · Intelligent Mapping
          </h1>
          <p className="text-gray-600 mt-2">
            Draw a region on the map to detect and classify olive groves.
          </p>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Select the polygon tool (top right) to define your area.
              </p>
              {results && (
                <button
                  onClick={downloadGeoJson}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Download GeoJSON
                </button>
              )}
            </div>
            <MapView
              onPolygonDrawn={handlePolygonDrawn}
              isProcessing={isProcessing}
              resultsGeoJson={results?.geojson ?? null}
              jobId={jobId}
            />
          </div>
          <div className="lg:col-span-1">
            {results ? (
              <div className="space-y-4 mt-4">
                {results.message && (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg shadow-sm">
                    <p className="text-green-800 font-semibold mb-2">
                      Backend Output:
                    </p>
                    <p className="text-green-700 text-sm font-mono bg-white p-2 rounded border border-green-100">
                      {results.message}
                    </p>
                    <p className="text-xs text-green-600 mt-2 mb-1 font-semibold">
                      Raw Data Received:
                    </p>
                    <pre className="text-xs text-green-700 max-h-32 overflow-y-auto bg-white p-2 rounded border border-green-100">
                      {JSON.stringify(results.received_polygon, null, 2)}
                    </pre>
                  </div>
                )}
                <StatsTable stats={results.stats} />
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-sm border h-full flex flex-col items-center justify-center text-center text-gray-500">
                <p>Draw a polygon to begin analysis.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
