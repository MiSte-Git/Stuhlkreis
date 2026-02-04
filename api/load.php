<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/bootstrap.php';

if (!class_exists('SQLite3')) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'SQLite extension not available']);
    exit;
}

$dbPath = __DIR__ . '/data.sqlite';
if (!file_exists($dbPath)) {
    echo json_encode(['status' => 'ok', 'sheets' => []]);
    exit;
}

try {
    $db = new SQLite3($dbPath, SQLITE3_OPEN_READWRITE);
    $db->enableExceptions(true);
    $db->exec('CREATE TABLE IF NOT EXISTS saved_sheets (id INTEGER PRIMARY KEY, title TEXT, sheets_json TEXT, updated_at TEXT)');

    $result = $db->query('SELECT title, sheets_json, updated_at FROM saved_sheets WHERE id = 1');
    $row = $result ? $result->fetchArray(SQLITE3_ASSOC) : null;
} catch (Throwable $e) {
    http_response_code(500);
    error_log('load.php error: ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Database read failed']);
    exit;
}

if (!$row) {
    echo json_encode(['status' => 'ok', 'sheets' => []]);
    $db->close();
    exit;
}

$sheets = json_decode($row['sheets_json'], true);
if (!is_array($sheets)) {
    $sheets = [];
}

echo json_encode([
    'status' => 'ok',
    'title' => $row['title'],
    'sheets' => $sheets,
    'updated_at' => $row['updated_at'],
]);

$db->close();
