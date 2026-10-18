"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MOCK_CHART_DATA } from "@/lib/mock-data";
import { ChevronDown } from "lucide-react";

export function ChartCard() {
  const [range, setRange] = useState("7_mois");

  return (
    <div className="bg-white p-6 rounded-2xl border border-[#EAECEF] shadow-sm flex flex-col justify-between">
      {/* Header with Title and Range Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base font-bold text-gray-900">
            Évolution des paiements
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Flux de trésorerie entrants et sortants
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="relative">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="appearance-none bg-[#F5F6F9] hover:bg-[#EEF0F4] border border-gray-200 text-xs font-medium text-gray-700 py-1.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:border-[#F5C200]"
            >
              <option value="7_mois">7 derniers mois</option>
              <option value="30_jours">30 derniers jours</option>
              <option value="annee">Année 2026</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={MOCK_CHART_DATA}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            barGap={6}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#F1F3F7"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9CA3AF", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9CA3AF", fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              cursor={{ fill: "#F9FAFB" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#0f172a] text-white p-2.5 rounded-xl text-xs shadow-xl border border-[#1e293b]">
                      <p className="font-semibold text-gray-300 mb-1">
                        {payload[0].payload.month} 2026
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-gray-300">
                            <span className="w-2 h-2 rounded-full bg-[#F5C200]" />
                            Reçus:
                          </span>
                          <span className="font-bold text-[#F5C200]">
                            ${payload[0].value}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-gray-300">
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            Envoyés:
                          </span>
                          <span className="font-bold text-gray-300">
                            ${payload[1]?.value}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="reçus"
              name="Reçus"
              fill="#F5C200"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="envoyés"
              name="Envoyés"
              fill="#E5E7EB"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#F5C200]" />
          <span className="text-gray-600 font-medium">Reçus</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#E5E7EB]" />
          <span className="text-gray-600 font-medium">Envoyés</span>
        </div>
      </div>
    </div>
  );
}
