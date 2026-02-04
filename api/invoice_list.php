<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/bootstrap.php';

if (!class_exists('SQLite3')) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'SQLite extension not available']);
    exit;
}

$dbPath = __DIR__ . '/data.sqlite';

try {
    $db = new SQLite3($dbPath, SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE);
    $db->enableExceptions(true);
    $db->exec('CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sheet_name TEXT,
        original_name TEXT,
        stored_name TEXT,
        uploaded_at TEXT
    )');

    $result = $db->query('SELECT id, sheet_name, original_name, uploaded_at FROM invoices ORDER BY uploaded_at DESC');
    $invoices = [];
    while ($result && ($row = $result->fetchArray(SQLITE3_ASSOC))) {
        $invoices[] = $row;
    }
    $db->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log('invoice_list.php error: ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Database read failed']);
    exit;
}

echo json_encode(['status' => 'ok', 'invoices' => $invoices]);
