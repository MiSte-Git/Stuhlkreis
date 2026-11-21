const fileInput = document.getElementById("fileInput");
const downloadButton = document.getElementById("download");
const downloadPdfButton = document.getElementById("downloadPdf");
const pdfOrientationSelect = document.getElementById("pdfOrientation");
const newSheetButton = document.getElementById("newSheet");
const addRowButton = document.getElementById("addRow");
const addColLeftButton = document.getElementById("addColLeft");
const addColRightButton = document.getElementById("addColRight");
const downloadScopeSelect = document.getElementById("downloadScope");
const addPrintButton = document.getElementById("addPrint");
const removeRowButton = document.getElementById("removeRow");
const removeColButton = document.getElementById("removeCol");
const removeSheetButton = document.getElementById("removeSheet");
const toggleLockButton = document.getElementById("toggleLock");
const invoiceInput = document.getElementById("invoiceInput");
const invoiceSheetSelect = document.getElementById("invoiceSheet");
const refreshInvoicesButton = document.getElementById("refreshInvoices");
const invoiceSelect = document.getElementById("invoiceSelect");
const invoiceSearchInput = document.getElementById("invoiceSearch");
const viewInvoiceButton = document.getElementById("viewInvoice");
const downloadInvoiceButton = document.getElementById("downloadInvoice");
const deleteInvoiceButton = document.getElementById("deleteInvoice");
const invoicePreviewFrame = document.getElementById("invoicePreview");
const invoiceCountEl = document.getElementById("invoiceCount");
const invoicePreviewList = document.getElementById("invoicePreviewList");
const lastSavedEl = document.getElementById("lastSaved");
const grandTotalEl = document.getElementById("grandTotal");
const statusEl = document.getElementById("status");
const table = document.getElementById("sheetTable");
const thead = table.querySelector("thead");
const tbody = table.querySelector("tbody");
const tabsList = document.getElementById("sheetTabs");
const sheetSelect = document.getElementById("sheetSelect");
const showLockedCheckbox = document.getElementById("showLocked");
const SHOW_LOCKED_KEY = "stuhlkreis.showLocked";
const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;

function readShowLocked() {
  try {
    return window.localStorage.getItem(SHOW_LOCKED_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function writeShowLocked(value) {
  try {
    window.localStorage.setItem(SHOW_LOCKED_KEY, value ? "1" : "0");
  } catch (error) {
    // ignore storage errors
  }
}

let showLockedSheets = readShowLocked();

const NAME_LABEL = "Name";
const QTY_LABEL = "Anzahl";
const SIZE_LABEL = "Größe";
const PRICE_LABEL = "Preis (€)";
const TOTAL_LABEL = "Gesamtsumme";
const UNIT_PRICE_LABEL = "Stückpreis";
const FREE_SHIPPING_FROM = 100; // Versand bei dgtextildruck.de ab diesem Bestellwert frei
const PRINT_DEFAULT_LABEL = "Druck";
const DEFAULT_ARTICLES = ["T-Shirt", "Polo-Shirt", "Hoodes Zip"];
const DEFAULT_NAMES = [
  "1. Vorstand (Peter)",
  "2. Vorstand (Karl)",
  "1. Kassier (Timo)",
  "Auslandsbeauftragter (Michael)",
  "Cleaner (Ralf)",
  "Gedultet (Olli)",
  "Mediator (Simon)",
  "Schriftführer (Christian)",
  "Späher (Luns)",
  "Transporter (Klaus)",
  "Zentralglöckner (Sebi)",
];
const SUM_HEADER = "Summe";

let sheets = [];
let activeSheetIndex = 0;
let dragSourceIndex = null;
let dragRowSourceIndex = null;
let invoices = [];
let isSelectingCells = false;
let selectionStart = null;
let selectionEnd = null;
let hasDragSelection = false;
let hasUserSelectedInvoice = false;
let currentCell = null;
let headerJustFocused = null;

function sanitizeFilename(value) {
  return value
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "_");
}

function buildFilename(extension, list = sheets) {
  const title = document.querySelector(".brand")?.textContent ?? "Sheet";
  const sheetNames = list.map((sheet) => sheet.name).join("_");
  const baseName = sanitizeFilename(`${title}_${sheetNames}`) || "Sheet";
  const clipped = baseName.slice(0, 140);
  return `${clipped}.${extension}`;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setLastSaved(timestamp) {
  if (!timestamp) {
    lastSavedEl.textContent = "";
    return;
  }
  const savedAt = new Date(timestamp);
  if (Number.isNaN(savedAt.getTime())) {
    lastSavedEl.textContent = "";
    return;
  }
  lastSavedEl.textContent = `Letzte Speicherung: ${savedAt.toLocaleString()}`;
}

function isActiveSheetLocked() {
  return Boolean(sheets[activeSheetIndex]?.locked);
}

function setActionDisabled(button, disabled) {
  if (button) {
    button.disabled = disabled;
  }
}

function applySheetLockState() {
  const locked = isActiveSheetLocked();
  table.classList.toggle("is-locked", locked);

  thead.querySelectorAll(".header-text").forEach((header) => {
    header.contentEditable = locked ? "false" : "true";
  });

  table.querySelectorAll("td[data-kind]").forEach((cell) => {
    const editable = !locked && EDITABLE_KINDS.has(cell.dataset.kind);
    if (cell.dataset.kind === "name" || cell.dataset.kind === "printlabel") {
      const text = cell.querySelector(".cell-text");
      if (text) {
        text.contentEditable = editable ? "true" : "false";
      }
      return;
    }
    cell.contentEditable = editable ? "true" : "false";
  });

  table.querySelectorAll(".drag-indicator, .row-drag-indicator").forEach((indicator) => {
    indicator.draggable = !locked && !isCoarsePointer;
  });
  table.querySelectorAll(".col-resize-handle").forEach((handle) => {
    handle.style.pointerEvents = locked ? "none" : "auto";
  });

  setActionDisabled(addRowButton, locked);
  setActionDisabled(removeRowButton, locked);
  setActionDisabled(addColLeftButton, locked);
  setActionDisabled(addColRightButton, locked);
  setActionDisabled(removeColButton, locked);
  setActionDisabled(addPrintButton, locked);
  table.querySelectorAll(".print-remove").forEach((button) => {
    button.disabled = locked;
  });
  setActionDisabled(removeSheetButton, locked);

  tabsList.querySelectorAll(".tab-name").forEach((tabName) => {
    tabName.contentEditable = locked ? "false" : "true";
  });

  if (toggleLockButton) {
    toggleLockButton.textContent = locked ? "Bestellung wieder öffnen" : "Bestellung abschließen";
    toggleLockButton.setAttribute("aria-pressed", locked ? "true" : "false");
  }
}

function setActiveSheetLocked(locked) {
  if (!sheets[activeSheetIndex]) {
    return;
  }
  saveActiveSheet();
  sheets[activeSheetIndex].locked = locked;
  applySheetLockState();
  renderTabs();
  updateInvoiceSheetOptions();
  autosave();
  if (locked) {
    setStatus("Bestellung abgeschlossen. Schreibschutz aktiv.");
  } else {
    setStatus("Schreibschutz aufgehoben.");
  }
}

function ensureEditable() {
  if (isActiveSheetLocked()) {
    setStatus("Tabellenblatt ist abgeschlossen.");
    return false;
  }
  return true;
}

function buildPayload() {
  saveActiveSheet();
  return {
    title: document.querySelector(".brand")?.textContent?.trim() || "Sheet",
    sheets,
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  const cleaned = text.replace(/^\uFEFF/, "");
  try {
    return { ok: response.ok, data: JSON.parse(cleaned) };
  } catch (error) {
    const snippet = cleaned.trim().slice(0, 200);
    return {
      ok: false,
      data: {
        status: "error",
        message: `Invalid server response: ${snippet || "empty response"}`,
      },
    };
  }
}

function clearTable() {
  thead.innerHTML = "";
  tbody.innerHTML = "";
}

/* ---------- Datenformat ----------
 * Zeile 0: Name | Artikel 1 | "" | Artikel 2 | "" ...
 * Zeile 1: ""   | Anzahl    | Größe | Anzahl | Größe ...
 * Zeile 2: Preis (€) | Preis | "" | Preis | "" ...
 * Ab Zeile 3: Name | Anzahl | Größe | ...
 */

function normLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ö/g, "oe")
    .replace(/ß/g, "ss");
}

function isSizeLabel(value) {
  const n = normLabel(value);
  return n === "groesse" || n === "grosse" || n === "size";
}

function isQtyLabel(value) {
  const n = normLabel(value);
  return n === "anzahl" || n === "menge";
}

function qtyCol(articleIndex) {
  return 1 + articleIndex * 2;
}

function sizeCol(articleIndex) {
  return 2 + articleIndex * 2;
}

function articleOfCol(col) {
  return col >= 1 ? Math.floor((col - 1) / 2) : null;
}

function articleCount(data) {
  return Math.max(0, Math.floor(((data?.[0]?.length ?? 1) - 1) / 2));
}

// Anzahl der Druckpositionen steht als "Druck:N" in Zeile 1, Spalte 0.
function printCount(data) {
  const match = String(data?.[1]?.[0] ?? "").trim().match(/^druck:(\d+)$/i);
  if (!match) {
    return 0;
  }
  return Math.max(0, Math.min(Number(match[1]), (data?.length ?? 3) - 3));
}

function setPrintCount(data, count) {
  data[1][0] = count > 0 ? `Druck:${count}` : "";
}

function dataStart(data) {
  return 3 + printCount(data);
}

// Stückpreis je Artikel = Preis + alle Druckpositionen (null, wenn nichts eingetragen)
function unitPrices(data) {
  const count = articleCount(data);
  const prints = printCount(data);
  return Array.from({ length: count }, (_, i) => {
    let total = null;
    for (let r = 2; r < 3 + prints; r += 1) {
      const value = parseNumberValue(data[r]?.[qtyCol(i)]);
      if (value !== null) {
        total = (total ?? 0) + value;
      }
    }
    return total;
  });
}

function isV2Data(data) {
  const sub = data?.[1];
  return Array.isArray(sub) && isQtyLabel(sub[1]) && isSizeLabel(sub[2]);
}

function createPriceRow(cols) {
  const row = Array(cols).fill("");
  if (cols > 0) {
    row[0] = PRICE_LABEL;
  }
  return row;
}

function createEmptyData(rows = DEFAULT_NAMES.length, articles = DEFAULT_ARTICLES) {
  const header = [NAME_LABEL];
  const sub = [""];
  const price = [PRICE_LABEL];
  articles.forEach((name) => {
    header.push(name, "");
    sub.push(QTY_LABEL, SIZE_LABEL);
    price.push("", "");
  });
  const width = header.length;
  const dataRows = Array.from({ length: rows }, (_, rowIndex) => {
    const row = Array(width).fill("");
    row[0] = DEFAULT_NAMES[rowIndex] ?? "";
    return row;
  });
  return [header, sub, price, ...dataRows];
}

function parseNumberValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  let cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned) {
    return null;
  }
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function isPriceRow(row) {
  if (!Array.isArray(row)) {
    return false;
  }
  const hasContent = row.some((cell) => String(cell ?? "").trim() !== "");
  if (!hasContent) {
    return true;
  }
  const hasNumbers = row.some((cell) => parseNumberValue(cell) !== null);
  const hasNonNumeric = row.some((cell, index) => {
    const value = String(cell ?? "").trim();
    return index !== 0 && value && parseNumberValue(value) === null;
  });
  if (!hasNonNumeric && !hasNumbers) {
    const onlyFirstLabel = row.every((cell, index) =>
      index === 0 || String(cell ?? "").trim() === ""
    );
    if (onlyFirstLabel) {
      return true;
    }
  }
  return hasNumbers && !hasNonNumeric;
}

function legacyNormalize(data) {
  const maxCols = Math.max(1, data.reduce((max, row) => Math.max(max, row.length), 0));
  const normalizeRow = (row) =>
    Array.from({ length: maxCols }, (_, col) => row?.[col] ?? "");
  const header = normalizeRow(data[0]);
  const rest = data.slice(1).map(normalizeRow);
  if (!rest.length) {
    rest.push(createPriceRow(maxCols));
  }
  if (!isPriceRow(rest[0])) {
    rest.unshift(createPriceRow(maxCols));
  }
  return [header, ...rest];
}

function isPlainNumber(value) {
  return /^\s*\d+([.,]\d+)?\s*$/.test(String(value ?? ""));
}

// Altes Format (eine Spalte pro Artikel + globale Größe) ins neue Format überführen.
function migrateLegacyData(data) {
  const [header, price, ...rows] = legacyNormalize(data);
  const sizeIndex = header.findIndex((value, index) => index > 0 && isSizeLabel(value));
  const articleCols = header
    .map((_, index) => index)
    .filter((index) => index > 0 && index !== sizeIndex);
  const articleNames = articleCols.length
    ? articleCols.map((index, i) =>
      String(header[index] ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() || `Artikel ${i + 1}`)
    : ["Artikel 1"];
  const out = createEmptyData(0, articleNames);
  out[0][0] = String(header[0] ?? "").trim() || NAME_LABEL;
  out[2][0] = String(price[0] ?? "").trim() || PRICE_LABEL;
  articleCols.forEach((src, i) => {
    out[2][qtyCol(i)] = String(price[src] ?? "").trim();
  });
  rows.forEach((row) => {
    const next = Array(out[0].length).fill("");
    next[0] = String(row[0] ?? "");
    const globalSize = sizeIndex >= 0 ? String(row[sizeIndex] ?? "").trim() : "";
    articleCols.forEach((src, i) => {
      const value = String(row[src] ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (!value) {
        return;
      }
      const onlyQty = value.match(/^(\d+)\s*(?:x|×|stk\.?)?$/i);
      const qtyAndSize = value.match(/^(\d+)\s*(?:x|×|stk\.?)?\s+(.+)$/i);
      if (onlyQty) {
        next[qtyCol(i)] = onlyQty[1];
        if (globalSize) {
          next[sizeCol(i)] = globalSize;
        }
      } else if (qtyAndSize) {
        // z.B. "1 XL": Anzahl und abweichende Größe in einer Zelle
        next[qtyCol(i)] = qtyAndSize[1];
        next[sizeCol(i)] = qtyAndSize[2].trim();
      } else {
        next[sizeCol(i)] = value;
      }
    });
    out.push(next);
  });
  return out;
}

function normalizeSheetData(data) {
  if (!Array.isArray(data) || !data.length) {
    return createEmptyData();
  }
  let rows = data.map((row) =>
    Array.isArray(row) ? row.map((value) => (value === null || value === undefined ? "" : String(value))) : []
  );
  if (!isV2Data(rows)) {
    rows = migrateLegacyData(rows);
  }
  let width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (width < 3) {
    width = 3;
  }
  if ((width - 1) % 2 !== 0) {
    width += 1;
  }
  rows = rows.map((row) => Array.from({ length: width }, (_, col) => row[col] ?? ""));
  while (rows.length < 3) {
    rows.push(Array(width).fill(""));
  }
  const prints = printCount(rows);
  rows[0][0] = rows[0][0].trim() || NAME_LABEL;
  setPrintCount(rows, prints);
  rows[2][0] = rows[2][0].trim() || PRICE_LABEL;
  for (let r = 3; r < 3 + prints; r += 1) {
    rows[r][0] = rows[r][0].trim() || PRINT_DEFAULT_LABEL;
  }
  for (let col = 1; col < width; col += 1) {
    const isQty = col % 2 === 1;
    rows[1][col] = isQty ? QTY_LABEL : SIZE_LABEL;
    if (!isQty) {
      rows[0][col] = "";
      for (let r = 2; r < 3 + prints; r += 1) {
        rows[r][col] = "";
      }
    }
  }
  if (rows.length === 3 + prints) {
    rows.push(Array(width).fill(""));
  }
  return rows;
}

// Entfernt Summenspalte und Gesamtsummenzeile aus einem Excel-Export.
function stripExportExtras(data) {
  if (!Array.isArray(data) || !data.length) {
    return data;
  }
  let rows = data.map((row) => (row || []).map((value) => (value === null || value === undefined ? "" : String(value))));
  rows = rows.filter((row) => String(row[0] ?? "").trim() !== TOTAL_LABEL);
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (rows.length && String(rows[0][width - 1] ?? "").trim() === SUM_HEADER) {
    rows = rows.map((row) => row.slice(0, width - 1));
  }
  // Export-Reihenfolge (Artikel, Preis, Drucke, Stückpreis, Anzahl/Größe) zurückdrehen
  if (rows.length >= 3 && !isV2Data(rows)) {
    const subIndex = rows.findIndex((row, index) => index > 1 && isQtyLabel(row?.[1]) && isSizeLabel(row?.[2]));
    if (subIndex > 1) {
      const top = rows.slice(1, subIndex);
      const priceRow = top[0];
      const printRows = top.slice(1).filter((row) => normLabel(row[0]) !== normLabel(UNIT_PRICE_LABEL));
      const sub = [...rows[subIndex]];
      setPrintCount([null, sub], printRows.length);
      rows = [rows[0], sub, priceRow, ...printRows, ...rows.slice(subIndex + 1)];
    }
  }
  return rows;
}

function computeTotals(data) {
  const prices = unitPrices(data);
  const hasAnyPrice = prices.some((price) => price !== null);
  let grand = 0;
  const rowTotals = data.slice(dataStart(data)).map((row) => {
    let total = 0;
    prices.forEach((price, i) => {
      if (price === null) {
        return;
      }
      const qty = parseNumberValue(row[qtyCol(i)]);
      if (qty === null) {
        return;
      }
      total += price * qty;
    });
    grand += total;
    return total;
  });
  return { prices, hasAnyPrice, rowTotals, grand };
}

/* ---------- DOM ---------- */

const EDITABLE_KINDS = new Set(["name", "qty", "size", "price", "print", "printlabel"]);

function getCellValue(td) {
  const el = td.querySelector(".cell-text") ?? td;
  return el.textContent.trim();
}

function setCellValue(td, value) {
  const el = td.querySelector(".cell-text") ?? td;
  el.textContent = value;
}

function editableElement(td) {
  return td.querySelector(".cell-text") ?? td;
}

function getBodyRows() {
  return Array.from(tbody.rows);
}

function findCell(rowIndex, col) {
  return tbody.rows[rowIndex]?.querySelector(`td[data-col="${col}"]`) ?? null;
}

function createBodyCell(value, col, kind) {
  const cell = document.createElement("td");
  cell.dataset.col = String(col);
  cell.dataset.kind = kind;
  cell.textContent = value ?? "";
  if (kind === "qty") {
    cell.setAttribute("inputmode", "numeric");
    cell.classList.add("num-cell", "qty-cell");
  } else if (kind === "price" || kind === "print") {
    cell.setAttribute("inputmode", "decimal");
    cell.classList.add("num-cell", "price-cell");
  } else if (kind === "size") {
    cell.classList.add("size-cell");
  } else if (kind === "blank") {
    cell.classList.add("blank-cell");
  } else if (kind === "label") {
    cell.classList.add("label-cell");
  }
  return cell;
}

function createNameCell(value) {
  const cell = document.createElement("td");
  cell.dataset.col = "0";
  cell.dataset.kind = "name";
  cell.className = "name-cell";
  const wrap = document.createElement("div");
  wrap.className = "name-wrap";
  const indicator = document.createElement("span");
  indicator.className = "row-drag-indicator";
  indicator.textContent = "☞";
  indicator.contentEditable = "false";
  indicator.title = "Zeile verschieben";
  indicator.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "cell-text";
  text.textContent = value ?? "";
  wrap.append(indicator, text);
  cell.appendChild(wrap);
  return cell;
}

const PRICE_NOTE_LINKS = [
  { text: "Druckkosten", href: "https://www.dgtextildruck.de/content/preise-digitaldirektdruck-dtg" },
  { text: "Versand", href: "https://www.dgtextildruck.de/content/Lieferung" },
];

function createPriceLabelCell(value) {
  const cell = createBodyCell("", 0, "label");
  const label = document.createElement("span");
  label.className = "cell-text";
  label.textContent = value ?? PRICE_LABEL;
  const note = document.createElement("small");
  note.className = "price-note";
  const makeLink = ({ text, href }) => {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = text;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  };
  note.append(
    "zzgl. ",
    makeLink(PRICE_NOTE_LINKS[0]),
    " und ",
    makeLink(PRICE_NOTE_LINKS[1]),
    ` (ab ${formatCurrency(FREE_SHIPPING_FROM).replace(",00", "")} Bestellwert versandfrei)`
  );
  const addPrint = document.createElement("button");
  addPrint.type = "button";
  addPrint.className = "add-print-inline";
  addPrint.textContent = "+ Druckposition";
  addPrint.title = "Druckkosten (z.B. A5 vorne) hinzufügen";
  addPrint.contentEditable = "false";
  addPrint.addEventListener("click", (event) => {
    event.stopPropagation();
    addPrintRow();
  });
  cell.append(label, note, addPrint);
  return cell;
}

function createPrintLabelCell(value, index) {
  const cell = createBodyCell("", 0, "printlabel");
  cell.classList.remove("label-cell");
  cell.classList.add("label-cell", "print-label-cell");
  const wrap = document.createElement("div");
  wrap.className = "name-wrap";
  const text = document.createElement("span");
  text.className = "cell-text";
  text.textContent = value ?? PRINT_DEFAULT_LABEL;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "print-remove";
  remove.textContent = "×";
  remove.title = "Druckposition löschen";
  remove.setAttribute("aria-label", "Druckposition löschen");
  remove.contentEditable = "false";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    removePrintRow(index);
  });
  wrap.append(text, remove);
  cell.appendChild(wrap);
  return cell;
}

function createArticleHeader(value, index) {
  const th = document.createElement("th");
  th.colSpan = 2;
  th.className = "article-header";
  th.dataset.article = String(index);
  const wrap = document.createElement("div");
  wrap.className = "header-wrap";
  const indicator = document.createElement("span");
  indicator.className = "drag-indicator";
  indicator.textContent = "☞";
  indicator.contentEditable = "false";
  indicator.title = "Spalte verschieben";
  indicator.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "header-text";
  text.textContent = value ?? "";
  text.setAttribute("aria-label", "Artikelname");
  wrap.append(indicator, text);
  const handle = document.createElement("span");
  handle.className = "col-resize-handle";
  handle.title = "Breite ändern";
  th.append(wrap, handle);
  return th;
}

function createSubHeader(label, col) {
  const th = document.createElement("th");
  th.className = "sub-header";
  th.dataset.col = String(col);
  th.textContent = label;
  const handle = document.createElement("span");
  handle.className = "col-resize-handle";
  th.appendChild(handle);
  return th;
}

function createFixedHeaderCell(value) {
  const cell = document.createElement("th");
  cell.textContent = value;
  cell.contentEditable = "false";
  cell.setAttribute("data-fixed", "true");
  cell.className = "sum-header";
  return cell;
}

function createSumCell() {
  const cell = document.createElement("td");
  cell.contentEditable = "false";
  cell.className = "sum-cell";
  const valueSpan = document.createElement("span");
  valueSpan.className = "sum-value";
  cell.appendChild(valueSpan);
  return cell;
}

function createDataRow(row, count) {
  const tr = document.createElement("tr");
  tr.appendChild(createNameCell(row[0] ?? ""));
  for (let i = 0; i < count; i += 1) {
    tr.append(
      createBodyCell(row[qtyCol(i)] ?? "", qtyCol(i), "qty"),
      createBodyCell(row[sizeCol(i)] ?? "", sizeCol(i), "size")
    );
  }
  tr.appendChild(createSumCell());
  return tr;
}

function buildTable(data) {
  clearTable();
  clearCellSelection();
  selectionStart = null;
  selectionEnd = null;
  isSelectingCells = false;
  hasDragSelection = false;

  const rows = normalizeSheetData(data);
  const count = articleCount(rows);

  const headRow = document.createElement("tr");
  const nameTh = document.createElement("th");
  nameTh.className = "name-header";
  nameTh.dataset.fixed = "true";
  nameTh.dataset.col = "0";
  nameTh.textContent = rows[0][0];
  const nameHandle = document.createElement("span");
  nameHandle.className = "col-resize-handle";
  nameHandle.title = "Breite ändern";
  nameTh.appendChild(nameHandle);
  headRow.appendChild(nameTh);
  for (let i = 0; i < count; i += 1) {
    headRow.appendChild(createArticleHeader(rows[0][qtyCol(i)], i));
  }
  const prints = printCount(rows);
  const sumTh = createFixedHeaderCell(SUM_HEADER);
  sumTh.rowSpan = 3 + prints + (prints ? 1 : 0);
  headRow.appendChild(sumTh);

  // Preiszeile: eine Zelle pro Artikel (über Anzahl und Größe)
  const priceTr = document.createElement("tr");
  priceTr.className = "price-row";
  priceTr.appendChild(createPriceLabelCell(rows[2][0]));
  for (let i = 0; i < count; i += 1) {
    const priceCell = createBodyCell(rows[2][qtyCol(i)], qtyCol(i), "price");
    priceCell.colSpan = 2;
    priceTr.appendChild(priceCell);
  }

  // Druckpositionen und Stückpreis
  const printTrs = [];
  for (let p = 0; p < prints; p += 1) {
    const tr = document.createElement("tr");
    tr.className = "print-row";
    tr.dataset.print = String(p);
    tr.appendChild(createPrintLabelCell(rows[3 + p][0], p));
    for (let i = 0; i < count; i += 1) {
      const cell = createBodyCell(rows[3 + p][qtyCol(i)], qtyCol(i), "print");
      cell.colSpan = 2;
      tr.appendChild(cell);
    }
    printTrs.push(tr);
  }
  if (prints) {
    const unitTr = document.createElement("tr");
    unitTr.className = "unit-row";
    unitTr.appendChild(createBodyCell(UNIT_PRICE_LABEL, 0, "label"));
    for (let i = 0; i < count; i += 1) {
      const cell = createBodyCell("", qtyCol(i), "unit");
      cell.colSpan = 2;
      cell.classList.add("unit-cell");
      unitTr.appendChild(cell);
    }
    printTrs.push(unitTr);
  }

  const subRow = document.createElement("tr");
  subRow.className = "sub-header-row";
  const nameSub = document.createElement("th");
  nameSub.className = "name-sub";
  subRow.appendChild(nameSub);
  for (let i = 0; i < count; i += 1) {
    subRow.append(createSubHeader(QTY_LABEL, qtyCol(i)), createSubHeader(SIZE_LABEL, sizeCol(i)));
  }
  thead.append(headRow, priceTr, ...printTrs, subRow);

  rows.slice(3 + prints).forEach((row) => {
    tbody.appendChild(createDataRow(row, count));
  });

  applyStoredColumnWidths();
  updateTotals();
  applySheetLockState();
  markCurrentCell();
}

function collectTableData() {
  const headers = Array.from(thead.querySelectorAll("th.article-header"));
  const nameLabel = thead.querySelector("th.name-header")?.textContent.trim() || NAME_LABEL;
  const headerRow = [nameLabel];
  const subRow = [""];
  headers.forEach((th) => {
    headerRow.push(th.querySelector(".header-text")?.textContent.trim() ?? "", "");
    subRow.push(QTY_LABEL, SIZE_LABEL);
  });
  const width = headerRow.length;
  const readRow = (tr) => {
    const row = Array(width).fill("");
    tr?.querySelectorAll("td[data-col]").forEach((td) => {
      const col = Number(td.dataset.col);
      if (col < width && td.dataset.kind !== "blank" && td.dataset.kind !== "unit") {
        row[col] = getCellValue(td);
      }
    });
    return row;
  };
  const priceRow = readRow(thead.querySelector("tr.price-row"));
  if (!priceRow[0]) {
    priceRow[0] = PRICE_LABEL;
  }
  const printRows = Array.from(thead.querySelectorAll("tr.print-row")).map((tr) => {
    const row = readRow(tr);
    row[0] = row[0] || PRINT_DEFAULT_LABEL;
    return row;
  });
  setPrintCount([null, subRow], printRows.length);
  const bodyRows = Array.from(tbody.rows).map(readRow);
  if (!thead.querySelector("tr.price-row")) {
    return createEmptyData();
  }
  return [headerRow, subRow, priceRow, ...printRows, ...bodyRows];
}

function updateTotals() {
  if (!thead.querySelector("tr.price-row")) {
    return;
  }
  const data = collectTableData();
  const { prices, hasAnyPrice, rowTotals, grand } = computeTotals(data);
  thead.querySelectorAll("td.unit-cell").forEach((td) => {
    const price = prices[articleOfCol(Number(td.dataset.col))];
    td.textContent = price === null || price === undefined ? "" : formatCurrency(price);
  });
  getBodyRows().forEach((tr, index) => {
    const sumValue = tr.querySelector(".sum-cell .sum-value");
    if (sumValue) {
      sumValue.textContent = hasAnyPrice ? formatCurrency(rowTotals[index] ?? 0) : "";
    }
  });
  if (grandTotalEl) {
    grandTotalEl.textContent = "";
    if (hasAnyPrice) {
      const totalText = document.createElement("span");
      totalText.textContent = `Gesamtsumme: ${formatCurrency(grand)}`;
      const shipping = document.createElement("span");
      shipping.className = "shipping-hint";
      if (grand >= FREE_SHIPPING_FROM) {
        shipping.classList.add("is-free");
        shipping.textContent = "Versandkostenfrei ✓";
      } else {
        shipping.textContent = `Noch ${formatCurrency(FREE_SHIPPING_FROM - grand)} bis versandkostenfrei`;
      }
      grandTotalEl.append(shipping, totalText);
    }
  }
}

/* ---------- Cursor (zuletzt angeklickte Zelle) ---------- */

function markCurrentCell() {
  table.querySelectorAll(".col-current, .row-current").forEach((el) => {
    el.classList.remove("col-current", "row-current");
  });
  if (!currentCell) {
    return;
  }
  const article = articleOfCol(currentCell.col);
  if (article !== null && article < articleCount(collectTableData())) {
    table.querySelectorAll(
      `[data-col="${qtyCol(article)}"], [data-col="${sizeCol(article)}"], th.article-header[data-article="${article}"]`
    ).forEach((el) => el.classList.add("col-current"));
  }
  if (currentCell.rowIndex >= 0) {
    tbody.rows[currentCell.rowIndex]?.classList.add("row-current");
  }
}

function setCurrentFromElement(target) {
  if (!(target instanceof Element)) {
    return;
  }
  const td = target.closest("td[data-col]");
  if (td && table.contains(td)) {
    currentCell = {
      rowIndex: tbody.contains(td) ? Array.from(tbody.rows).indexOf(td.parentElement) : -1,
      col: Number(td.dataset.col),
    };
    markCurrentCell();
    return;
  }
  const th = target.closest("th.article-header");
  if (th) {
    currentCell = { rowIndex: -1, col: qtyCol(Number(th.dataset.article)) };
    markCurrentCell();
    return;
  }
  const sub = target.closest("th.sub-header");
  if (sub) {
    currentCell = { rowIndex: -1, col: Number(sub.dataset.col) };
    markCurrentCell();
    return;
  }
  if (target.closest("th.name-header")) {
    currentCell = { rowIndex: -1, col: 0 };
    markCurrentCell();
  }
}

function placeCaretAtEnd(el) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectAllIn(el) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
}

function focusCell(rowIndex, col) {
  const td = findCell(rowIndex, col);
  if (!td) {
    return false;
  }
  const el = editableElement(td);
  if (el.isContentEditable) {
    el.focus();
    placeCaretAtEnd(el);
  }
  currentCell = { rowIndex, col };
  markCurrentCell();
  return true;
}

/* ---------- Eingabeprüfung ---------- */

function sanitizePrice(text) {
  let value = String(text ?? "").replace(/[^\d.,]/g, "");
  const sepIndex = value.search(/[.,]/);
  if (sepIndex >= 0) {
    value = value.slice(0, sepIndex + 1) + value.slice(sepIndex + 1).replace(/[.,]/g, "").slice(0, 2);
  }
  return value;
}

function sanitizeByKind(kind, value) {
  if (kind === "qty") {
    return String(value ?? "").replace(/\D/g, "").slice(0, 5);
  }
  if (kind === "price" || kind === "print") {
    return sanitizePrice(value);
  }
  return String(value ?? "");
}

function sanitizeCell(td) {
  const kind = td.dataset.kind;
  if (kind !== "qty" && kind !== "price" && kind !== "print") {
    return false;
  }
  const text = td.textContent;
  const clean = sanitizeByKind(kind, text);
  if (clean !== text) {
    td.textContent = clean;
    placeCaretAtEnd(td);
    return true;
  }
  return false;
}

/* ---------- Verschieben / Spaltenbreite ---------- */

function moveArticle(from, to) {
  if (isActiveSheetLocked() || from === to || from === null || to === null) {
    return;
  }
  const data = collectTableData();
  const count = articleCount(data);
  if (from < 0 || to < 0 || from >= count || to >= count) {
    return;
  }
  data.forEach((row) => {
    const pair = row.splice(qtyCol(from), 2);
    row.splice(qtyCol(to), 0, ...pair);
  });
  commitStructure(data, { rowIndex: -1, col: qtyCol(to) });
  setStatus("Spalte verschoben.");
}

function moveDataRow(from, to) {
  if (isActiveSheetLocked() || from === to || from === null || to === null) {
    return;
  }
  const data = collectTableData();
  const start = dataStart(data);
  const count = data.length - start;
  if (from < 0 || to < 0 || from >= count || to >= count) {
    return;
  }
  const [row] = data.splice(start + from, 1);
  data.splice(start + to, 0, row);
  commitStructure(data, { rowIndex: to, col: currentCell?.col ?? 0 });
  setStatus("Zeile verschoben.");
}

const MIN_COL_WIDTH = 48;
let suppressClickUntil = 0;

function columnWidthKey(col) {
  const n = Number(col);
  if (n === 0) {
    return "__name";
  }
  const article = articleOfCol(n);
  const th = thead.querySelector(`th.article-header[data-article="${article}"] .header-text`);
  const name = th ? th.textContent.trim() : `#${article}`;
  return `${name}|${n % 2 === 1 ? "Anzahl" : "Größe"}`;
}

function rememberColumnWidth(col, width) {
  const sheet = sheets[activeSheetIndex];
  if (!sheet) {
    return;
  }
  sheet.colWidths = { ...(sheet.colWidths || {}), [columnWidthKey(col)]: Math.round(width) };
}

function applyStoredColumnWidths() {
  const widths = sheets[activeSheetIndex]?.colWidths;
  if (!widths) {
    return;
  }
  const cols = [0];
  for (let i = 0; i < thead.querySelectorAll("th.article-header").length; i += 1) {
    cols.push(qtyCol(i), sizeCol(i));
  }
  cols.forEach((col) => {
    const width = widths[columnWidthKey(col)];
    if (width) {
      setColumnWidth(col, width);
    }
  });
}

function columnWidth(col) {
  const cell = table.querySelector(`th[data-col="${col}"]`) || table.querySelector(`td[data-col="${col}"]:not([colspan="2"])`);
  return cell ? cell.getBoundingClientRect().width : 80;
}

// Griff an Name-Überschrift (Spalte 0), Artikel-Überschrift (Anzahl+Größe anteilig) oder Unterspalte
function startResize(event, th) {
  const startX = event.clientX;
  let cols;
  if (th.classList.contains("article-header")) {
    const article = Number(th.dataset.article);
    cols = [qtyCol(article), sizeCol(article)];
  } else {
    cols = [Number(th.dataset.col)];
  }
  const startWidths = cols.map(columnWidth);
  const startTotal = startWidths.reduce((sum, w) => sum + w, 0);
  const lastWidths = [...startWidths];
  document.body.classList.add("no-select");
  th.classList.add("is-resizing");

  function onPointerMove(moveEvent) {
    const delta = moveEvent.clientX - startX;
    const total = Math.max(MIN_COL_WIDTH * cols.length, startTotal + delta);
    cols.forEach((col, i) => {
      const width = Math.max(MIN_COL_WIDTH, Math.round(total * (startWidths[i] / startTotal)));
      lastWidths[i] = width;
      setColumnWidth(col, width);
    });
  }

  function onPointerUp() {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
    document.body.classList.remove("no-select");
    th.classList.remove("is-resizing");
    suppressClickUntil = Date.now() + 300;
    cols.forEach((col, i) => rememberColumnWidth(col, lastWidths[i]));
    autosave();
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

function setColumnWidth(col, width) {
  table.querySelectorAll(`[data-col="${col}"]`).forEach((cell) => {
    if (cell.colSpan > 1) {
      return;
    }
    cell.style.width = `${width}px`;
    cell.style.minWidth = `${width}px`;
    cell.style.maxWidth = `${width}px`;
  });
}

function clearDropTargets() {
  table.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
}

function resolveDropTarget(element, kind) {
  if (!(element instanceof Element)) {
    return null;
  }
  if (kind === "col") {
    return element.closest("th.article-header");
  }
  const tr = element.closest("tr");
  return tr && tbody.contains(tr) ? tr : null;
}

// Maus: HTML5 Drag & Drop nur über den Griff
table.addEventListener("dragstart", (event) => {
  const indicator = event.target instanceof Element
    ? event.target.closest(".drag-indicator, .row-drag-indicator")
    : null;
  if (!indicator || isActiveSheetLocked()) {
    event.preventDefault();
    return;
  }
  if (indicator.classList.contains("drag-indicator")) {
    const th = indicator.closest("th.article-header");
    dragSourceIndex = Number(th.dataset.article);
    th.classList.add("col-dragging");
  } else {
    const tr = indicator.closest("tr");
    dragRowSourceIndex = getBodyRows().indexOf(tr);
    tr.classList.add("row-dragging");
  }
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", "");
});

table.addEventListener("dragover", (event) => {
  const kind = dragSourceIndex !== null ? "col" : dragRowSourceIndex !== null ? "row" : null;
  if (!kind) {
    return;
  }
  const target = resolveDropTarget(event.target, kind);
  if (!target) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  if (!target.classList.contains("drop-target")) {
    clearDropTargets();
    target.classList.add("drop-target");
  }
});

table.addEventListener("drop", (event) => {
  const kind = dragSourceIndex !== null ? "col" : dragRowSourceIndex !== null ? "row" : null;
  if (!kind) {
    return;
  }
  event.preventDefault();
  const target = resolveDropTarget(event.target, kind);
  clearDropTargets();
  if (!target) {
    return;
  }
  if (kind === "col") {
    const from = dragSourceIndex;
    dragSourceIndex = null;
    moveArticle(from, Number(target.dataset.article));
  } else {
    const from = dragRowSourceIndex;
    dragRowSourceIndex = null;
    moveDataRow(from, getBodyRows().indexOf(target));
  }
});

table.addEventListener("dragend", () => {
  dragSourceIndex = null;
  dragRowSourceIndex = null;
  clearDropTargets();
  table.querySelectorAll(".col-dragging, .row-dragging").forEach((el) => {
    el.classList.remove("col-dragging", "row-dragging");
  });
});

// Touch/Stift: Verschieben per Pointer Events, Spaltenbreite per Griff
table.addEventListener("pointerdown", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const handle = event.target.closest(".col-resize-handle");
  if (handle) {
    if (isActiveSheetLocked()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    startResize(event, handle.closest("th"));
    return;
  }
  const indicator = event.target.closest(".drag-indicator, .row-drag-indicator");
  if (!indicator || event.pointerType === "mouse" || isActiveSheetLocked()) {
    return;
  }
  event.preventDefault();
  const kind = indicator.classList.contains("drag-indicator") ? "col" : "row";
  const source = indicator.closest(kind === "col" ? "th" : "tr");
  if (!source) {
    return;
  }
  const dragClass = kind === "col" ? "col-dragging" : "row-dragging";
  let currentTarget = null;
  source.classList.add(dragClass);
  try {
    indicator.setPointerCapture(event.pointerId);
  } catch (error) {
    // ignore
  }

  const onMove = (moveEvent) => {
    const target = resolveDropTarget(document.elementFromPoint(moveEvent.clientX, moveEvent.clientY), kind);
    if (target === currentTarget) {
      return;
    }
    currentTarget?.classList.remove("drop-target");
    currentTarget = target && target !== source ? target : null;
    currentTarget?.classList.add("drop-target");
  };

  const finish = (apply) => {
    indicator.removeEventListener("pointermove", onMove);
    indicator.removeEventListener("pointerup", onUp);
    indicator.removeEventListener("pointercancel", onCancel);
    source.classList.remove(dragClass);
    currentTarget?.classList.remove("drop-target");
    if (!apply || !currentTarget) {
      return;
    }
    if (kind === "col") {
      moveArticle(Number(source.dataset.article), Number(currentTarget.dataset.article));
    } else {
      const rows = getBodyRows();
      moveDataRow(rows.indexOf(source), rows.indexOf(currentTarget));
    }
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);

  indicator.addEventListener("pointermove", onMove);
  indicator.addEventListener("pointerup", onUp);
  indicator.addEventListener("pointercancel", onCancel);
});

function makeUniqueName(baseName, excludeIndex = null) {
  const trimmed = baseName.trim() || "Sheet";
  let name = trimmed;
  let index = 1;
  const matchesName = (sheet, sheetIndex) => {
    if (excludeIndex !== null && sheetIndex === excludeIndex) {
      return false;
    }
    return sheet.name === name;
  };
  while (sheets.some(matchesName)) {
    index += 1;
    name = `${trimmed} ${index}`;
  }
  return name;
}

function saveActiveSheet() {
  if (!sheets[activeSheetIndex]) {
    return;
  }
  sheets[activeSheetIndex].data = collectTableData();
}

function isSheetVisibleInSwitcher(sheet, index) {
  return index === activeSheetIndex || !sheet.locked || showLockedSheets;
}

function renderSheetSelect() {
  if (!sheetSelect) {
    return;
  }
  sheetSelect.innerHTML = "";
  let hiddenCount = 0;
  sheets.forEach((sheet, index) => {
    if (!isSheetVisibleInSwitcher(sheet, index)) {
      hiddenCount += 1;
      return;
    }
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = sheet.locked ? `${sheet.name} 🔒` : sheet.name;
    option.selected = index === activeSheetIndex;
    sheetSelect.appendChild(option);
  });
  sheetSelect.disabled = sheetSelect.options.length <= 1;
  if (showLockedCheckbox) {
    showLockedCheckbox.checked = showLockedSheets;
    const lockedCount = sheets.filter((sheet) => sheet.locked).length;
    const label = showLockedCheckbox.parentElement?.querySelector("span");
    if (label) {
      label.textContent = lockedCount
        ? `Abgeschlossene anzeigen (${lockedCount})`
        : "Abgeschlossene anzeigen";
    }
    showLockedCheckbox.disabled = lockedCount === 0;
  }
  return hiddenCount;
}

function renderTabs() {
  tabsList.innerHTML = "";
  const index = activeSheetIndex;
  const sheet = sheets[index];
  if (sheet) {
    const button = document.createElement("div");
    button.className = "tab";
    if (sheet.locked) {
      button.classList.add("is-locked");
      button.title = "Bestellung abgeschlossen";
    }
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", "true");

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = sheet.name;
    nameSpan.contentEditable = sheet.locked ? "false" : "true";
    nameSpan.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        nameSpan.blur();
      }
    });
    nameSpan.addEventListener("blur", () => {
      if (sheet.locked) {
        nameSpan.textContent = sheet.name;
        return;
      }
      const updated = makeUniqueName(nameSpan.textContent, index);
      if (updated === sheets[index].name) {
        nameSpan.textContent = updated;
        return;
      }
      sheets[index].name = updated;
      nameSpan.textContent = updated;
      renderSheetSelect();
      updateInvoiceSheetOptions();
      autosave();
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "tab-remove";
    removeButton.textContent = "−";
    removeButton.title = "Tabellenblatt löschen";
    removeButton.setAttribute("aria-label", "Tabellenblatt löschen");
    removeButton.disabled = sheets.length <= 1 || sheet.locked;
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeSheetAt(index, `Tabellenblatt "${sheet.name}" wirklich löschen?`);
    });

    button.append(nameSpan, removeButton);
    tabsList.appendChild(button);
  }
  const addTabButton = document.createElement("button");
  addTabButton.type = "button";
  addTabButton.className = "tab tab-add";
  addTabButton.textContent = "+";
  addTabButton.title = "Neues Tabellenblatt";
  addTabButton.setAttribute("aria-label", "Neues Tabellenblatt");
  addTabButton.addEventListener("click", () => addSheet());
  tabsList.appendChild(addTabButton);
  renderSheetSelect();
  updateInvoiceSheetOptions();
}

if (sheetSelect) {
  sheetSelect.addEventListener("change", () => {
    const index = Number(sheetSelect.value);
    if (Number.isInteger(index) && sheets[index]) {
      setActiveSheet(index);
    }
  });
}

if (showLockedCheckbox) {
  showLockedCheckbox.checked = showLockedSheets;
  showLockedCheckbox.addEventListener("change", () => {
    showLockedSheets = showLockedCheckbox.checked;
    writeShowLocked(showLockedSheets);
    renderSheetSelect();
  });
}

function firstUnlockedIndex() {
  const index = sheets.findIndex((sheet) => !sheet.locked);
  return index === -1 ? 0 : index;
}

function removeSheetAt(index, confirmMessage) {
  if (sheets[index]?.locked) {
    setStatus("Tabellenblatt ist abgeschlossen.");
    return;
  }
  if (sheets.length <= 1) {
    setStatus("Mindestens ein Tabellenblatt muss bleiben.");
    return;
  }
  if (index < 0 || index >= sheets.length) {
    return;
  }
  const name = sheets[index]?.name || "Tabellenblatt";
  if (!window.confirm(confirmMessage || `Tabellenblatt "${name}" wirklich löschen?`)) {
    return;
  }
  saveActiveSheet();
  sheets.splice(index, 1);
  currentCell = null;
  if (activeSheetIndex > index) {
    activeSheetIndex -= 1;
  }
  if (activeSheetIndex >= sheets.length) {
    activeSheetIndex = sheets.length - 1;
  }
  buildTable(sheets[activeSheetIndex].data);
  renderTabs();
  setStatus("Tabellenblatt gelöscht.");
  saveNow();
}

function setActiveSheet(index) {
  if (index === activeSheetIndex) {
    return;
  }
  saveActiveSheet();
  activeSheetIndex = index;
  currentCell = null;
  sheets[activeSheetIndex].data = normalizeSheetData(sheets[activeSheetIndex].data);
  buildTable(sheets[activeSheetIndex].data);
  renderTabs();
  updateInvoiceSheetOptions();
  applySheetLockState();
  setStatus(`Switched to ${sheets[activeSheetIndex].name}`);
}

function addSheet(name) {
  saveActiveSheet();
  const sheetName = makeUniqueName(name || `Sheet ${sheets.length + 1}`);
  sheets.push({ name: sheetName, data: createEmptyData(), locked: false });
  activeSheetIndex = sheets.length - 1;
  currentCell = null;
  buildTable(sheets[activeSheetIndex].data);
  renderTabs();
  updateInvoiceSheetOptions();
  setStatus(`Added ${sheetName}`);
  autosave();
}

function commitStructure(data, focus) {
  if (sheets[activeSheetIndex]) {
    sheets[activeSheetIndex].data = data;
  }
  buildTable(data);
  if (focus) {
    currentCell = focus;
    markCurrentCell();
  }
  autosave();
}

function uniqueArticleName(data) {
  const names = new Set();
  for (let i = 0; i < articleCount(data); i += 1) {
    names.add(String(data[0][qtyCol(i)] ?? "").trim());
  }
  let name = "Neuer Artikel";
  let n = 2;
  while (names.has(name)) {
    name = `Neuer Artikel ${n}`;
    n += 1;
  }
  return name;
}

function currentDataRowIndex() {
  // Index der Datenzeile (0 = erste Person), null wenn keine Datenzeile gewählt ist
  if (!currentCell || currentCell.rowIndex < 0) {
    return null;
  }
  return currentCell.rowIndex;
}

function addRow() {
  if (!ensureEditable()) {
    return;
  }
  const data = collectTableData();
  const width = data[0].length;
  const current = currentDataRowIndex();
  const start = dataStart(data);
  const dataCount = data.length - start;
  const insertAt = current === null ? dataCount : Math.min(current + 1, dataCount);
  data.splice(start + insertAt, 0, Array(width).fill(""));
  commitStructure(data, null);
  focusCell(insertAt, 0);
  setStatus(current === null ? "Zeile am Ende hinzugefügt." : "Zeile unterhalb eingefügt.");
}

function removeRow() {
  if (!ensureEditable()) {
    return;
  }
  const current = currentDataRowIndex();
  if (current === null) {
    setStatus("Bitte zuerst eine Zelle in der Zeile antippen, die gelöscht werden soll.");
    return;
  }
  const data = collectTableData();
  const start = dataStart(data);
  const dataCount = data.length - start;
  if (dataCount <= 1) {
    setStatus("Mindestens eine Datenzeile muss bleiben.");
    return;
  }
  const name = String(data[start + current]?.[0] ?? "").trim() || "ohne Namen";
  if (!window.confirm(`Zeile „${name}“ wirklich löschen?`)) {
    return;
  }
  data.splice(start + current, 1);
  const nextRow = Math.min(current, dataCount - 2);
  commitStructure(data, { rowIndex: nextRow, col: currentCell?.col ?? 0 });
  setStatus("Zeile gelöscht.");
}

function addPrintRow() {
  if (!ensureEditable()) {
    return;
  }
  const data = collectTableData();
  const prints = printCount(data);
  const row = Array(data[0].length).fill("");
  row[0] = `${PRINT_DEFAULT_LABEL} ${prints + 1}`;
  data.splice(3 + prints, 0, row);
  setPrintCount(data, prints + 1);
  commitStructure(data, null);
  const label = thead.querySelector(`tr.print-row[data-print="${prints}"] .cell-text`);
  if (label?.isContentEditable) {
    label.focus();
    selectAllIn(label);
  }
  setStatus("Druckposition hinzugefügt – Bezeichnung (z.B. A5 vorne) und Preise pro Artikel eintragen.");
}

function removePrintRow(index) {
  if (!ensureEditable()) {
    return;
  }
  const data = collectTableData();
  const prints = printCount(data);
  if (index < 0 || index >= prints) {
    return;
  }
  const label = String(data[3 + index][0] ?? "").trim() || PRINT_DEFAULT_LABEL;
  if (!window.confirm(`Druckposition „${label}“ wirklich löschen?`)) {
    return;
  }
  data.splice(3 + index, 1);
  setPrintCount(data, prints - 1);
  commitStructure(data, null);
  setStatus(`Druckposition „${label}“ gelöscht.`);
}

function addColumn(side) {
  if (!ensureEditable()) {
    return;
  }
  const data = collectTableData();
  const count = articleCount(data);
  let position;
  if (!currentCell) {
    position = count;
  } else if (currentCell.col === 0) {
    position = 0;
  } else {
    const article = articleOfCol(currentCell.col);
    position = side === "left" ? article : article + 1;
  }
  position = Math.max(0, Math.min(position, count));
  const name = uniqueArticleName(data);
  data.forEach((row, rowIndex) => {
    let cells = ["", ""];
    if (rowIndex === 0) {
      cells = [name, ""];
    } else if (rowIndex === 1) {
      cells = [QTY_LABEL, SIZE_LABEL];
    }
    row.splice(qtyCol(position), 0, ...cells);
  });
  const keepRow = currentCell?.rowIndex ?? -1;
  commitStructure(data, { rowIndex: keepRow, col: qtyCol(position) });
  const headerText = thead.querySelector(`th.article-header[data-article="${position}"] .header-text`);
  if (headerText && headerText.isContentEditable) {
    headerText.focus();
    selectAllIn(headerText);
  }
  setStatus(`Spalte „${name}“ eingefügt – Namen einfach überschreiben.`);
}

function removeColumn() {
  if (!ensureEditable()) {
    return;
  }
  const article = currentCell ? articleOfCol(currentCell.col) : null;
  if (article === null) {
    setStatus("Bitte zuerst eine Zelle in der Spalte antippen, die gelöscht werden soll.");
    return;
  }
  const data = collectTableData();
  const count = articleCount(data);
  if (article >= count) {
    return;
  }
  if (count <= 1) {
    setStatus("Mindestens eine Spalte muss bleiben.");
    return;
  }
  const name = String(data[0][qtyCol(article)] ?? "").trim() || "ohne Namen";
  if (!window.confirm(`Spalte „${name}“ (Anzahl und Größe) wirklich löschen?`)) {
    return;
  }
  data.forEach((row) => row.splice(qtyCol(article), 2));
  const next = Math.min(article, count - 2);
  commitStructure(data, { rowIndex: currentCell?.rowIndex ?? -1, col: qtyCol(next) });
  setStatus(`Spalte „${name}“ gelöscht.`);
}

function removeSheet() {
  removeSheetAt(activeSheetIndex, "Aktuelles Tabellenblatt wirklich löschen?");
}

function tableHasData() {
  return thead.children.length > 0 && tbody.children.length > 0;
}

function getCellCoords(cell) {
  const row = cell.closest("tr");
  if (!row || cell.dataset.col === undefined) {
    return null;
  }
  const rowIndex = Array.from(tbody.rows).indexOf(row);
  if (rowIndex === -1) {
    return null;
  }
  return { rowIndex, colIndex: Number(cell.dataset.col) };
}

function clearCellSelection() {
  tbody.querySelectorAll("td.cell-selected").forEach((cell) => {
    cell.classList.remove("cell-selected");
  });
}

function applyCellSelection(start, end) {
  if (!start || !end) {
    return;
  }
  const rowMin = Math.min(start.rowIndex, end.rowIndex);
  const rowMax = Math.max(start.rowIndex, end.rowIndex);
  const colMin = Math.min(start.colIndex, end.colIndex);
  const colMax = Math.max(start.colIndex, end.colIndex);
  Array.from(tbody.rows).forEach((row, rowIndex) => {
    row.querySelectorAll("td[data-col]").forEach((cell) => {
      const colIndex = Number(cell.dataset.col);
      const isSelected = rowIndex >= rowMin
        && rowIndex <= rowMax
        && colIndex >= colMin
        && colIndex <= colMax;
      cell.classList.toggle("cell-selected", isSelected);
    });
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getSheetsForDownload() {
  saveActiveSheet();
  if (!sheets.length) {
    return [];
  }
  if (downloadScopeSelect?.value === "all") {
    return sheets;
  }
  return [sheets[activeSheetIndex]];
}

function excelSheetName(name, used) {
  const base = String(name ?? "").replace(/[\[\]:*?\/\\]/g, "").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function buildExportSheet(sheet) {
  const data = normalizeSheetData(sheet.data);
  const count = articleCount(data);
  const prints = printCount(data);
  const start = dataStart(data);
  const { prices, hasAnyPrice, rowTotals, grand } = computeTotals(data);
  const round = (value) => Math.round(value * 100) / 100;
  const articles = Array.from({ length: count }, (_, i) => i);
  const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) {
      return "";
    }
    const number = parseNumberValue(value);
    return number === null ? value : number;
  };
  const pairRow = (label, values) => {
    const row = [label];
    values.forEach((value) => row.push(value, ""));
    row.push("");
    return row;
  };

  const aoa = [];
  aoa.push([...data[0], SUM_HEADER]);
  aoa.push(pairRow(data[2][0], articles.map((i) => toNumber(data[2][qtyCol(i)]))));
  for (let p = 0; p < prints; p += 1) {
    aoa.push(pairRow(data[3 + p][0], articles.map((i) => toNumber(data[3 + p][qtyCol(i)]))));
  }
  if (prints) {
    aoa.push(pairRow(UNIT_PRICE_LABEL, prices.map((price) => (price === null ? "" : round(price)))));
  }
  const subIndex = aoa.length;
  aoa.push(["", ...data[1].slice(1), ""]);
  data.slice(start).forEach((row, index) => {
    const out = row.map((value, col) => (col >= 1 && col % 2 === 1 ? toNumber(value) : value));
    out.push(hasAnyPrice ? round(rowTotals[index]) : "");
    aoa.push(out);
  });
  const width = aoa[0].length;
  if (hasAnyPrice) {
    const totalRow = Array(width).fill("");
    totalRow[0] = TOTAL_LABEL;
    totalRow[width - 1] = round(grand);
    aoa.push(totalRow);
  }

  const merges = [{ s: { r: 0, c: width - 1 }, e: { r: subIndex, c: width - 1 } }];
  for (let i = 0; i < count; i += 1) {
    for (let r = 0; r < subIndex; r += 1) {
      merges.push({ s: { r, c: qtyCol(i) }, e: { r, c: sizeCol(i) } });
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!merges"] = merges;
  worksheet["!cols"] = [{ wch: 30 }, ...Array.from({ length: count * 2 }, () => ({ wch: 10 })), { wch: 12 }];
  const currencyFormat = '#,##0.00 "€"';
  const setFormat = (r, c) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
    if (cell && cell.t === "n") {
      cell.z = currencyFormat;
    }
  };
  for (let r = 1; r < subIndex; r += 1) {
    for (let i = 0; i < count; i += 1) {
      setFormat(r, qtyCol(i));
    }
  }
  for (let r = subIndex + 1; r < aoa.length; r += 1) {
    setFormat(r, width - 1);
  }
  return worksheet;
}

function downloadWorkbook() {
  if (typeof XLSX === "undefined" || !XLSX.utils) {
    setStatus("Excel-Bibliothek nicht geladen. Bitte Seite neu laden.");
    return;
  }
  const list = getSheetsForDownload();
  if (!list.length) {
    return;
  }
  const workbook = XLSX.utils.book_new();
  const used = new Set();
  list.forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, buildExportSheet(sheet), excelSheetName(sheet.name, used));
  });
  const filename = buildFilename("xlsx", list);
  if (typeof XLSX.writeFile === "function") {
    XLSX.writeFile(workbook, filename);
  } else {
    const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    triggerDownload(new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }), filename);
  }
  setStatus(`Heruntergeladen: ${filename}`);
}

function downloadPDF() {
  if (!window.jspdf?.jsPDF) {
    setStatus("PDF-Bibliothek nicht geladen. Bitte Seite neu laden.");
    return;
  }
  const list = getSheetsForDownload();
  if (!list.length) {
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: pdfOrientationSelect.value,
    unit: "pt",
    format: "a4",
  });

  list.forEach((sheet, index) => {
    if (index > 0) {
      doc.addPage();
    }
    const data = normalizeSheetData(sheet.data);
    const count = articleCount(data);
    const width = data[0].length;
    const { hasAnyPrice, rowTotals, grand } = computeTotals(data);
    const articles = Array.from({ length: count }, (_, i) => i);

    const prints = printCount(data);
    const { prices } = computeTotals(data);
    const priceStyle = { fillColor: [255, 243, 231], textColor: 20, halign: "center" };
    const moneyRow = (label, values, extra = {}) => [
      { content: label, styles: { ...priceStyle, halign: "left", ...extra } },
      ...values.map((value) => {
        const number = typeof value === "number" ? value : parseNumberValue(value);
        return {
          content: number === null ? (value ?? "") : formatCurrency(number),
          colSpan: 2,
          styles: { ...priceStyle, ...extra },
        };
      }),
    ];
    const headerRowCount = 3 + prints + (prints ? 1 : 0);
    const head = [
      [
        { content: data[0][0], styles: { valign: "middle" } },
        ...articles.map((i) => ({ content: data[0][qtyCol(i)], colSpan: 2, styles: { halign: "center" } })),
        { content: SUM_HEADER, rowSpan: headerRowCount, styles: { valign: "middle", halign: "right" } },
      ],
      moneyRow(data[2][0], articles.map((i) => data[2][qtyCol(i)])),
      ...Array.from({ length: prints }, (_, p) =>
        moneyRow(data[3 + p][0], articles.map((i) => data[3 + p][qtyCol(i)]), { fontStyle: "normal" })),
      ...(prints ? [moneyRow(UNIT_PRICE_LABEL, prices.map((price) => (price === null ? "" : price)), { fontStyle: "bold" })] : []),
      ["", ...articles.flatMap(() => [QTY_LABEL, SIZE_LABEL])],
    ];
    const body = [
      ...data.slice(dataStart(data)).map((row, rowIndex) => [
        ...row,
        hasAnyPrice ? formatCurrency(rowTotals[rowIndex] ?? 0) : "",
      ]),
    ];
    const foot = hasAnyPrice
      ? [[{ content: TOTAL_LABEL, colSpan: width, styles: { halign: "right" } }, formatCurrency(grand)]]
      : undefined;

    doc.setFontSize(14);
    doc.text(sheet.name, 40, 40);
    doc.autoTable({
      startY: 60,
      head,
      body,
      foot,
      showFoot: "lastPage",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [195, 76, 45], textColor: 255 },
      footStyles: { fillColor: [255, 243, 231], textColor: 20, fontStyle: "bold" },
      columnStyles: { [width]: { halign: "right" } },
      theme: "grid",
    });
  });

  const filename = buildFilename("pdf", list);
  doc.save(filename);
  setStatus(`Heruntergeladen: ${filename}`);
}

async function handleFile(file) {
  if (!file) {
    return;
  }
  if (typeof XLSX === "undefined" || !XLSX.read) {
    setStatus("Excel-Bibliothek nicht geladen. Bitte Seite neu laden.");
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    if (!workbook.SheetNames.length) {
      setStatus("Die Datei enthält keine Tabellenblätter.");
      return;
    }
    // Importierte Blätter werden ergänzt, bestehende bleiben erhalten.
    saveActiveSheet();
    const firstNew = sheets.length;
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" })
        .map((row) => row.map((value) => (
          typeof value === "number" && !Number.isInteger(value)
            ? value.toFixed(2).replace(".", ",")
            : value
        )));
      sheets.push({
        name: makeUniqueName(sheetName),
        data: normalizeSheetData(stripExportExtras(raw)),
        locked: false,
      });
    });
    const added = sheets.length - firstNew;

    activeSheetIndex = firstNew;
    currentCell = null;
    buildTable(sheets[activeSheetIndex].data);
    renderTabs();
    autosave();
    setStatus(`${file.name}: ${added} ${added === 1 ? "Tabellenblatt" : "Tabellenblätter"} hinzugefügt.`);
  } catch (error) {
    console.error(error);
    setStatus("Datei konnte nicht gelesen werden. Bitte eine andere .xlsx-Datei wählen.");
  }
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  handleFile(file);
});

newSheetButton.addEventListener("click", () => {
  addSheet();
});

addRowButton.addEventListener("click", () => {
  addRow();
});

removeRowButton.addEventListener("click", () => {
  removeRow();
});

addPrintButton?.addEventListener("click", () => {
  addPrintRow();
});

addColLeftButton.addEventListener("click", () => {
  addColumn("left");
});

addColRightButton.addEventListener("click", () => {
  addColumn("right");
});

removeColButton.addEventListener("click", () => {
  removeColumn();
});

removeSheetButton.addEventListener("click", () => {
  removeSheet();
});

if (toggleLockButton) {
  toggleLockButton.addEventListener("click", () => {
    const locked = isActiveSheetLocked();
    if (!locked) {
      const confirmed = window.confirm("Bestellung abschließen und Schreibschutz aktivieren?");
      if (!confirmed) {
        return;
      }
      setActiveSheetLocked(true);
      return;
    }
    const confirmed = window.confirm("Schreibschutz aufheben und Bestellung wieder öffnen?");
    if (!confirmed) {
      return;
    }
    setActiveSheetLocked(false);
  });
}

downloadButton.addEventListener("click", () => {
  downloadWorkbook();
});

downloadPdfButton.addEventListener("click", () => {
  downloadPDF();
});

function updateInvoiceSheetOptions() {
  if (!invoiceSheetSelect) {
    return;
  }
  invoiceSheetSelect.innerHTML = "";
  if (!sheets.length) {
    const option = document.createElement("option");
    option.value = "Sheet 1";
    option.textContent = "Sheet 1";
    invoiceSheetSelect.appendChild(option);
    return;
  }
  sheets.forEach((sheet, index) => {
    const option = document.createElement("option");
    option.value = sheet.name;
    option.textContent = sheet.name;
    invoiceSheetSelect.appendChild(option);
    if (index === activeSheetIndex) {
      option.selected = true;
    }
  });
  if (sheets[activeSheetIndex]) {
    invoiceSheetSelect.value = sheets[activeSheetIndex].name;
  }
  updateInvoiceList();
}

function formatInvoiceLabel(invoice) {
  const sheetName = invoice.sheet_name || "Ohne Sheet";
  const timestamp = invoice.uploaded_at ? new Date(invoice.uploaded_at) : null;
  const readable = timestamp && !Number.isNaN(timestamp.getTime())
    ? timestamp.toLocaleString()
    : "Unbekanntes Datum";
  return `${sheetName} · ${invoice.original_name} · ${readable}`;
}

function getFilteredInvoices() {
  const selectedSheet = getCurrentInvoiceSheetName();
  const filteredBySheet = selectedSheet
    ? invoices.filter((invoice) => (invoice.sheet_name || "").trim() === selectedSheet)
    : invoices;
  if (!invoiceSearchInput) {
    return filteredBySheet;
  }
  const query = invoiceSearchInput.value.trim().toLowerCase();
  if (!query) {
    return filteredBySheet;
  }
  return filteredBySheet.filter((invoice) => {
    const haystack = `${invoice.sheet_name || ""} ${invoice.original_name || ""} ${invoice.uploaded_at || ""}`
      .toLowerCase();
    return haystack.includes(query);
  });
}

function getCurrentInvoiceSheetName() {
  const selected = invoiceSheetSelect?.value?.trim();
  if (selected) {
    return selected;
  }
  return sheets[activeSheetIndex]?.name?.trim() || "";
}

function updateInvoiceCount(filtered) {
  if (!invoiceCountEl) {
    return;
  }
  const selectedSheet = getCurrentInvoiceSheetName();
  if (!selectedSheet) {
    invoiceCountEl.textContent = `${filtered.length} Rechnungen`;
    return;
  }
  invoiceCountEl.textContent = `${filtered.length} Rechnungen für "${selectedSheet}"`;
}

function renderInvoicePreviewList(filtered) {
  if (!invoicePreviewList) {
    return;
  }
  invoicePreviewList.innerHTML = "";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "meta";
    empty.textContent = "Keine Rechnungen für dieses Sheet.";
    invoicePreviewList.appendChild(empty);
    return;
  }
  filtered.forEach((invoice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "invoice-preview-item";
    button.textContent = invoice.original_name || "Rechnung";
    button.dataset.invoiceId = String(invoice.id);
    if (invoiceSelect && invoiceSelect.value === String(invoice.id)) {
      button.classList.add("is-active");
    }
    button.addEventListener("click", () => {
      if (invoiceSelect) {
        invoiceSelect.value = String(invoice.id);
      }
      hasUserSelectedInvoice = true;
      updateInvoiceActionsState();
      updateInvoicePreview();
      updateInvoiceList();
    });
    invoicePreviewList.appendChild(button);
  });
}

function updateInvoiceList() {
  if (!invoiceSelect) {
    return;
  }
  const filtered = getFilteredInvoices();
  const previous = invoiceSelect.value;
  invoiceSelect.innerHTML = "";
  if (!filtered.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = invoices.length ? "Keine Treffer" : "Keine Rechnungen vorhanden";
    invoiceSelect.appendChild(option);
  } else {
    filtered.forEach((invoice) => {
      const option = document.createElement("option");
      option.value = String(invoice.id);
      option.textContent = formatInvoiceLabel(invoice);
      if (previous && option.value === previous) {
        option.selected = true;
      }
      invoiceSelect.appendChild(option);
    });
    if (!invoiceSelect.value && filtered[0]) {
      invoiceSelect.value = String(filtered[0].id);
    }
  }
  updateInvoiceCount(filtered);
  renderInvoicePreviewList(filtered);
  updateInvoiceActionsState();
  if (hasUserSelectedInvoice) {
    updateInvoicePreview();
  }
}

function updateInvoiceActionsState() {
  const hasSelection = Boolean(invoiceSelect && invoiceSelect.value);
  if (viewInvoiceButton) {
    viewInvoiceButton.disabled = !hasSelection;
  }
  if (downloadInvoiceButton) {
    downloadInvoiceButton.disabled = !hasSelection;
  }
  if (deleteInvoiceButton) {
    deleteInvoiceButton.disabled = !hasSelection;
  }
}

function updateInvoicePreview() {
  if (!invoicePreviewFrame) {
    return;
  }
  if (!invoiceSelect || !invoiceSelect.value) {
    invoicePreviewFrame.src = "about:blank";
    invoicePreviewFrame.srcdoc = "<p style=\"font-family: sans-serif; color: #6a5f52;\">Keine Rechnung ausgewählt.</p>";
    return;
  }
  const id = encodeURIComponent(invoiceSelect.value);
  invoicePreviewFrame.removeAttribute("srcdoc");
  invoicePreviewFrame.src = `api/invoice_download.php?id=${id}&inline=1`;
}

async function fetchInvoices() {
  try {
    const response = await fetch("api/invoice_list.php");
    const result = await readJsonResponse(response);
    if (!result.ok || result.data.status !== "ok") {
      throw new Error(result.data.message || "Invoice list failed");
    }
    invoices = Array.isArray(result.data.invoices) ? result.data.invoices : [];
    updateInvoiceList();
  } catch (error) {
    console.error(error);
    setStatus(`Rechnungen laden fehlgeschlagen: ${error.message}`);
  }
}

async function uploadSingleInvoice(file, sheetName) {
  const formData = new FormData();
  formData.append("invoice", file);
  formData.append("sheet_name", sheetName);

  const response = await fetch("api/invoice_upload.php", {
    method: "POST",
    body: formData,
  });
  const result = await readJsonResponse(response);
  if (!result.ok || result.data.status !== "ok") {
    throw new Error(result.data.message || "Invoice upload failed");
  }
}

async function uploadInvoice() {
  if (!invoiceInput) {
    return;
  }
  const files = Array.from(invoiceInput.files || []);
  if (!files.length) {
    setStatus("Bitte mindestens eine PDF auswählen.");
    return;
  }
  const nonPdf = files.find((file) => file.type && file.type !== "application/pdf");
  if (nonPdf) {
    setStatus("Bitte nur PDF-Dateien auswählen.");
    return;
  }
  const sheetName = invoiceSheetSelect?.value || sheets[activeSheetIndex]?.name || "";

  try {
    setStatus(`Rechnungen werden hochgeladen (${files.length})...`);
    for (const file of files) {
      await uploadSingleInvoice(file, sheetName);
    }
    invoiceInput.value = "";
    setStatus(files.length === 1 ? "Rechnung hochgeladen." : "Rechnungen hochgeladen.");
    await fetchInvoices();
  } catch (error) {
    console.error(error);
    setStatus(`Rechnung hochladen fehlgeschlagen: ${error.message}`);
  }
}

function openInvoice(inline) {
  if (!invoiceSelect || !invoiceSelect.value) {
    setStatus("Bitte eine Rechnung auswählen.");
    return;
  }
  const id = encodeURIComponent(invoiceSelect.value);
  const url = inline
    ? `api/invoice_download.php?id=${id}&inline=1`
    : `api/invoice_download.php?id=${id}`;
  window.open(url, "_blank", "noopener");
}

if (refreshInvoicesButton) {
  refreshInvoicesButton.addEventListener("click", fetchInvoices);
}

if (invoiceInput) {
  invoiceInput.addEventListener("change", uploadInvoice);
}

if (invoiceSelect) {
  invoiceSelect.addEventListener("change", () => {
    hasUserSelectedInvoice = true;
    updateInvoiceActionsState();
    updateInvoicePreview();
  });
}

if (viewInvoiceButton) {
  viewInvoiceButton.addEventListener("click", () => openInvoice(true));
}

if (downloadInvoiceButton) {
  downloadInvoiceButton.addEventListener("click", () => openInvoice(false));
}

if (deleteInvoiceButton) {
  deleteInvoiceButton.addEventListener("click", async () => {
    if (!invoiceSelect || !invoiceSelect.value) {
      setStatus("Bitte eine Rechnung auswählen.");
      return;
    }
    const selected = invoices.find((invoice) => String(invoice.id) === invoiceSelect.value);
    const name = selected?.original_name ? ` "${selected.original_name}"` : "";
    if (!window.confirm(`Rechnung${name} wirklich löschen?`)) {
      return;
    }
    try {
      const response = await fetch("api/invoice_delete.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceSelect.value }),
      });
      const result = await readJsonResponse(response);
      if (!result.ok || result.data.status !== "ok") {
        throw new Error(result.data.message || "Delete failed");
      }
      setStatus("Rechnung gelöscht.");
      const deletedId = invoiceSelect.value;
      invoices = invoices.filter((invoice) => String(invoice.id) !== deletedId);
      invoiceSelect.value = "";
      hasUserSelectedInvoice = false;
      updateInvoiceList();
      updateInvoicePreview();
      await fetchInvoices();
    } catch (error) {
      console.error(error);
      setStatus(`Rechnung löschen fehlgeschlagen: ${error.message}`);
    }
  });
}

if (invoiceSearchInput) {
  invoiceSearchInput.addEventListener("input", updateInvoiceList);
}

if (invoiceSheetSelect) {
  invoiceSheetSelect.addEventListener("change", () => {
    hasUserSelectedInvoice = false;
    updateInvoiceList();
    updateInvoicePreview();
  });
}


function debounce(callback, delay) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => callback(...args), delay);
  };
}

function getSelectedRange() {
  if (!selectionStart || !selectionEnd) {
    return null;
  }
  return {
    rowMin: Math.min(selectionStart.rowIndex, selectionEnd.rowIndex),
    rowMax: Math.max(selectionStart.rowIndex, selectionEnd.rowIndex),
    colMin: Math.min(selectionStart.colIndex, selectionEnd.colIndex),
    colMax: Math.max(selectionStart.colIndex, selectionEnd.colIndex),
  };
}

function buildSelectedText() {
  const range = getSelectedRange();
  if (!range) {
    return "";
  }
  const lines = [];
  for (let rowIndex = range.rowMin; rowIndex <= range.rowMax; rowIndex += 1) {
    if (!tbody.rows[rowIndex]) {
      continue;
    }
    const rowValues = [];
    for (let col = range.colMin; col <= range.colMax; col += 1) {
      const cell = findCell(rowIndex, col);
      rowValues.push(cell && cell.dataset.kind !== "blank" ? getCellValue(cell) : "");
    }
    lines.push(rowValues.join("\t"));
  }
  return lines.join("\n");
}

function parseClipboardGrid(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = normalized.split("\n");
  if (rows.length && rows[rows.length - 1] === "") {
    rows.pop();
  }
  return rows.map((row) => row.split("\t"));
}

function applyPasteGrid(startCoords, grid) {
  if (!startCoords || !grid.length) {
    return false;
  }
  let didChange = false;
  grid.forEach((cells, rowOffset) => {
    cells.forEach((value, colOffset) => {
      const cell = findCell(startCoords.rowIndex + rowOffset, startCoords.colIndex + colOffset);
      if (!cell || !EDITABLE_KINDS.has(cell.dataset.kind)) {
        return;
      }
      setCellValue(cell, sanitizeByKind(cell.dataset.kind, String(value).trim()));
      didChange = true;
    });
  });
  return didChange;
}

let copyBufferEl = null;
function ensureCopyBuffer() {
  if (copyBufferEl) {
    return copyBufferEl;
  }
  const textarea = document.createElement("textarea");
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  copyBufferEl = textarea;
  return textarea;
}

async function saveNow() {
  setStatus("Auto-Speichern...");
  try {
    const response = await fetch("api/save.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const result = await readJsonResponse(response);
    if (result.ok && result.data.status === "ok") {
      setLastSaved(result.data.updated_at);
      setStatus("Auto-gespeichert.");
      return true;
    }
    const message = result.data?.message || "Unbekannter Fehler";
    setStatus(`Auto-Speichern fehlgeschlagen: ${message}`);
    return false;
  } catch (error) {
    console.error(error);
    setStatus("Auto-Speichern fehlgeschlagen.");
    return false;
  }
}

const autosave = debounce(() => {
  void saveNow();
}, 2000);

function handleTableInput(event) {
  if (isActiveSheetLocked()) {
    event.preventDefault();
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  const td = target?.closest("td[data-kind]");
  if (td) {
    sanitizeCell(td);
  }
  updateTotals();
  autosave();
}

function moveFocusDown(td) {
  if (thead.contains(td)) {
    // Preis/Druck: zur nächsten bearbeitbaren Zelle derselben Spalte im Kopf, sonst erste Datenzeile
    const col = td.dataset.col;
    let tr = td.parentElement?.nextElementSibling;
    while (tr) {
      const next = tr.querySelector(`td[data-col="${col}"]`);
      const el = next ? editableElement(next) : null;
      if (el?.isContentEditable) {
        el.focus();
        placeCaretAtEnd(el);
        return;
      }
      tr = tr.nextElementSibling;
    }
    if (!focusCell(0, Number(col))) {
      editableElement(td).blur();
    }
    return;
  }
  const coords = getCellCoords(td);
  if (!coords) {
    return;
  }
  if (!focusCell(coords.rowIndex + 1, coords.colIndex)) {
    editableElement(td).blur();
  }
}

table.addEventListener("beforeinput", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }
  const isLineBreak = event.inputType === "insertParagraph" || event.inputType === "insertLineBreak";
  const headerText = target.closest(".header-text");
  if (headerText) {
    if (isLineBreak) {
      event.preventDefault();
      headerText.blur();
    }
    return;
  }
  const td = target.closest("td[data-kind]");
  if (!td) {
    return;
  }
  if (isLineBreak) {
    event.preventDefault();
    moveFocusDown(td);
    return;
  }
  const kind = td.dataset.kind;
  if ((kind === "qty" || kind === "price" || kind === "print") && event.inputType.startsWith("insert") && typeof event.data === "string") {
    const allowed = kind === "qty" ? /^\d*$/ : /^[\d.,]*$/;
    if (!allowed.test(event.data)) {
      event.preventDefault();
      setStatus(kind === "qty" ? "Bei Anzahl sind nur ganze Zahlen erlaubt." : "Beim Preis sind nur Zahlen erlaubt.");
    }
  }
});

table.addEventListener("keydown", (event) => {
  // Fallback für Browser ohne beforeinput bei Enter
  if (event.key !== "Enter" || event.isComposing) {
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  const headerText = target?.closest(".header-text");
  if (headerText) {
    event.preventDefault();
    headerText.blur();
    return;
  }
  const td = target?.closest("td[data-kind]");
  if (td) {
    event.preventDefault();
    moveFocusDown(td);
  }
});

table.addEventListener("input", handleTableInput);
table.addEventListener("blur", (event) => {
  if (isActiveSheetLocked()) {
    event.preventDefault();
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  const headerText = target?.closest(".header-text");
  if (headerText) {
    const th = headerText.closest("th.article-header");
    if (!headerText.textContent.trim()) {
      headerText.textContent = `Artikel ${Number(th?.dataset.article ?? 0) + 1}`;
    }
  }
  autosave();
}, true);

table.addEventListener("focusin", (event) => {
  setCurrentFromElement(event.target);
  const target = event.target instanceof Element ? event.target : null;
  if (target?.classList.contains("header-text") && target.isContentEditable) {
    // Ganzen Namen markieren, damit er direkt überschrieben werden kann.
    // Bei Maus/Touch passiert das im click-Handler (nach dem Setzen des Cursors).
    headerJustFocused = target;
    selectAllIn(target);
  }
});

table.addEventListener("pointerup", (event) => {
  const target = event.target instanceof Element ? event.target.closest(".header-text") : null;
  if (target && target === headerJustFocused && document.activeElement === target) {
    selectAllIn(target);
  }
  headerJustFocused = null;
});

table.addEventListener("click", (event) => {
  if (Date.now() < suppressClickUntil) {
    return;
  }
  setCurrentFromElement(event.target);
  const target = event.target instanceof Element ? event.target : null;
  // Klick auf den Rand einer Namenszelle soll trotzdem ins Textfeld springen
  const nameCell = target?.closest("td.name-cell, td.print-label-cell");
  if (nameCell && !target.closest(".cell-text") && !target.closest(".row-drag-indicator, .print-remove")) {
    const text = nameCell.querySelector(".cell-text");
    if (text?.isContentEditable) {
      text.focus();
      placeCaretAtEnd(text);
    }
  }
  const articleHeader = target?.closest("th.article-header");
  if (articleHeader && !target.closest(".header-text, .drag-indicator, .col-resize-handle")) {
    const text = articleHeader.querySelector(".header-text");
    if (text?.isContentEditable && document.activeElement !== text) {
      text.focus();
      selectAllIn(text);
    }
  }
});

table.addEventListener("contextmenu", (event) => {
  const target = event.target instanceof HTMLElement ? event.target : event.target?.parentElement;
  const cell = target?.closest("td");
  if (!cell || cell.classList.contains("sum-cell")) {
    return;
  }
  if (tbody.querySelector("td.cell-selected")) {
    const buffer = ensureCopyBuffer();
    buffer.value = buildSelectedText() || " ";
    buffer.focus();
    buffer.select();
  }
});

table.addEventListener("paste", (event) => {
  if (isActiveSheetLocked()) {
    event.preventDefault();
    setStatus("Tabellenblatt ist abgeschlossen.");
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : event.target?.parentElement;
  if (target?.closest(".header-text")) {
    event.preventDefault();
    const text = (event.clipboardData?.getData("text/plain") || "").replace(/\s+/g, " ").trim();
    document.execCommand("insertText", false, text);
    return;
  }
  const text = event.clipboardData?.getData("text/plain");
  if (!text) {
    return;
  }
  const targetCell = target?.closest("td");
  const coords = targetCell ? getCellCoords(targetCell) : selectionStart;
  if (!coords) {
    return;
  }
  event.preventDefault();
  const grid = parseClipboardGrid(text);
  if (applyPasteGrid(coords, grid)) {
    updateTotals();
    autosave();
    setStatus("Eingefügt.");
  }
});

table.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || isCoarsePointer) {
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : event.target?.parentElement;
  if (target?.closest(".row-drag-indicator, .drag-indicator, .col-resize-handle")) {
    return;
  }
  const cell = target?.closest("td");
  if (!cell || cell.classList.contains("sum-cell")) {
    return;
  }
  const coords = getCellCoords(cell);
  if (!coords) {
    return;
  }
  clearCellSelection();
  selectionStart = coords;
  selectionEnd = coords;
  isSelectingCells = true;
  hasDragSelection = false;
});

table.addEventListener("mouseover", (event) => {
  if (!isSelectingCells) {
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : event.target?.parentElement;
  const cell = target?.closest("td");
  if (!cell || cell.classList.contains("sum-cell")) {
    return;
  }
  const coords = getCellCoords(cell);
  if (!coords) {
    return;
  }
  if (
    selectionEnd
    && selectionEnd.rowIndex === coords.rowIndex
    && selectionEnd.colIndex === coords.colIndex
  ) {
    return;
  }
  selectionEnd = coords;
  if (!hasDragSelection) {
    hasDragSelection = true;
    document.body.classList.add("no-select");
    window.getSelection()?.removeAllRanges();
  }
  applyCellSelection(selectionStart, selectionEnd);
  event.preventDefault();
});

document.addEventListener("mouseup", () => {
  if (!isSelectingCells) {
    document.body.classList.remove("no-select");
    return;
  }
  if (!hasDragSelection) {
    clearCellSelection();
  }
  isSelectingCells = false;
  document.body.classList.remove("no-select");
});

document.addEventListener("copy", (event) => {
  if (!tbody.querySelector("td.cell-selected")) {
    return;
  }
  const text = buildSelectedText();
  if (!text) {
    return;
  }
  event.clipboardData.setData("text/plain", text);
  event.preventDefault();
});

async function autoload() {
  try {
    const response = await fetch("api/load.php");
    const result = await readJsonResponse(response);
    if (!result.ok || result.data.status !== "ok") {
      return;
    }
    if (Array.isArray(result.data.sheets) && result.data.sheets.length) {
      sheets = result.data.sheets.map((sheet) => ({
        ...sheet,
        locked: Boolean(sheet.locked),
        data: normalizeSheetData(sheet.data || []),
      }));
      activeSheetIndex = showLockedSheets ? 0 : firstUnlockedIndex();
      buildTable(sheets[activeSheetIndex].data);
      renderTabs();
      setLastSaved(result.data.updated_at);
      setStatus("Daten geladen.");
    }
  } catch (error) {
    console.error(error);
  }
}

sheets = [{ name: "Sheet 1", data: createEmptyData(), locked: false }];
activeSheetIndex = 0;
buildTable(sheets[0].data);
renderTabs();
autoload();
fetchInvoices();
