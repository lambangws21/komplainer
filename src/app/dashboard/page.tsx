"use client";
import { Card } from "@/components/ui/card";
import React from "react";
import MyCalendar from "@/components/calendar/calendar";

const DashboardPage = () => {
  return (
    <div>
      <div className="bg-green-200/70 p-24 w-screen h-screen">
        <div className="p-4 w-[100] h-[85] bg-slate-200 mx-auto rounded-2xl ">
          <div className="p-6 space-y-6 mt-12 -z-0">
            {/* Baris 1: Next Game & Games Statistic */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MyCalendar/>
            </div>

            {/* Baris 2: Standings & beberapa info kecil (possession, price, dsb.) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             

              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <Card
                  className="p-4 flex flex-col items-center"
                >
                  <p className="text-sm text-gray-500">Possession</p>
                  <p className="text-xl font-semibold">65%</p>
                </Card>
                <Card
                 
                  className="p-4 flex flex-col items-center"
                >
                  <p className="text-sm text-gray-500">Overall Price</p>
                  <p className="text-xl font-semibold">$690.2m</p>
                </Card>
                <Card
                  className="p-4 flex flex-col items-center"
                >
                  <p className="text-sm text-gray-500">Transfer Budget</p>
                  <p className="text-xl font-semibold">$240.6m</p>
                </Card>
                <Card
               

                  className="p-4 flex flex-col items-center"
                >
                  <p className="text-sm text-gray-500">Average Score</p>
                  <p className="text-xl font-semibold">7.2</p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
