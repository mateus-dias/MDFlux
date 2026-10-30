import type { Row, Org } from "./model";
import { modules, labels } from "./model";
import { money, csvCell } from "./domain.mjs";
export function download(content: BlobPart, name: string, type: string) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function exportCSV(rows: Row[], name = "relatorio") {
  const lines = [
    ["Tipo", "Nome", "Status", "Valor", "Baixado", "Vencimento"],
    ...rows.map((r) => [
      modules[r.kind].single,
      r.name,
      labels[r.status] || r.status,
      r.amount,
      r.paid,
      r.due_date || "",
    ]),
  ];
  download(
    "\ufeff" + lines.map((a) => a.map(csvCell).join(";")).join("\r\n"),
    name + ".csv",
    "text/csv;charset=utf-8",
  );
}
export async function exportXLSX(rows: Row[]) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("MD Flux");
  ws.columns = [
    { header: "Tipo", key: "kind", width: 22 },
    { header: "Descrição", key: "name", width: 45 },
    { header: "Status", key: "status", width: 18 },
    { header: "Valor", key: "amount", width: 18 },
    { header: "Baixado", key: "paid", width: 18 },
    { header: "Vencimento", key: "due", width: 18 },
  ];
  rows.forEach((r) =>
    ws.addRow({
      kind: modules[r.kind].single,
      name: r.name,
      status: labels[r.status] || r.status,
      amount: Number(r.amount),
      paid: Number(r.paid),
      due: r.due_date || "",
    }),
  );
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1762E8" },
  };
  ws.getColumn("amount").numFmt = '"R$" #,##0.00';
  ws.getColumn("paid").numFmt = '"R$" #,##0.00';
  const buffer = await wb.xlsx.writeBuffer();
  download(
    buffer,
    "MDFlux-relatorio.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
export async function pdf(rows: Row[], org: Org, documentMode = false) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.setFillColor(23, 98, 232);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255);
  doc.setFontSize(22);
  doc.text("MD Flux", 14, 17);
  doc.setFontSize(10);
  doc.text(org.name.slice(0, 70), 14, 25);
  doc.setTextColor(25, 40, 65);
  let y = 45;
  if (documentMode) {
    const r = rows[0];
    doc.setFontSize(17);
    doc.text(doc.splitTextToSize(r.name, 180), 14, y);
    y += 16;
    doc.setFontSize(10);
    doc.text(
      `${modules[r.kind].single} · ${labels[r.status] || r.status} · Nº ${r.id.slice(0, 8)}`,
      14,
      y,
    );
    y += 10;
    const items = r.data.items || [];
    if (items.length) {
      autoTable(doc, {
        startY: y,
        head: [["Descrição", "Qtd.", "Unitário", "Total"]],
        body: items.map((i: any) => [
          i.name,
          i.qty,
          money(i.price),
          money(i.qty * i.price),
        ]),
        headStyles: { fillColor: [23, 98, 232] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
    doc.text("Total: " + money(r.amount), 14, y);
    y += 10;
    for (const text of [
      r.data.scope,
      r.data.terms,
      r.data.notes,
      r.data.checklist,
    ])
      if (text) {
        for (const line of doc.splitTextToSize(String(text), 180)) {
          if (y > 275) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 14, y);
          y += 5;
        }
        y += 8;
      }
  } else
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Descrição", "Status", "Valor", "Baixado"]],
      body: rows.map((r) => [
        modules[r.kind].single,
        r.name,
        labels[r.status] || r.status,
        money(r.amount),
        money(r.paid),
      ]),
      headStyles: { fillColor: [23, 98, 232] },
    });
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `MD Flux · Gerado em ${new Date().toLocaleString("pt-BR")} · Página ${i}`,
      14,
      290,
    );
  }
  doc.save("MDFlux-" + (documentMode ? rows[0].kind : "relatorio") + ".pdf");
}
