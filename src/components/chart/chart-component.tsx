"use client";

import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
} from "chart.js";

// Komponen Card dari Shadcn UI
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Registrasi komponen Chart.js yang diperlukan
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ChartDataItem {
  month: string;
  desktop: number;
  mobile: number;
}

// Data contoh
const chartData: ChartDataItem[] = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
];

// Konfigurasi label dan warna
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "#2563eb",
  },
  mobile: {
    label: "Mobile",
    color: "#60a5fa",
  },
};

// Transformasi data untuk react-chartjs-2
const labels = chartData.map((item) => item.month.slice(0, 3)); // "Jan", "Feb", ...
const data = {
  labels,
  datasets: [
    {
      label: chartConfig.desktop.label,
      data: chartData.map((item) => item.desktop),
      backgroundColor: chartConfig.desktop.color,
      borderRadius: 4,
    },
    {
      label: chartConfig.mobile.label,
      data: chartData.map((item) => item.mobile),
      backgroundColor: chartConfig.mobile.color,
      borderRadius: 4,
    },
  ],
};

// Tipe untuk tooltip item Bar chart
type BarTooltipItem = TooltipItem<"bar">;

// Opsi grafik
const options = {
  responsive: true,
  maintainAspectRatio: false, // Supaya kita bisa mengatur tinggi container
  plugins: {
    legend: {
      position: "top" as const,
    },
    title: {
      display: true,
      text: "Grafik Data",
    },
    tooltip: {
      callbacks: {
        label: (tooltipItem: BarTooltipItem): string => {
          const label = tooltipItem.dataset.label || "";
          return `${label}: ${tooltipItem.parsed.y}`;
        },
      },
    },
  },
};

function ChartComponent() {
  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Grafik Data</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Container grafik responsif */}
        <div className="relative w-full h-72 md:h-80">
          <Bar data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}

export { ChartComponent as Component };
