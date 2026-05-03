<?php
// ═══════════════════════════════════════════════════════════════
//  index.php — Front Controller
//  Roteia /auth, /transactions, /workspaces para seus controllers
// ═══════════════════════════════════════════════════════════════

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/utils/helpers.php';

set_cors_headers();

// Extrai o primeiro segmento do path
$path     = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$segments = explode('/', $path);
$route    = $segments[0] ?? '';

// Remove o prefixo se rodar em subdiretório (ex: /api/auth → auth)
$base = trim($_ENV['API_BASE_PATH'] ?? '', '/');
if ($base && str_starts_with($route, $base)) {
    $route = $segments[1] ?? '';
}

match ($route) {
    'auth'         => require __DIR__ . '/auth/index.php',
    'transactions' => require __DIR__ . '/transactions/index.php',
    'workspaces'   => require __DIR__ . '/workspaces/index.php',
    'health'       => respond(['status' => 'ok', 'env' => APP_ENV]),
    default        => respond_error('Rota não encontrada.', 404),
};
