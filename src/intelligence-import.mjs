import { parseAmount, parseDue, normalize } from "./intelligence.mjs";

export async function readFinancialFile(file) {
  if (file.size > 2 * 1024 * 1024)
    throw new Error("Escolha uma planilha de até 2 MB.");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  if (/\.xlsx$/i.test(file.name)) {
    await workbook.xlsx.load(await file.arrayBuffer());
  } else if (/\.csv$/i.test(file.name)) {
    // ExcelJS's stream-based CSV reader depends on Node. Parse quoted CSV in the browser.
    const source = (await file.text()).replace(/^\uFEFF/, "");
    const separator = source.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
    const sheet = workbook.addWorksheet("CSV");
    for (const row of parseCsv(source, separator)) sheet.addRow(row);
  } else throw new Error("Use XLSX ou CSV.");

  const rows = [];
  const issues = [];
  const seen = new Set();
  let scanned = 0;
  for (const sheet of workbook.worksheets) {
    const headers = new Map();
    sheet
      .getRow(1)
      .eachCell((cell, column) =>
        headers.set(normalize(cell.text.trim()), column),
      );
    const columns = ["tipo", "descricao", "valor", "vencimento"].map((key) =>
      headers.get(key),
    );
    if (columns.some((column) => !column)) {
      issues.push(
        sheet.name + ": use as colunas tipo, descrição, valor e vencimento.",
      );
      continue;
    }
    if (sheet.rowCount > 301)
      throw new Error("Use no máximo 300 linhas por arquivo.");
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      if (++scanned > 300)
        throw new Error("Use no máximo 300 linhas por arquivo.");
      try {
        const cells = columns.map((column) => row.getCell(column).value);
        if (
          cells.some(
            (cell) =>
              cell !== null &&
              typeof cell === "object" &&
              !(cell instanceof Date),
          )
        )
          throw new Error(
            "Use valores simples e remova fórmulas e hiperlinks.",
          );
        const [type, label, amount, due] = cells;
        const kind = { receita: "income", despesa: "expense" }[
          normalize(String(type).trim())
        ];
        const name = String(label ?? "").trim();
        if (!kind || !name || name.length > 200)
          throw new Error("Informe tipo (receita ou despesa) e descrição.");
        const value =
          typeof amount === "number"
            ? parseAmount(String(amount).replace(".", ","))
            : parseAmount(amount);
        const date = parseDue(
          due instanceof Date ? due.toISOString().slice(0, 10) : due,
        );
        const key = JSON.stringify([kind, normalize(name), value, date]);
        if (seen.has(key)) throw new Error("Linha repetida no arquivo.");
        seen.add(key);
        rows.push({ kind, name, amount: value / 100, due_date: date });
      } catch (error) {
        issues.push(sheet.name + " · linha " + index + ": " + error.message);
      }
    });
  }
  return { rows, issues };
}

function parseCsv(source, separator) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted && char === '"' && source[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"' && (quoted || !cell)) quoted = !quoted;
    else if (!quoted && char === separator) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      rows.push([...row, cell]);
      row = [];
      cell = "";
      if (rows.length > 301)
        throw new Error("Use no máximo 300 linhas por arquivo.");
    } else cell += char;
  }
  if (quoted) throw new Error("O CSV tem aspas sem fechamento.");
  if (row.length || cell) rows.push([...row, cell]);
  return rows;
}
