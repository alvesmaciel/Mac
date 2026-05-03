<?php
// ═══════════════════════════════════════════════════════════════
//  helpers.php — funções utilitárias do backend
// ═══════════════════════════════════════════════════════════════

// ── Resposta JSON padronizada ────────────────────────────────────

function respond(mixed $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode(['data' => $data, 'status' => $status]);
    exit;
}

function respond_error(string $message, int $status = 400): never
{
    http_response_code($status);
    echo json_encode(['error' => $message, 'status' => $status]);
    exit;
}

// ── CORS ─────────────────────────────────────────────────────────

function set_cors_headers(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    $allowed = [
        FRONTEND_URL,
        'http://localhost:5500',
        'http://127.0.0.1:5500',
    ];

    if (in_array($origin, $allowed)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400');
    header('Content-Type: application/json; charset=UTF-8');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ── Leitura do body JSON ──────────────────────────────────────────

function get_json_body(): array
{
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// ── Extração do Bearer token ──────────────────────────────────────

function get_bearer_token(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        return trim($m[1]);
    }
    return '';
}

// ── Validação simples de campos ───────────────────────────────────

function require_fields(array $data, array $fields): void
{
    foreach ($fields as $field) {
        if (empty($data[$field]) && $data[$field] !== 0) {
            respond_error("Campo obrigatório ausente: {$field}", 422);
        }
    }
}

// ── Sanitização básica ────────────────────────────────────────────

function sanitize_string(string $value, int $max = 255): string
{
    return mb_substr(trim(strip_tags($value)), 0, $max);
}

function sanitize_float(mixed $value): float
{
    return round((float) str_replace(',', '.', (string) $value), 2);
}
