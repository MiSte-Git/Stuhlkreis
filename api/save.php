<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/bootstrap.php';

if (!class_exists('SQLite3')) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'SQLite extension not available']);
    exit;
}

if (!is_writable(__DIR__)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'API folder is not writable']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data) || !isset($data['sheets'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid payload']);
    exit;
}

$title = isset($data['title']) ? (string)$data['title'] : 'Sheet';
$sheets = $data['sheets'];

if (!is_array($sheets)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Sheets must be an array']);
    exit;
}

$dbPath = __DIR__ . '/data.sqlite';

try {
    $db = new SQLite3($dbPath, SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE);
    $db->enableExceptions(true);
    $db->exec('CREATE TABLE IF NOT EXISTS saved_sheets (id INTEGER PRIMARY KEY, title TEXT, sheets_json TEXT, updated_at TEXT)');

    $sheetsJson = json_encode($sheets);
    $updatedAt = gmdate('c');

    $stmt = $db->prepare('INSERT INTO saved_sheets (id, title, sheets_json, updated_at) VALUES (1, :title, :sheets, :updated)
        ON CONFLICT(id) DO UPDATE SET title = :title, sheets_json = :sheets, updated_at = :updated');
    $stmt->bindValue(':title', $title, SQLITE3_TEXT);
    $stmt->bindValue(':sheets', $sheetsJson, SQLITE3_TEXT);
    $stmt->bindValue(':updated', $updatedAt, SQLITE3_TEXT);

    $result = $stmt->execute();
    $result->finalize();
    $stmt->close();
    $db->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log('save.php error: ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Database write failed']);
    exit;
}

echo json_encode(['status' => 'ok', 'updated_at' => $updatedAt]);
