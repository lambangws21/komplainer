"use client"

import React from "react"
import Card from "@/components/dashboard/cardui"
import CalendarGoogle from "@/components/calendar/calendar"
import {Component as MyChart} from "@/components/chart/chart-component"
import { MyDataTable } from "@/components/data-table/data"

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 mt-12 -z-0">
      {/* Header */}


      {/* Baris 1: Next Game & Games Statistic */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card animated delay="0.2s" className="p-4">
          <CalendarGoogle/>
        </Card>

        <Card animated delay="0.2s" className="p-4">
         <MyChart/>
        </Card>
      </div>

      {/* Baris 2: Standings & beberapa info kecil (possession, price, dsb.) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card animated delay="0.6s" className="p-4">
  
       <MyDataTable/>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          <Card animated delay="0.8s" className="p-4 flex flex-col items-center">
            <p className="text-sm text-gray-500">Possession</p>
            <p className="text-xl font-semibold">65%</p>
          </Card>
          <Card  animated delay="0.8s" className="p-4 flex flex-col items-center">
            <p className="text-sm text-gray-500">Overall Price</p>
            <p className="text-xl font-semibold">$690.2m</p>
          </Card>
          <Card animated delay="0.9s" className="p-4 flex flex-col items-center">
            <p className="text-sm text-gray-500">Transfer Budget</p>
            <p className="text-xl font-semibold">$240.6m</p>
          </Card>
          <Card animated delay="0.9s" className="p-4 flex flex-col items-center">
            <p className="text-sm text-gray-500">Average Score</p>
            <p className="text-xl font-semibold">7.2</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
