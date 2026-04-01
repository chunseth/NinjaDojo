"use client";

import { useState } from "react";

type ReportFile = {
  fileName: string;
  base64: string;
};

export default function ReportsPage() {
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [monthYear, setMonthYear] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/reports/monthly/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kiosk-key": process.env.NEXT_PUBLIC_KIOSK_SHARED_KEY ?? ""
        }
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Generation failed");
      }
      setFiles(body.files ?? []);
      setMonthYear(body.monthYear ?? "");
      setMessage(`Generated ${body.files?.length ?? 0} reports.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function download(file: ReportFile) {
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${file.base64}`;
    link.download = file.fileName;
    link.click();
  }

  function downloadAll() {
    files.forEach((file, idx) => {
      setTimeout(() => download(file), idx * 250);
    });
  }

  return (
    <main className="container grid">
      <section className="panel">
        <h1 style={{ fontSize: "3rem" }}>Monthly Progress Reports</h1>
        <p>Generate previous month reports and download locally as PDFs.</p>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="button" onClick={generate} disabled={loading}>
            {loading ? "Generating..." : "Generate Previous Month"}
          </button>
          {files.length > 0 && (
            <button className="button secondary" onClick={downloadAll}>
              Download All
            </button>
          )}
        </div>
        {message && <p>{message}</p>}
      </section>

      {files.length > 0 && (
        <section className="panel grid">
          <h2 style={{ fontSize: "2rem" }}>Generated for {monthYear}</h2>
          {files.map((file) => (
            <div key={file.fileName} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>{file.fileName}</span>
              <button className="button ghost" onClick={() => download(file)}>
                Download
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
