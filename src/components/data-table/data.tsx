"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TableItem {
  no: number;
  date: string;
  jenisBiaya: string;
  keterangan: string;
  jumlah: number;
  klaimOleh: string;
  status: string;
}

// Data contoh
const tableData: TableItem[] = [
  {
    no: 1,
    date: "2023-10-01",
    jenisBiaya: "Transportasi",
    keterangan: "Taksi ke bandara",
    jumlah: 150000,
    klaimOleh: "Lambang",
    status: "Approved",
  },
  {
    no: 2,
    date: "2023-10-02",
    jenisBiaya: "Akomodasi",
    keterangan: "Biaya Hotel",
    jumlah: 750000,
    klaimOleh: "Lambang",
    status: "Pending",
  },
  {
    no: 3,
    date: "2023-10-03",
    jenisBiaya: "Makan",
    keterangan: "Lunch Meeting",
    jumlah: 200000,
    klaimOleh: "Lambang",
    status: "Pending",
  },
  {
    no: 4,
    date: "2023-10-04",
    jenisBiaya: "Transportasi",
    keterangan: "Taksi ke kantor klien",
    jumlah: 100000,
    klaimOleh: "Lambang",
    status: "Approved",
  },
  {
    no: 5,
    date: "2023-10-05",
    jenisBiaya: "Akomodasi",
    keterangan: "Biaya Hotel",
    jumlah: 750000,
    klaimOleh: "Lambang",
    status: "Pending",
  },
  {
    no: 6,
    date: "2023-10-06",
    jenisBiaya: "Transportasi",
    keterangan: "Taksi dari bandara",
    jumlah: 180000,
    klaimOleh: "Lambang",
    status: "Approved",
  },
  {
    no: 7,
    date: "2023-10-07",
    jenisBiaya: "Makan",
    keterangan: "Dinner Meeting",
    jumlah: 250000,
    klaimOleh: "Lambang",
    status: "Pending",
  },
];

export function MyDataTable() {
  // State untuk mengatur halaman saat ini
  const [currentPage, setCurrentPage] = useState(1);

  // Batas tampilan data per halaman
  const itemsPerPage = 3;

  // State untuk mengatur transisi animasi
  const [transitioning, setTransitioning] = useState(false);

  // Total data dan total halaman
  const totalItems = tableData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Hitung data yang tampil pada halaman saat ini
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const visibleData = tableData.slice(startIndex, endIndex);

  // Fungsi untuk berpindah halaman dengan animasi fade+scale
  const goToPage = (page: number) => {
    setTransitioning(true);
    setTimeout(() => {
      setCurrentPage(page);
      setTransitioning(false);
    }, 500); // Durasi animasi 500ms (bisa disesuaikan)
  };

  // Tombol Next
  const handleNext = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  // Tombol Prev
  const handlePrev = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  return (
    <Card className="max-w-4xl w-full text-xs">
      <CardHeader>
        <CardTitle>Data Pengeluaran</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Wrapper tabel dengan animasi fade+scale */}
        <div
          className={`
            overflow-auto 
            transition-all 
            duration-500 
            ease-in-out 
            ${transitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}
          `}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">NO</TableHead>
                <TableHead className="px-4 whitespace-nowrap">DATE</TableHead>
                <TableHead>JENIS BIAYA</TableHead>
                <TableHead>KETERANGAN</TableHead>
                <TableHead>JUMLAH</TableHead>
                <TableHead>KLAIM OLEH</TableHead>
                <TableHead>STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleData.map((item) => (
                <TableRow key={item.no}>
                  <TableCell>{item.no}</TableCell>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>{item.jenisBiaya}</TableCell>
                  <TableCell>{item.keterangan}</TableCell>
                  <TableCell>{item.jumlah.toLocaleString("id-ID")}</TableCell>
                  <TableCell>{item.klaimOleh}</TableCell>
                  <TableCell>{item.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Navigasi Prev/Next */}
        <div className="flex items-center justify-end space-x-4 mt-4">
          <button
            onClick={handlePrev}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
