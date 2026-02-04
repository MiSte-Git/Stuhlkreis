<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

$logPath = __DIR__ . '/php_error.log';
if (!is_file($logPath)) {
    @touch($logPath);
    @chmod($logPath, 0666);
}
if (!is_writable($logPath)) {
    $fallback = sys_get_temp_dir() . '/stuhlkreis_php_error.log';
    @touch($fallback);
    @chmod($fallback, 0666);
    if (is_writable($fallback)) {
        $logPath = $fallback;
    }
}

ini_set('log_errors', '1');
ini_set('error_log', $logPath);
