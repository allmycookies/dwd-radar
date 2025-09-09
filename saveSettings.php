<?php
// saveSettings.php

header("Content-Type: text/plain; charset=utf-8");

// JSON aus POST
$raw = file_get_contents("php://input");
if (!$raw) {
    http_response_code(400);
    echo "Keine Daten empfangen.";
    exit;
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo "Ungültiges JSON.";
    exit;
}

// Versuch, settings.json zu schreiben
$filePath = __DIR__ . "/settings.json";
if (file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
    echo "OK – Einstellungen gespeichert.";
} else {
    http_response_code(500);
    echo "Fehler: Konnte settings.json nicht schreiben.";
}
