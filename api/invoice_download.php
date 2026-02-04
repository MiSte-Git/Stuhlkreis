<?php
require_once __DIR__ . '/bootstrap.php';

if (!class_exists('SQLite3')) {
    http_response_code(500);
    echo 'SQLite extension not available';
    exit;
}

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo 'Invalid invoice id';
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
    $stmt = $db->prepare('SELECT original_name, stored_name FROM invoices WHERE id = :id');
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $row = $result ? $result->fetchArray(SQLITE3_ASSOC) : null;
    if ($result) {
        $result->finalize();
    }
    $stmt->close();
    $db->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log('invoice_download.php error: ' . $e->getMessage());
    echo 'Database read failed';
    exit;
}

if (!$row) {
    http_response_code(404);
    echo 'Invoice not found';
    exit;
}

$storedName = basename($row['stored_name']);
$filePath = $uploadsDir . '/' . $storedName;
if (!is_file($filePath)) {
    http_response_code(404);
    echo 'File missing';
    exit;
}

$originalName = (string)$row['original_name'];
$safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $originalName);
$disposition = (isset($_GET['inline']) && $_GET['inline'] === '1') ? 'inline' : 'attachment';

header('Content-Type: application/pdf');
header('Content-Length: ' . filesize($filePath));
header('Content-Disposition: ' . $disposition . '; filename="' . $safeName . '"');
header('X-Content-Type-Options: nosniff');

readfile($filePath);
