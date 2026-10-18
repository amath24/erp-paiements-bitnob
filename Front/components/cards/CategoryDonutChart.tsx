"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { MOCK_CARD_STATS } from "@/lib/mock-data";

export function CategoryDonutChart() {
  const data = MOCK_CARD_STATS.categoryBreakdown;

  return (
    <div className="bg-white p-6 rounded-2xl border border-[#EAECEF] shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">
          Dépenses par catégorie
        </h3>
        <span className="text-xs text-gray-400 font-medium">Ce mois</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-2">
        {/* Donut Chart with Center Text */}
        <div className="relative w-44 h-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-[#0f172a] border border-[#1e293b] text-white px-3 py-1.5 rounded-xl text-xs shadow-lg">
                        <span className="font-semibold">{item.name}</span>:{" "}
                        <span className="text-[#F5C200] font-bold">
                          {item.pct}% (${item.amount})
                        </span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={data}
                dataKey="pct"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={74}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-base font-extrabold text-gray-900 font-sans">
              ${MOCK_CARD_STATS.totalSpent.toFixed(2)}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              ce mois
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full space-y-2 text-xs">
          {data.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between py-1 border-b border-gray-50 last:border-none"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-600 font-medium">{item.name}</span>
              </div>
              <span className="font-bold text-gray-900">{item.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-gray-400 pt-3 border-t border-gray-100 text-center">
        Catégorisation automatique des marchands
      </div>
    </div>
  );
}
