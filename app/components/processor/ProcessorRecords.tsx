"use client";

import { useQuery } from "convex/react";
import * as XLSX from "xlsx";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formLabel } from "../../../convex/processorShared";
import { card, button, formatUgx } from "../exportMarkets/ui";
import { PROCESSOR_HEADING, PROCESSOR_SOFT, PROCESSOR_BORDER } from "./ProcessorWorkspace";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The processor's records in one place: what was bought, processed and sold,
 * with totals, the outturn and a spreadsheet to download.
 */
export function ProcessorRecordsTab({ userId }: { userId: Id<"users"> }) {
  const intakes = useQuery(api.processorOperations.listMyIntakes, { userId });
  const batches = useQuery(api.processorOperations.listMyBatches, { userId });
  const sales = useQuery(api.processorSales.listMySales, { userId });
  if (intakes === undefined || batches === undefined || sales === undefined) return <div style={card}>Loading your records...</div>;

  const liveSales = sales.sales.filter((s) => s.status !== "declined" && s.status !== "cancelled");
  const done = batches.filter((b) => b.status === "completed" && b.weightOutKg !== undefined);
  const inKg = round1(done.reduce((a, b) => a + b.weightInKg, 0));
  const outKg = round1(done.reduce((a, b) => a + (b.weightOutKg ?? 0), 0));
  const totals = [
    { label: "Bought from farmers", value: `${round1(intakes.reduce((a, i) => a + i.kilos, 0)).toLocaleString()} kg`, note: `${intakes.length} intake(s), ${intakes.filter((i) => i.sourceKind === "platform_farmer").length} traced` },
    { label: "Processed", value: `${outKg.toLocaleString()} kg out`, note: `${done.length} batch(es) · ${inKg.toLocaleString()} kg in${inKg > 0 ? ` · outturn ${round1((outKg / inKg) * 100)}%` : ""}` },
    {
      label: "Sold directly or off the app",
      value: `${round1(liveSales.reduce((a, s) => a + s.kilos, 0)).toLocaleString()} kg`,
      note: formatUgx(liveSales.reduce((a, s) => a + s.kilos * (s.pricePerKgUgx ?? 0), 0)),
    },
  ];

  const download = () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(
        intakes.map((i) => ({ Code: i.intakeCode, Date: i.intakeDate, Farmer: i.farmerLabel, Traced: i.sourceKind === "platform_farmer" ? "yes" : "no", Form: formLabel(i.inputForm), Kilos: i.kilos, "Price per kg (UGX)": i.pricePerKgUgx ?? "" }))
      ),
      "Intake"
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(
        batches.map((b) => ({ Code: b.batchCode, Started: b.startedDate, Completed: b.completedDate ?? "", Output: formLabel(b.outputForm), Grade: b.grade ?? "", "Kilos in": b.weightInKg, "Kilos out": b.weightOutKg ?? "", "Outturn %": b.outturnPercent ?? "", Status: b.status }))
      ),
      "Processing"
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(
        sales.sales.map((s) => ({ Code: s.saleCode, Date: s.saleDate, Batch: s.batchCode, Kilos: s.kilos, Buyer: s.exporterLabel ?? "", "Price per kg (UGX)": s.pricePerKgUgx ?? "", Status: s.status }))
      ),
      "Sales"
    );
    XLSX.writeFile(book, "farm2market-processor-records.xlsx");
  };

  const table = (title: string, head: string[], rows: (string | number)[][]) => (
    <div style={card}>
      <h3 style={{ marginTop: 0, color: PROCESSOR_HEADING, fontSize: "1rem" }}>{title}</h3>
      {rows.length === 0 ? (
        <div style={{ fontSize: "0.88rem", color: "#607d8b" }}>Nothing yet.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
            <thead>
              <tr>
                {head.map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "0.35rem", borderBottom: `2px solid ${PROCESSOR_BORDER}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} style={{ padding: "0.35rem", borderBottom: "1px solid #f1f1f1", whiteSpace: "nowrap" }}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && <div style={{ fontSize: "0.8rem", color: "#607d8b", marginTop: "0.3rem" }}>Showing the latest 20 of {rows.length}. The download has them all.</div>}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
          {totals.map((t) => (
            <div key={t.label} style={{ background: PROCESSOR_SOFT, border: `1px solid ${PROCESSOR_BORDER}`, borderRadius: 12, padding: "0.7rem" }}>
              <div style={{ fontSize: "0.8rem", color: PROCESSOR_HEADING }}>{t.label}</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>{t.value}</div>
              <div style={{ fontSize: "0.78rem", color: "#607d8b" }}>{t.note}</div>
            </div>
          ))}
        </div>
        <button style={{ ...button("secondary"), marginTop: "0.75rem" }} onClick={download}>
          ⬇️ Download all records (Excel)
        </button>
        <div style={{ fontSize: "0.8rem", color: "#607d8b", marginTop: "0.4rem" }}>Lots sold on MarketSpace are in Lots &amp; ledger.</div>
      </div>
      {table("Intake", ["Code", "Date", "Farmer", "Form", "Kg"], intakes.map((i) => [i.intakeCode, i.intakeDate, i.farmerLabel, formLabel(i.inputForm), i.kilos]))}
      {table("Processing", ["Code", "Output", "Kg in", "Kg out", "Outturn"], batches.map((b) => [b.batchCode, formLabel(b.outputForm), b.weightInKg, b.weightOutKg ?? "-", b.outturnPercent != null ? `${b.outturnPercent}%` : "-"]))}
      {table("Sales", ["Code", "Date", "Kg", "Buyer", "Status"], sales.sales.map((s) => [s.saleCode, s.saleDate, s.kilos, s.exporterLabel ?? "-", s.status]))}
    </>
  );
}
