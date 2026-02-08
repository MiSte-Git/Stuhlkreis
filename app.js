const fileInput = document.getElementById("fileInput");
const downloadButton = document.getElementById("download");
const downloadPdfButton = document.getElementById("downloadPdf");
const printSheetButton = document.getElementById("printSheet");
const printSheetTabsButton = document.getElementById("printSheetTabs");
const copyPasteRowButton = document.getElementById("copyPasteRow");
const deleteSelectedRowButton = document.getElementById("deleteSelectedRow");
const pdfOrientationSelect = document.getElementById("pdfOrientation");
const newSheetButton = document.getElementById("newSheet");
const addRowButton = document.getElementById("addRow");
const addColButton = document.getElementById("addCol");
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
const printTitleEl = document.getElementById("printTitle");
const rowContextMenu = document.getElementById("rowContextMenu");
const contextCopyPasteRowButton = document.getElementById("contextCopyPasteRow");
const contextDeleteRowButton = document.getElementById("contextDeleteRow");
const contextMenuDividerRows = document.getElementById("contextMenuDividerRows");
const contextLinkSumsButton = document.getElementById("contextLinkSums");
const contextUnlinkSumsButton = document.getElementById("contextUnlinkSums");
const table = document.getElementById("sheetTable");
const thead = table.querySelector("thead");
const tbody = table.querySelector("tbody");
const tabsList = document.getElementById("sheetTabs");

const DEFAULT_HEADERS = [
  "Name",
  "Größe",
  "T-Shirt - Weiss/Schwarze Ärmel",
  "T-Shirt - Heather Grey",
  "Polo-Shirt - Heather Grey",
  "Hoodes Zip - Heather Grey",
];
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

const DEFAULT_SIZES = [
  "XXL",
  "L",
  "XL",
  "XL",
  "XL",
  "XL",
  "L",
  "XL",
  "XL",
  "L",
  "XL",
];

const DEFAULT_ROWS = DEFAULT_NAMES.length;
const DEFAULT_COLS = DEFAULT_HEADERS.length;
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
let copiedRowData = null;
let lastRowIndex = null;
let lastSumRowIndex = null;

function sanitizeFilename(value) {
  return value
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "_");
}

function buildFilename(extension) {
  const title = document.querySelector(".brand")?.textContent ?? "Sheet";
  const sheetNames = sheets.map((sheet) => sheet.name).join("_");
  const baseName = sanitizeFilename(`${title}_${sheetNames}`) || "Sheet";
  const clipped = baseName.slice(0, 140);
  return `${clipped}.${extension}`;
}

function normalizeExcelSheetName(name) {
  const cleaned = (name || "Sheet")
    .replace(/[\\/*?:\[\]]/g, "")
    .trim();
  return (cleaned || "Sheet").slice(0, 31);
}

function setStatus(message) {
  statusEl.textContent = message;
}

function getDataRows() {
  return Array.from(tbody.querySelectorAll("tr"))
    .filter((row) => !row.classList.contains("price-row"));
}

function setLastRowIndexFromCell(cell) {
  const row = cell?.closest("tr");
  if (!row || row.classList.contains("price-row")) {
    return;
  }
  const rows = getDataRows();
  const index = rows.indexOf(row);
  if (index !== -1) {
    lastRowIndex = index;
    if (cell?.classList.contains("sum-cell")) {
      lastSumRowIndex = index;
    }
  }
}

function extractRowData(row) {
  const cells = Array.from(row.querySelectorAll("td"))
    .filter((cell) => !cell.classList.contains("sum-cell"));
  return cells.map((cell) => {
    const indicator = cell.querySelector(".row-drag-indicator");
    if (!indicator) {
      return cell.textContent.trim();
    }
    const text = cell.textContent.replace(indicator.textContent, "");
    return text.trim();
  });
}

function copyRowAt(index) {
  const rows = getDataRows();
  const row = rows[index];
  if (!row) {
    setStatus("Keine Zeile ausgewählt.");
    return;
  }
  copiedRowData = extractRowData(row);
  setStatus("Zeile kopiert.");
}

function copyAndPasteRowBelow(index) {
  copyRowAt(index);
  if (!copiedRowData) {
    return;
  }
  pasteRowBelow(index);
}

function pasteRowBelow(index) {
  if (!ensureEditable()) {
    return;
  }
  if (!copiedRowData) {
    setStatus("Keine kopierte Zeile vorhanden.");
    return;
  }
  const rows = getDataRows();
  const insertAfter = rows[index] || rows[rows.length - 1];
  const sheet = sheets[activeSheetIndex];
  if (sheet) {
    shiftLinkedGroupsOnInsert(sheet, index);
  }
  const columnCount = thead.querySelectorAll("th:not([data-fixed])").length || DEFAULT_COLS;
  const values = Array.from({ length: columnCount }, (_, col) => copiedRowData[col] ?? "");
  const tr = document.createElement("tr");
  values.forEach((value) => {
    tr.appendChild(createBodyCell(value));
  });
  tr.appendChild(createSumCell());
  if (insertAfter?.parentNode) {
    insertAfter.parentNode.insertBefore(tr, insertAfter.nextSibling);
  } else {
    tbody.appendChild(tr);
  }
  setupRowInteractions();
  updateTotals();
  autosave();
  setStatus("Zeile eingefügt.");
}

function openRowContextMenu(x, y, options = {}) {
  if (!rowContextMenu) {
    return;
  }
  const showSumActions = options.showSumActions === true;
  const showRowActions = options.showRowActions !== false;
  const selectedRows = getSelectedSumRowIndexes();
  const canLink = Array.isArray(selectedRows) && selectedRows.length >= 2;
  const canUnlink = Array.isArray(selectedRows) ? selectedRows.length >= 1 : lastSumRowIndex !== null;
  if (contextCopyPasteRowButton) {
    contextCopyPasteRowButton.style.display = showRowActions ? "block" : "none";
  }
  if (contextDeleteRowButton) {
    contextDeleteRowButton.style.display = showRowActions ? "block" : "none";
  }
  if (contextMenuDividerRows) {
    contextMenuDividerRows.style.display = showRowActions && showSumActions ? "block" : "none";
  }
  if (contextLinkSumsButton) {
    contextLinkSumsButton.disabled = !canLink;
    contextLinkSumsButton.style.display = showSumActions ? "block" : "none";
  }
  if (contextUnlinkSumsButton) {
    contextUnlinkSumsButton.disabled = !canUnlink;
    contextUnlinkSumsButton.style.display = showSumActions ? "block" : "none";
  }
  const menuWidth = rowContextMenu.offsetWidth || 190;
  const menuHeight = rowContextMenu.offsetHeight || 120;
  const maxLeft = window.innerWidth - menuWidth - 8;
  const maxTop = window.innerHeight - menuHeight - 8;
  const nextLeft = Math.max(8, Math.min(x, maxLeft));
  const nextTop = Math.max(8, Math.min(y, maxTop));
  rowContextMenu.style.left = `${nextLeft}px`;
  rowContextMenu.style.top = `${nextTop}px`;
  rowContextMenu.classList.add("is-open");
  rowContextMenu.setAttribute("aria-hidden", "false");
}

function closeRowContextMenu() {
  if (!rowContextMenu) {
    return;
  }
  rowContextMenu.classList.remove("is-open");
  rowContextMenu.setAttribute("aria-hidden", "true");
}

function updatePrintTitle() {
  if (!printTitleEl) {
    return;
  }
  const brand = document.querySelector(".brand")?.textContent?.trim() || "Sheet";
  const sheetName = sheets[activeSheetIndex]?.name?.trim() || "Sheet";
  printTitleEl.textContent = `${brand} — ${sheetName}`;
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

  tbody.querySelectorAll("td").forEach((cell) => {
    if (cell.classList.contains("sum-cell")) {
      return;
    }
    cell.contentEditable = locked ? "false" : "true";
  });

  thead.querySelectorAll("th").forEach((th) => {
    if (th.dataset.fixed === "true") {
      return;
    }
    th.draggable = !locked;
    const indicator = th.querySelector(".drag-indicator");
    if (indicator) {
      indicator.draggable = !locked;
    }
    const handle = th.querySelector(".col-resize-handle");
    if (handle) {
      handle.style.pointerEvents = locked ? "none" : "auto";
    }
  });

  tbody.querySelectorAll("tr").forEach((row) => {
    if (row.classList.contains("price-row")) {
      return;
    }
    row.draggable = !locked;
    const indicator = row.querySelector(".row-drag-indicator");
    if (indicator) {
      indicator.draggable = !locked;
    }
  });

  setActionDisabled(addRowButton, locked);
  setActionDisabled(removeRowButton, locked);
  setActionDisabled(addColButton, locked);
  setActionDisabled(removeColButton, locked);
  setActionDisabled(removeSheetButton, locked);

  tabsList.querySelectorAll(".tab-name").forEach((tabName, index) => {
    tabName.contentEditable = (!locked && index === activeSheetIndex) ? "true" : "false";
  });

  if (toggleLockButton) {
    toggleLockButton.textContent = locked ? "Bestellung wieder öffnen" : "Bestellung abschließen";
    toggleLockButton.setAttribute(
      "aria-pressed",
      locked ? "true" : "false"
    );
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

function createBodyCell(value) {
  const cell = document.createElement("td");
  cell.contentEditable = "true";
  cell.textContent = value ?? "";
  return cell;
}

function createHeaderCell(value) {
  const cell = document.createElement("th");
  cell.contentEditable = "false";

  const indicator = document.createElement("span");
  indicator.className = "drag-indicator";
  indicator.textContent = "☞";
  indicator.contentEditable = "false";
  indicator.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "header-text";
  text.contentEditable = "true";
  text.textContent = value ?? "";

  const sortIndicator = document.createElement("span");
  sortIndicator.className = "sort-indicator";
  sortIndicator.setAttribute("aria-hidden", "true");

  cell.append(indicator, text, sortIndicator);
  return cell;
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
  const indicator = document.createElement("span");
  indicator.className = "sum-indicator";
  indicator.textContent = "Σ";
  indicator.setAttribute("aria-hidden", "true");
  cell.append(valueSpan, indicator);
  return cell;
}

function createPriceRow(cols) {
  const row = Array(cols).fill("");
  if (cols > 0) {
    row[0] = "Preis (€)";
  }
  return row;
}

function createEmptyData(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  const headers = cols === DEFAULT_COLS
    ? [...DEFAULT_HEADERS]
    : Array.from({ length: cols }, (_, i) => `Column ${i + 1}`);
  const priceRow = createPriceRow(cols);
  const dataRows = Array.from({ length: rows }, (_, rowIndex) => {
    const row = Array(cols).fill("");
    if (cols === DEFAULT_COLS && rowIndex < DEFAULT_NAMES.length) {
      row[0] = DEFAULT_NAMES[rowIndex];
    }
    if (cols === DEFAULT_COLS && rowIndex < DEFAULT_SIZES.length) {
      row[1] = DEFAULT_SIZES[rowIndex];
    }
    return row;
  });
  return [headers, priceRow, ...dataRows];
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

function normalizeSheetData(data) {
  if (!data.length) {
    return createEmptyData();
  }
  const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
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

function buildTable(data) {
  clearTable();
  clearCellSelection();
  selectionStart = null;
  selectionEnd = null;
  isSelectingCells = false;
  hasDragSelection = false;
  const normalized = normalizeSheetData(data);
  const maxCols = normalized.reduce((max, row) => Math.max(max, row.length), 0);
  const normalizedRows = normalized.map((row, idx) => {
    const rowValues = Array.from({ length: maxCols }, (_, col) => row[col] ?? "");
    if (idx === 0 && rowValues.every((value) => value === "")) {
      if (maxCols === DEFAULT_COLS) {
        return [...DEFAULT_HEADERS];
      }
      return rowValues.map((_, col) => `Column ${col + 1}`);
    }
    return rowValues;
  });

  const headerRow = document.createElement("tr");
  normalizedRows[0].forEach((value) => {
    headerRow.appendChild(createHeaderCell(value));
  });
  headerRow.appendChild(createFixedHeaderCell(SUM_HEADER));
  thead.appendChild(headerRow);
  setupHeaderInteractions();

  const priceRow = document.createElement("tr");
  priceRow.className = "price-row";
  normalizedRows[1].forEach((value) => {
    priceRow.appendChild(createBodyCell(value));
  });
  priceRow.appendChild(createSumCell());
  tbody.appendChild(priceRow);

  normalizedRows.slice(2).forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value) => {
      tr.appendChild(createBodyCell(value));
    });
    tr.appendChild(createSumCell());
    tbody.appendChild(tr);
  });

  if (!tbody.children.length) {
    const tr = document.createElement("tr");
    normalizedRows[0].forEach(() => {
      tr.appendChild(createBodyCell(""));
    });
    tr.appendChild(createSumCell());
    tbody.appendChild(tr);
  }
  setupRowInteractions();
  updateTotals();
  updateSortIndicators();
  applySheetLockState();
}

function setupHeaderInteractions() {
  const headerRow = thead.querySelector("tr");
  if (!headerRow) {
    return;
  }

  Array.from(headerRow.children).forEach((th) => {
    if (th.dataset.fixed === "true") {
      th.draggable = false;
      return;
    }
    th.draggable = true;
    th.classList.remove("col-dragging");
    let indicator = th.querySelector(".drag-indicator");
    if (!indicator) {
      indicator = document.createElement("span");
      indicator.className = "drag-indicator";
      indicator.textContent = "☞";
      indicator.contentEditable = "false";
      indicator.setAttribute("aria-hidden", "true");
      th.prepend(indicator);
    }
    if (indicator && !indicator.dataset.dragReady) {
      indicator.draggable = true;
      indicator.dataset.dragReady = "true";
      indicator.addEventListener("dragstart", (event) => {
        if (isActiveSheetLocked()) {
          event.preventDefault();
          return;
        }
        dragSourceIndex = Array.from(th.parentNode.children).indexOf(th);
        th.classList.add("col-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", "");
      });
      indicator.addEventListener("dragend", () => {
        dragSourceIndex = null;
        th.classList.remove("col-dragging");
      });
    }
    th.addEventListener("dragstart", (event) => {
      if (isActiveSheetLocked()) {
        event.preventDefault();
        return;
      }
      if (event.target.classList.contains("col-resize-handle")) {
        event.preventDefault();
        return;
      }
      if (event.target.classList.contains("header-text") && document.activeElement === event.target) {
        event.preventDefault();
        return;
      }
      dragSourceIndex = Array.from(th.parentNode.children).indexOf(th);
      th.classList.add("col-dragging");
      event.dataTransfer.effectAllowed = "move";
    });

    th.addEventListener("dragend", () => {
      dragSourceIndex = null;
      th.classList.remove("col-dragging");
    });

    th.addEventListener("click", (event) => {
      if (event.target.classList.contains("col-resize-handle")) {
        return;
      }
      if (event.target.classList.contains("header-text") && document.activeElement === event.target) {
        return;
      }
      const headerCells = Array.from(th.parentNode.children)
        .filter((cell) => cell.dataset.fixed !== "true");
      const dataIndex = headerCells.indexOf(th);
      if (dataIndex === -1) {
        return;
      }
      sortByColumn(dataIndex);
    });

    th.addEventListener("dragover", (event) => {
      if (isActiveSheetLocked()) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    th.addEventListener("drop", (event) => {
      event.preventDefault();
      if (isActiveSheetLocked()) {
        return;
      }
      const targetIndex = Array.from(th.parentNode.children).indexOf(th);
      if (dragSourceIndex === null || dragSourceIndex === targetIndex) {
        return;
      }
      swapColumns(dragSourceIndex, targetIndex);
      dragSourceIndex = null;
      renderTabs();
    });

    if (!th.querySelector(".col-resize-handle")) {
      const handle = document.createElement("span");
      handle.className = "col-resize-handle";
      handle.contentEditable = "false";
      handle.addEventListener("mousedown", (event) => {
        event.preventDefault();
        startResize(event, th);
      });
      th.appendChild(handle);
    }
  });
}

function setupRowInteractions() {
  const rows = getDataRows();
  rows.forEach((row) => {
    row.draggable = true;
    row.classList.remove("row-dragging");
    const firstCell = row.querySelector("td");
    let indicator = firstCell ? firstCell.querySelector(".row-drag-indicator") : null;
    if (firstCell && !indicator) {
      indicator = document.createElement("span");
      indicator.className = "row-drag-indicator";
      indicator.textContent = "☞";
      indicator.contentEditable = "false";
      indicator.setAttribute("aria-hidden", "true");
      firstCell.prepend(indicator);
    }
    if (indicator && !indicator.dataset.dragReady) {
      indicator.draggable = true;
      indicator.dataset.dragReady = "true";
      indicator.addEventListener("dragstart", (event) => {
        if (isActiveSheetLocked()) {
          event.preventDefault();
          return;
        }
        const currentRows = Array.from(tbody.querySelectorAll("tr"))
          .filter((tr) => !tr.classList.contains("price-row"));
        dragRowSourceIndex = currentRows.indexOf(row);
        row.classList.add("row-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", "");
      });
      indicator.addEventListener("dragend", () => {
        dragRowSourceIndex = null;
        row.classList.remove("row-dragging");
      });
    }

    row.addEventListener("dragstart", (event) => {
      if (isActiveSheetLocked()) {
        event.preventDefault();
        return;
      }
      if (!event.target.classList.contains("row-drag-indicator")) {
        event.preventDefault();
        return;
      }
      const currentRows = Array.from(tbody.querySelectorAll("tr"))
        .filter((tr) => !tr.classList.contains("price-row"));
      dragRowSourceIndex = currentRows.indexOf(row);
      row.classList.add("row-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "");
    });

    row.addEventListener("dragend", () => {
      dragRowSourceIndex = null;
      row.classList.remove("row-dragging");
    });

    row.addEventListener("dragover", (event) => {
      if (isActiveSheetLocked()) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    row.addEventListener("drop", (event) => {
      event.preventDefault();
      if (isActiveSheetLocked()) {
        return;
      }
      const currentRows = Array.from(tbody.querySelectorAll("tr"))
        .filter((tr) => !tr.classList.contains("price-row"));
      const targetIndex = currentRows.indexOf(row);
      if (dragRowSourceIndex === null || dragRowSourceIndex === targetIndex) {
        return;
      }
      moveRow(dragRowSourceIndex, targetIndex);
      dragRowSourceIndex = null;
      updateTotals();
    });
  });
}

function moveRow(fromIndex, toIndex) {
  if (isActiveSheetLocked()) {
    return;
  }
  const rows = getDataRows();
  const row = rows[fromIndex];
  const target = rows[toIndex];
  if (!row || !target) {
    return;
  }
  const sheet = sheets[activeSheetIndex];
  if (sheet) {
    shiftLinkedGroupsOnMove(sheet, fromIndex, toIndex);
  }
  if (fromIndex < toIndex) {
    tbody.insertBefore(row, target.nextSibling);
  } else {
    tbody.insertBefore(row, target);
  }
}

function swapColumns(fromIndex, toIndex) {
  if (isActiveSheetLocked()) {
    return;
  }
  const rows = table.querySelectorAll("tr");
  rows.forEach((row) => {
    const cells = Array.from(row.children);
    if (!cells[fromIndex] || !cells[toIndex]) {
      return;
    }
    [cells[fromIndex], cells[toIndex]] = [cells[toIndex], cells[fromIndex]];
    cells.forEach((cell) => row.appendChild(cell));
  });
  updateTotals();
}

function startResize(event, th) {
  const startX = event.clientX;
  const startWidth = th.offsetWidth;
  const columnIndex = Array.from(th.parentNode.children).indexOf(th);
  document.body.classList.add("no-select");

  function onMouseMove(moveEvent) {
    const delta = moveEvent.clientX - startX;
    const nextWidth = Math.max(80, startWidth + delta);
    setColumnWidth(columnIndex, nextWidth);
  }

  function onMouseUp() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.classList.remove("no-select");
  }

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function setColumnWidth(columnIndex, width) {
  table.querySelectorAll("tr").forEach((row) => {
    const cell = row.children[columnIndex];
    if (cell) {
      cell.style.width = `${width}px`;
      cell.style.minWidth = `${width}px`;
    }
  });
}

function collectTableData() {
  const headers = Array.from(thead.querySelectorAll("th"))
    .filter((cell) => cell.dataset.fixed !== "true")
    .map((cell) => {
      const text = cell.querySelector(".header-text");
      return text ? text.textContent.trim() : "";
    });
  const rows = Array.from(tbody.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("td"))
      .filter((cell) => !cell.classList.contains("sum-cell"))
      .map((cell) => {
        const indicator = cell.querySelector(".row-drag-indicator");
        if (!indicator) {
          return cell.textContent.trim();
        }
        const text = cell.textContent.replace(indicator.textContent, "");
        return text.trim();
      })
  );
  if (!headers.length) {
    return createEmptyData(0, DEFAULT_COLS);
  }
  return [headers, ...rows];
}

function updateTotals() {
  const priceRow = tbody.querySelector("tr.price-row");
  if (!priceRow) {
    return;
  }
  const dataRows = getDataRows();
  const priceCells = Array.from(priceRow.querySelectorAll("td"))
    .filter((cell) => !cell.classList.contains("sum-cell"));
  const prices = priceCells.map((cell) => parseNumberValue(cell.textContent));
  const hasAnyPrice = prices.some((value) => value !== null);
  let grandTotal = 0;
  const rowTotals = [];

  dataRows.forEach((row, index) => {
      const cells = Array.from(row.querySelectorAll("td"))
        .filter((cell) => !cell.classList.contains("sum-cell"));
      let rowTotal = 0;
      prices.forEach((price, index) => {
        if (price === null) {
          return;
        }
        const qty = parseNumberValue(cells[index]?.textContent ?? "");
        if (qty === null) {
          return;
        }
        rowTotal += price * qty;
      });
      rowTotals[index] = rowTotal;
      const sumCell = row.querySelector(".sum-cell");
      if (sumCell) {
        const sumValue = sumCell.querySelector(".sum-value");
        if (sumValue) {
          sumValue.textContent = hasAnyPrice ? formatCurrency(rowTotal) : "";
        }
        sumCell.classList.remove("linked-sum-target");
        sumCell.classList.remove("linked-sum-hidden");
      }
      grandTotal += rowTotal;
  });

  const linkedGroups = getLinkedSumGroups(sheets[activeSheetIndex]);
  linkedGroups.forEach((group) => {
    const rows = Array.isArray(group.rows) ? group.rows.filter((rowIndex) => rowIndex >= 0 && rowIndex < dataRows.length) : [];
    if (rows.length < 2) {
      return;
    }
    const targetIndex = Math.max(...rows);
    rows.forEach((rowIndex) => {
      if (rowIndex === targetIndex) {
        return;
      }
      const hiddenCell = dataRows[rowIndex]?.querySelector(".sum-cell");
      if (hiddenCell) {
        hiddenCell.classList.add("linked-sum-hidden");
      }
    });
    const sumCell = dataRows[targetIndex]?.querySelector(".sum-cell");
    if (!sumCell) {
      return;
    }
    const sumValue = sumCell.querySelector(".sum-value");
    const groupTotal = rows.reduce((acc, rowIndex) => acc + (rowTotals[rowIndex] || 0), 0);
    if (sumValue) {
      sumValue.textContent = hasAnyPrice ? formatCurrency(groupTotal) : "";
    }
    sumCell.classList.add("linked-sum-target");
  });

  if (grandTotalEl) {
    grandTotalEl.textContent = hasAnyPrice ? `Gesamtsumme: ${formatCurrency(grandTotal)}` : "";
  }
}

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

function renderTabs() {
  tabsList.innerHTML = "";
  sheets.forEach((sheet, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab";
    if (sheet.locked) {
      button.classList.add("is-locked");
      button.title = "Bestellung abgeschlossen";
    }
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", index === activeSheetIndex ? "true" : "false");

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = sheet.name;
    nameSpan.contentEditable = (index === activeSheetIndex && !sheet.locked) ? "true" : "false";
    nameSpan.addEventListener("blur", () => {
      if (index !== activeSheetIndex) {
        return;
      }
      if (sheet.locked) {
        nameSpan.textContent = sheet.name;
        return;
      }
      const updated = makeUniqueName(nameSpan.textContent, index);
      sheets[index].name = updated;
      nameSpan.textContent = updated;
      updateInvoiceSheetOptions();
      updatePrintTitle();
    });

    button.addEventListener("click", () => {
      setActiveSheet(index);
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
  });
  const addTabButton = document.createElement("button");
  addTabButton.type = "button";
  addTabButton.className = "tab tab-add";
  addTabButton.textContent = "+";
  addTabButton.title = "Neues Tabellenblatt";
  addTabButton.addEventListener("click", () => addSheet());
  tabsList.appendChild(addTabButton);
  updateInvoiceSheetOptions();
  updatePrintTitle();
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
  buildTable(sheets[activeSheetIndex].data);
  renderTabs();
  updateInvoiceSheetOptions();
  setStatus(`Added ${sheetName}`);
  autosave();
}

function addRow() {
  if (!ensureEditable()) {
    return;
  }
  const columnCount = thead.querySelectorAll("th:not([data-fixed])").length || DEFAULT_COLS;
  const tr = document.createElement("tr");
  for (let i = 0; i < columnCount; i += 1) {
    tr.appendChild(createBodyCell(""));
  }
  tr.appendChild(createSumCell());
  tbody.appendChild(tr);
  setupRowInteractions();
  updateTotals();
  setStatus("Zeile hinzugefügt.");
  autosave();
}

function addColumn() {
  if (!ensureEditable()) {
    return;
  }
  const headerRow = thead.querySelector("tr");
  if (!headerRow) {
    buildTable(createEmptyData());
    return;
  }

  const dataColumnCount = headerRow.querySelectorAll("th:not([data-fixed])").length;
  const newHeader = createHeaderCell(`Column ${dataColumnCount + 1}`);
  const sumHeader = headerRow.querySelector('th[data-fixed="true"]');
  headerRow.insertBefore(newHeader, sumHeader || null);
  setupHeaderInteractions();

  Array.from(tbody.querySelectorAll("tr")).forEach((row) => {
    const sumCell = row.querySelector(".sum-cell");
    row.insertBefore(createBodyCell(""), sumCell || null);
  });
  updateTotals();
  setStatus("Spalte hinzugefügt.");
  autosave();
}

function removeRowAt(index) {
  if (!ensureEditable()) {
    return;
  }
  const rows = getDataRows();
  if (rows.length <= 1) {
    setStatus("Mindestens eine Datenzeile muss bleiben.");
    return;
  }
  if (!window.confirm("Diese Zeile wirklich löschen?")) {
    return;
  }
  const target = rows[index];
  if (!target) {
    return;
  }
  const sheet = sheets[activeSheetIndex];
  if (sheet) {
    shiftLinkedGroupsOnRemove(sheet, index);
  }
  target.remove();
  updateTotals();
  setStatus("Zeile gelöscht.");
  autosave();
}

function removeRow() {
  const rows = getDataRows();
  removeRowAt(rows.length - 1);
}

function removeColumnAt(index) {
  if (!ensureEditable()) {
    return;
  }
  const headerRow = thead.querySelector("tr");
  if (!headerRow) {
    return;
  }
  const dataHeaders = Array.from(headerRow.querySelectorAll("th:not([data-fixed])"));
  if (dataHeaders.length <= 1) {
    setStatus("Mindestens eine Spalte muss bleiben.");
    return;
  }
  if (!window.confirm("Diese Spalte wirklich löschen?")) {
    return;
  }
  const targetHeader = dataHeaders[index];
  if (!targetHeader) {
    return;
  }
  headerRow.removeChild(targetHeader);
  Array.from(tbody.querySelectorAll("tr")).forEach((row) => {
    const cells = Array.from(row.querySelectorAll("td"))
      .filter((cell) => !cell.classList.contains("sum-cell"));
    if (cells[index]) {
      row.removeChild(cells[index]);
    }
  });
  updateTotals();
  setStatus("Spalte gelöscht.");
  autosave();
}

function removeColumn() {
  const headerRow = thead.querySelector("tr");
  if (!headerRow) {
    return;
  }
  const dataHeaders = Array.from(headerRow.querySelectorAll("th:not([data-fixed])"));
  removeColumnAt(dataHeaders.length - 1);
}

function removeSheet() {
  removeSheetAt(activeSheetIndex, "Aktuelles Tabellenblatt wirklich löschen?");
}

function tableHasData() {
  return thead.children.length > 0 && tbody.children.length > 0;
}

function getCellCoords(cell) {
  const row = cell.closest("tr");
  if (!row) {
    return null;
  }
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const rowIndex = rows.indexOf(row);
  if (rowIndex === -1) {
    return null;
  }
  const cells = Array.from(row.querySelectorAll("td"));
  const colIndex = cells.indexOf(cell);
  if (colIndex === -1) {
    return null;
  }
  return { rowIndex, colIndex };
}

function getSelectableCells(row) {
  return Array.from(row.querySelectorAll("td"));
}

function getSelectedSumRowIndexes() {
  const selected = Array.from(tbody.querySelectorAll("td.cell-selected"));
  if (!selected.length) {
    return [];
  }
  const rows = getDataRows();
  const rowIndexes = new Set();
  for (const cell of selected) {
    if (!cell.classList.contains("sum-cell")) {
      return null;
    }
    const row = cell.closest("tr");
    if (!row || row.classList.contains("price-row")) {
      return null;
    }
    const rowIndex = rows.indexOf(row);
    if (rowIndex === -1) {
      return null;
    }
    rowIndexes.add(rowIndex);
  }
  return Array.from(rowIndexes).sort((a, b) => a - b);
}

function getSortState(sheet) {
  if (!sheet) {
    return { columnIndex: null, direction: "asc" };
  }
  if (!sheet.sortState) {
    sheet.sortState = { columnIndex: null, direction: "asc" };
  }
  return sheet.sortState;
}

function updateSortIndicators() {
  const headerRow = thead.querySelector("tr");
  if (!headerRow) {
    return;
  }
  const sheet = sheets[activeSheetIndex];
  const sortState = getSortState(sheet);
  const dataHeaders = Array.from(headerRow.children)
    .filter((cell) => cell.dataset.fixed !== "true");
  dataHeaders.forEach((cell, index) => {
    const indicator = cell.querySelector(".sort-indicator");
    if (!indicator) {
      return;
    }
    if (sortState.columnIndex === index) {
      indicator.textContent = sortState.direction === "asc" ? "▲" : "▼";
      cell.setAttribute(
        "aria-sort",
        sortState.direction === "asc" ? "ascending" : "descending"
      );
      return;
    }
    indicator.textContent = "↕";
    cell.removeAttribute("aria-sort");
  });
}

function sortByColumn(columnIndex) {
  const sheet = sheets[activeSheetIndex];
  const rows = getDataRows();
  if (!rows.length) {
    return;
  }
  const sortState = getSortState(sheet);
  const direction = sortState.columnIndex === columnIndex && sortState.direction === "asc"
    ? "desc"
    : "asc";

  const rowData = rows.map((row, index) => {
    const cells = Array.from(row.querySelectorAll("td"))
      .filter((cell) => !cell.classList.contains("sum-cell"));
    const text = cells[columnIndex]?.textContent.trim() ?? "";
    const numericValue = parseNumberValue(text);
    return { row, index, text, numericValue };
  });

  const allNumeric = rowData.every((item) => item.numericValue !== null);
  rowData.sort((a, b) => {
    if (allNumeric) {
      const aVal = a.numericValue ?? Number.POSITIVE_INFINITY;
      const bVal = b.numericValue ?? Number.POSITIVE_INFINITY;
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }
    const aText = a.text.toLowerCase();
    const bText = b.text.toLowerCase();
    if (!aText && bText) {
      return 1;
    }
    if (!bText && aText) {
      return -1;
    }
    const compare = aText.localeCompare(bText, "de", { numeric: true, sensitivity: "base" });
    return direction === "asc" ? compare : -compare;
  });

  const fragment = document.createDocumentFragment();
  rowData.forEach((item) => fragment.appendChild(item.row));
  const priceRow = tbody.querySelector("tr.price-row");
  if (priceRow?.parentNode) {
    priceRow.parentNode.insertBefore(fragment, priceRow.nextSibling);
  } else {
    tbody.appendChild(fragment);
  }

  if (sheet) {
    const newIndexByOld = new Map();
    rowData.forEach((item, newIndex) => {
      newIndexByOld.set(item.index, newIndex);
    });
    const groups = getLinkedSumGroups(sheet);
    groups.forEach((group) => {
      if (!Array.isArray(group.rows)) {
        return;
      }
      group.rows = group.rows.map((rowIndex) =>
        newIndexByOld.has(rowIndex) ? newIndexByOld.get(rowIndex) : rowIndex
      );
    });
    normalizeLinkedSumGroups(sheet);
  }

  if (lastRowIndex !== null && sheet) {
    const newIndex = rowData.findIndex((item) => item.index === lastRowIndex);
    if (newIndex !== -1) {
      lastRowIndex = newIndex;
    }
  }
  if (lastSumRowIndex !== null && sheet) {
    const newIndex = rowData.findIndex((item) => item.index === lastSumRowIndex);
    if (newIndex !== -1) {
      lastSumRowIndex = newIndex;
    }
  }

  sheet.sortState = { columnIndex, direction };
  updateSortIndicators();
  updateTotals();
  autosave();
}

function getLinkedSumGroups(sheet) {
  if (!sheet) {
    return [];
  }
  if (!Array.isArray(sheet.linkedSumGroups)) {
    sheet.linkedSumGroups = [];
  }
  return sheet.linkedSumGroups;
}

function normalizeLinkedSumGroups(sheet) {
  const groups = getLinkedSumGroups(sheet);
  const normalized = groups
    .map((group) => ({
      rows: Array.isArray(group.rows)
        ? Array.from(new Set(group.rows.filter((row) => Number.isInteger(row))))
        : [],
    }))
    .map((group) => ({
      rows: group.rows.sort((a, b) => a - b),
    }))
    .filter((group) => group.rows.length >= 2);
  sheet.linkedSumGroups = normalized;
}

function shiftLinkedGroupsOnInsert(sheet, afterIndex) {
  const groups = getLinkedSumGroups(sheet);
  groups.forEach((group) => {
    if (!Array.isArray(group.rows)) {
      return;
    }
    group.rows = group.rows.map((rowIndex) =>
      rowIndex > afterIndex ? rowIndex + 1 : rowIndex
    );
  });
  normalizeLinkedSumGroups(sheet);
}

function shiftLinkedGroupsOnRemove(sheet, index) {
  const groups = getLinkedSumGroups(sheet);
  groups.forEach((group) => {
    if (!Array.isArray(group.rows)) {
      return;
    }
    group.rows = group.rows
      .filter((rowIndex) => rowIndex !== index)
      .map((rowIndex) => (rowIndex > index ? rowIndex - 1 : rowIndex));
  });
  normalizeLinkedSumGroups(sheet);
}

function shiftLinkedGroupsOnMove(sheet, fromIndex, toIndex) {
  if (fromIndex === toIndex) {
    return;
  }
  const groups = getLinkedSumGroups(sheet);
  groups.forEach((group) => {
    if (!Array.isArray(group.rows)) {
      return;
    }
    group.rows = group.rows.map((rowIndex) => {
      if (rowIndex === fromIndex) {
        return toIndex;
      }
      if (fromIndex < toIndex && rowIndex > fromIndex && rowIndex <= toIndex) {
        return rowIndex - 1;
      }
      if (toIndex < fromIndex && rowIndex >= toIndex && rowIndex < fromIndex) {
        return rowIndex + 1;
      }
      return rowIndex;
    });
  });
  normalizeLinkedSumGroups(sheet);
}

function linkSelectedSums() {
  const selectedRows = getSelectedSumRowIndexes();
  if (!selectedRows || selectedRows.length < 2) {
    setStatus("Bitte mehrere Summen-Zellen markieren.");
    return;
  }
  const sheet = sheets[activeSheetIndex];
  const groups = getLinkedSumGroups(sheet);
  const next = groups.filter((group) =>
    !group.rows?.some((rowIndex) => selectedRows.includes(rowIndex))
  );
  next.push({ rows: selectedRows });
  sheet.linkedSumGroups = next;
  updateTotals();
  autosave();
  setStatus("Summen verknüpft.");
}

function unlinkSelectedSums() {
  const sheet = sheets[activeSheetIndex];
  const groups = getLinkedSumGroups(sheet);
  if (!groups.length) {
    setStatus("Keine Verknüpfung vorhanden.");
    return;
  }
  const selectedRows = getSelectedSumRowIndexes();
  const targets = selectedRows && selectedRows.length ? selectedRows : (lastSumRowIndex !== null ? [lastSumRowIndex] : []);
  if (!targets.length) {
    setStatus("Bitte Summen-Zelle auswählen.");
    return;
  }
  const next = groups.filter((group) =>
    !group.rows?.some((rowIndex) => targets.includes(rowIndex))
  );
  if (next.length === groups.length) {
    setStatus("Keine Verknüpfung gefunden.");
    return;
  }
  sheet.linkedSumGroups = next;
  updateTotals();
  autosave();
  setStatus("Verknüpfung gelöst.");
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
  const rows = Array.from(tbody.querySelectorAll("tr"));

  rows.forEach((row, rowIndex) => {
    const cells = getSelectableCells(row);
    cells.forEach((cell, colIndex) => {
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

function downloadWorkbook() {
  saveActiveSheet();
  if (!sheets.length) {
    addSheet("Sheet 1");
  }

  if (typeof XLSX === "undefined" || !XLSX.utils) {
    setStatus("Excel-Bibliothek nicht geladen. Bitte Seite neu laden.");
    return;
  }

  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();
  sheets.forEach((sheet) => {
    const data = sheet.data.length ? normalizeSheetData(sheet.data) : createEmptyData();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    let sheetName = normalizeExcelSheetName(sheet.name);
    if (!sheetName) {
      sheetName = "Sheet";
    }
    let uniqueName = sheetName;
    let suffix = 1;
    while (usedNames.has(uniqueName)) {
      const base = sheetName.slice(0, Math.max(1, 31 - String(suffix).length - 1));
      uniqueName = `${base}_${suffix}`;
      suffix += 1;
    }
    usedNames.add(uniqueName);
    XLSX.utils.book_append_sheet(workbook, worksheet, uniqueName);
  });
  const filename = buildFilename("xlsx");
  if (typeof XLSX.write === "function") {
    const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    triggerDownload(blob, filename);
    setStatus(`Downloaded ${filename}`);
    return;
  }
  if (typeof XLSX.writeFile === "function") {
    XLSX.writeFile(workbook, filename);
    setStatus(`Downloaded ${filename}`);
    return;
  }
  setStatus("Excel-Bibliothek konnte nicht herunterladen.");
}

function downloadPDF() {
  saveActiveSheet();
  if (!sheets.length) {
    addSheet("Sheet 1");
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: pdfOrientationSelect.value,
    unit: "pt",
    format: "a4",
  });

  sheets.forEach((sheet, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const data = sheet.data.length ? normalizeSheetData(sheet.data) : createEmptyData();
    const [headerRow, ...bodyRows] = data;

    doc.setFontSize(14);
    doc.text(sheet.name, 40, 40);

    doc.autoTable({
      startY: 60,
      head: [headerRow],
      body: bodyRows,
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [195, 76, 45],
        textColor: 255,
      },
      theme: "grid",
    });
  });

  const filename = buildFilename("pdf");
  doc.save(filename);
  setStatus(`Downloaded ${filename}`);
}

async function handleFile(file) {
  if (!file) {
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    sheets = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true });
      return {
        name: sheetName,
        data: normalizeSheetData(data),
        locked: false,
        linkedSumGroups: [],
      };
    });

    if (!sheets.length) {
      sheets = [{ name: "Sheet 1", data: createEmptyData(), locked: false }];
    }

    activeSheetIndex = 0;
    buildTable(sheets[0].data);
    renderTabs();
    setStatus(`Loaded ${file.name} (${sheets.length} sheets)`);
  } catch (error) {
    console.error(error);
    setStatus("Could not read file. Please try another .xlsx file.");
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

if (copyPasteRowButton) {
  copyPasteRowButton.addEventListener("click", () => {
    if (lastRowIndex === null) {
      setStatus("Bitte zuerst eine Zeile anklicken.");
      return;
    }
    copyAndPasteRowBelow(lastRowIndex);
  });
}

if (deleteSelectedRowButton) {
  deleteSelectedRowButton.addEventListener("click", () => {
    if (lastRowIndex === null) {
      setStatus("Bitte zuerst eine Zeile anklicken.");
      return;
    }
    removeRowAt(lastRowIndex);
  });
}

removeRowButton.addEventListener("click", () => {
  removeRow();
});

addColButton.addEventListener("click", () => {
  addColumn();
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

function handlePrintClick() {
  updatePrintTitle();
  window.print();
}

if (printSheetButton) {
  printSheetButton.addEventListener("click", handlePrintClick);
}

if (printSheetTabsButton) {
  printSheetTabsButton.addEventListener("click", handlePrintClick);
}

if (contextCopyPasteRowButton) {
  contextCopyPasteRowButton.addEventListener("click", () => {
    closeRowContextMenu();
    if (lastRowIndex === null) {
      setStatus("Keine Zeile ausgewählt.");
      return;
    }
    copyAndPasteRowBelow(lastRowIndex);
  });
}

if (contextDeleteRowButton) {
  contextDeleteRowButton.addEventListener("click", () => {
    closeRowContextMenu();
    if (lastRowIndex === null) {
      setStatus("Keine Zeile ausgewählt.");
      return;
    }
    removeRowAt(lastRowIndex);
  });
}

if (contextLinkSumsButton) {
  contextLinkSumsButton.addEventListener("click", () => {
    closeRowContextMenu();
    linkSelectedSums();
  });
}

if (contextUnlinkSumsButton) {
  contextUnlinkSumsButton.addEventListener("click", () => {
    closeRowContextMenu();
    unlinkSelectedSums();
  });
}

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
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const lines = [];
  for (let rowIndex = range.rowMin; rowIndex <= range.rowMax; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) {
      continue;
    }
    const cells = getSelectableCells(row);
    const rowValues = [];
    for (let colIndex = range.colMin; colIndex <= range.colMax; colIndex += 1) {
      const cell = cells[colIndex];
      rowValues.push(cell ? cell.textContent.trim() : "");
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
  const rows = Array.from(tbody.querySelectorAll("tr"));
  let didChange = false;
  grid.forEach((cells, rowOffset) => {
    const row = rows[startCoords.rowIndex + rowOffset];
    if (!row) {
      return;
    }
    const rowCells = getSelectableCells(row);
    cells.forEach((value, colOffset) => {
      const cell = rowCells[startCoords.colIndex + colOffset];
      if (!cell || cell.classList.contains("sum-cell")) {
        return;
      }
      cell.textContent = value;
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
  updateTotals();
  autosave();
}

table.addEventListener("input", handleTableInput);
table.addEventListener("blur", (event) => {
  if (isActiveSheetLocked()) {
    event.preventDefault();
    return;
  }
  autosave();
}, true);
table.addEventListener("contextmenu", (event) => {
  const target = event.target instanceof HTMLElement ? event.target : event.target?.parentElement;
  const cell = target?.closest("td");
  if (!cell) {
    return;
  }
  setLastRowIndexFromCell(cell);
  const selectedSumRows = getSelectedSumRowIndexes();
  if (tbody.querySelector("td.cell-selected") && selectedSumRows === null) {
    const buffer = ensureCopyBuffer();
    buffer.value = buildSelectedText() || " ";
    buffer.focus();
    buffer.select();
    return;
  }
  event.preventDefault();
  if (rowContextMenu) {
    const showSumActions = cell.classList.contains("sum-cell");
    const showRowActions = !cell.classList.contains("sum-cell");
    openRowContextMenu(event.clientX, event.clientY, { showSumActions, showRowActions });
    return;
  }
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(cell);
  selection.removeAllRanges();
  selection.addRange(range);
});
table.addEventListener("paste", (event) => {
  if (isActiveSheetLocked()) {
    event.preventDefault();
    setStatus("Tabellenblatt ist abgeschlossen.");
    return;
  }
  const text = event.clipboardData?.getData("text/plain");
  if (!text) {
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : event.target?.parentElement;
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
  if (event.button !== 0) {
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : event.target?.parentElement;
  const cell = target?.closest("td");
  if (!cell) {
    return;
  }
  setLastRowIndexFromCell(cell);
  const coords = getCellCoords(cell);
  if (!coords) {
    return;
  }
  document.body.classList.add("no-select");
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
  if (!cell) {
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
  hasDragSelection = true;
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

document.addEventListener("click", (event) => {
  if (!rowContextMenu || !rowContextMenu.classList.contains("is-open")) {
    return;
  }
  if (event.target instanceof Node && rowContextMenu.contains(event.target)) {
    return;
  }
  closeRowContextMenu();
});

document.addEventListener("scroll", () => {
  closeRowContextMenu();
}, true);

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
        linkedSumGroups: Array.isArray(sheet.linkedSumGroups) ? sheet.linkedSumGroups : [],
      }));
      activeSheetIndex = 0;
      buildTable(sheets[0].data);
      renderTabs();
      setLastSaved(result.data.updated_at);
      setStatus("Daten geladen.");
    }
  } catch (error) {
    console.error(error);
  }
}

sheets = [{
  name: "Sheet 1",
  data: createEmptyData(),
  locked: false,
  linkedSumGroups: [],
}];
activeSheetIndex = 0;
buildTable(sheets[0].data);
renderTabs();
autoload();
fetchInvoices();
