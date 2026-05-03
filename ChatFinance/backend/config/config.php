<?php
// ═══════════════════════════════════════════════════════════════
//  config.php — ChatFinance Backend
//  Variáveis de ambiente e constantes globais
// ═══════════════════════════════════════════════════════════════

// ── Carrega .env se existir (desenvolvimento local) ─────────────
if (file_exists(__DIR__ . '/../.env')) {
    $lines = file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value);
    }
}

// ── Supabase ─────────────────────────────────────────────────────
define('SUPABASE_URL',      $_ENV['SUPABASE_URL']      ?? '');
define('SUPABASE_ANON_KEY', $_ENV['SUPABASE_ANON_KEY'] ?? '');
define('SUPABASE_SERVICE_KEY', $_ENV['SUPABASE_SERVICE_KEY'] ?? '');  // para operações admin

// ── App ──────────────────────────────────────────────────────────
define('APP_ENV',    $_ENV['APP_ENV']    ?? 'production');
define('APP_SECRET', $_ENV['APP_SECRET'] ?? '');          // para assinar cookies/tokens internos
define('FRONTEND_URL', $_ENV['FRONTEND_URL'] ?? 'https://seu-site.netlify.app');

// ── Helpers de ambiente ──────────────────────────────────────────
function is_dev(): bool {
    return APP_ENV === 'development';
}
