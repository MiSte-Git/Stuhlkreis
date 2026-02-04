<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/bootstrap.php';

if (!class_exists('SQLite3')) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'SQLite extension not available']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data) || empty($data['id'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid request']);
    exit;
}

$id = (int)$data['id'];
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid invoice id']);
    exit;
}

$dbPath = __DIR__ . '/data.sqlite';
$uploadsDir = __DIR__ . '/invoices';

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
    $stmt = $db->prepare('SELECT stored_name FROM invoices WHERE id = :id');
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $row = $result ? $result->fetchArray(SQLITE3_ASSOC) : null;
    if ($result) {
        $result->finalize();
    }
    $stmt->close();

    if (!$row) {
        $db->close();
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Invoice not found']);
        exit;
    }

    $stmt = $db->prepare('DELETE FROM invoices WHERE id = :id');
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    $stmt->close();
    $db->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log('invoice_delete.php error: ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Database delete failed']);
    exit;
}

$storedName = basename($row['stored_name']);
$filePath = $uploadsDir . '/' . $storedName;
if (is_file($filePath)) {
    @unlink($filePath);
}

echo json_encode(['status' => 'ok']);
