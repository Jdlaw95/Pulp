"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="no-print rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
      Print
    </button>
  );
}
