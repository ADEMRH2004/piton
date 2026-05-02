"use client";

interface StatsTableProps {
  stats: {
    total: number;
    total_surface_ha: number;
    breakdown: {
      extensive: number;
      intensive: number;
      "hyper-intensive": number;
    };
  } | null;
}

export default function StatsTable({ stats }: StatsTableProps) {
  if (!stats) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border mt-4">
      <h3 className="text-xl font-bold mb-4">Analysis Results</h3>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500 font-medium">Total Groves</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500 font-medium">Surface (ha)</p>
          <p className="text-2xl font-bold text-gray-800">
            {stats.total_surface_ha.toFixed(2)}
          </p>
        </div>
      </div>

      <h4 className="font-semibold mb-3 text-gray-700">
        Farming Systems Breakdown
      </h4>
      <div className="space-y-3">
        <div className="flex justify-between p-3 border rounded-lg border-l-4 border-l-[#22c55e]">
          <span className="font-medium text-gray-700">Extensive</span>
          <span>{stats.breakdown.extensive}</span>
        </div>
        <div className="flex justify-between p-3 border rounded-lg border-l-4 border-l-[#eab308]">
          <span className="font-medium text-gray-700">Intensive</span>
          <span>{stats.breakdown.intensive}</span>
        </div>
        <div className="flex justify-between p-3 border rounded-lg border-l-4 border-l-[#ef4444]">
          <span className="font-medium text-gray-700">Hyper-intensive</span>
          <span>{stats.breakdown["hyper-intensive"]}</span>
        </div>
      </div>
    </div>
  );
}
