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

if (!isset($_FILES['invoice']) || !is_uploaded_file($_FILES['invoice']['tmp_name'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'No PDF uploaded']);
    exit;
}

$file = $_FILES['invoice'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Upload failed']);
    exit;
}

$originalName = (string)$file['name'];
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if ($extension !== 'pdf') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Only PDF files are allowed']);
    exit;
}

$uploadsDir = __DIR__ . '/invoices';
if (!is_dir($uploadsDir) && !mkdir($uploadsDir, 0775, true)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Upload folder missing']);
    exit;
}
if (!is_writable($uploadsDir)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Upload folder not writable']);
    exit;
}

try {
    $storedName = bin2hex(random_bytes(16)) . '.pdf';
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Could not generate filename']);
    exit;
}

$targetPath = $uploadsDir . '/' . $storedName;
if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to save file']);
    exit;
}

$sheetName = isset($_POST['sheet_name']) ? trim((string)$_POST['sheet_name']) : '';
$uploadedAt = gmdate('c');

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

    $stmt = $db->prepare('INSERT INTO invoices (sheet_name, original_name, stored_name, uploaded_at)
        VALUES (:sheet_name, :original_name, :stored_name, :uploaded_at)');
    $stmt->bindValue(':sheet_name', $sheetName, SQLITE3_TEXT);
    $stmt->bindValue(':original_name', $originalName, SQLITE3_TEXT);
    $stmt->bindValue(':stored_name', $storedName, SQLITE3_TEXT);
    $stmt->bindValue(':uploaded_at', $uploadedAt, SQLITE3_TEXT);
    $stmt->execute();
    $stmt->close();
    $db->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log('invoice_upload.php error: ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Database write failed']);
    exit;
}

echo json_encode(['status' => 'ok', 'uploaded_at' => $uploadedAt]);
