<?php
// proxy.php

// CORS-Header (anpassen nach Bedarf)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: *");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Parameter "url" muss vorhanden sein
if (!isset($_GET['url'])) {
    header("HTTP/1.1 400 Bad Request");
    echo "Fehler: Parameter 'url' fehlt.";
    exit;
}

// Basis-URL extrahieren
$target = $_GET['url'];

// Sicherheit: Erlaube nur Aufrufe an DWD
$allowedPrefix = "https://maps.dwd.de/geoserver/dwd/wms";
if (substr($target, 0, strlen($allowedPrefix)) !== $allowedPrefix) {
    header("HTTP/1.1 403 Forbidden");
    echo "Zugriff verweigert: '$target' nicht erlaubt.";
    exit;
}

// Zusätzliche GET-Parameter anfügen, falls vorhanden (außer 'url')
$params = $_GET;
unset($params['url']);
if (!empty($params)) {
    $sep = (strpos($target, '?') === false) ? '?' : '&';
    $target .= $sep . http_build_query($params);
}

// cURL-Abfrage
$ch = curl_init($target);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

// NEU: Erzwinge HTTP/1.1 statt HTTP/2
curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);

// Für Testzwecke (nicht in Produktion!)
// curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
// curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

$response = curl_exec($ch);
$info = curl_getinfo($ch);
$httpCode = $info['http_code'];
$contentType = isset($info['content_type']) ? $info['content_type'] : null;
curl_close($ch);

// Weitergabe HTTP-Status
http_response_code($httpCode);

// Weitergabe Content-Type
if ($contentType) {
    header("Content-Type: $contentType");
}

// Ausgabe
echo $response;
