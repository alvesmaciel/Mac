<?php
// ═══════════════════════════════════════════════════════════════
//  auth/index.php — rotas de autenticação
//
//  POST /auth/register   → cadastro
//  POST /auth/login      → login email+senha
//  GET  /auth/oauth      → URL de redirect OAuth (Google)
//  POST /auth/refresh    → renovar access token
//  POST /auth/logout     → encerrar sessão
//  GET  /auth/me         → dados do usuário autenticado
// ═══════════════════════════════════════════════════════════════

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/SupabaseClient.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../utils/helpers.php';

set_cors_headers();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$client = new SupabaseClient();

match (true) {

    // ── POST /auth?action=register ───────────────────────────────
    $method === 'POST' && $action === 'register' => (function () use ($client) {
        $body = get_json_body();
        require_fields($body, ['email', 'password', 'name']);

        $email    = sanitize_string($body['email'], 254);
        $password = $body['password'];
        $name     = sanitize_string($body['name'], 100);

        if (strlen($password) < 6) {
            respond_error('A senha deve ter pelo menos 6 caracteres.', 422);
        }

        $result = $client->signUp($email, $password, ['full_name' => $name]);

        if (isset($result['error'])) {
            respond_error($result['error'], 400);
        }

        respond([
            'message' => 'Cadastro realizado. Verifique seu e-mail.',
            'user'    => $result['data']['user'] ?? null,
        ], 201);
    })(),

    // ── POST /auth?action=login ──────────────────────────────────
    $method === 'POST' && $action === 'login' => (function () use ($client) {
        $body = get_json_body();
        require_fields($body, ['email', 'password']);

        $result = $client->signIn(
            sanitize_string($body['email'], 254),
            $body['password']
        );

        if (isset($result['error'])) {
            respond_error('E-mail ou senha incorretos.', 401);
        }

        $data = $result['data'];

        respond([
            'access_token'  => $data['access_token'],
            'refresh_token' => $data['refresh_token'],
            'expires_in'    => $data['expires_in'],
            'user'          => [
                'id'    => $data['user']['id'],
                'email' => $data['user']['email'],
                'name'  => $data['user']['user_metadata']['full_name'] ?? '',
            ],
        ]);
    })(),

    // ── GET /auth?action=oauth&provider=google ────────────────────
    $method === 'GET' && $action === 'oauth' => (function () use ($client) {
        $provider = sanitize_string($_GET['provider'] ?? 'google', 20);
        $result   = $client->signInWithOAuth($provider);
        respond(['redirect_url' => $result['url']]);
    })(),

    // ── POST /auth?action=refresh ────────────────────────────────
    $method === 'POST' && $action === 'refresh' => (function () use ($client) {
        $body = get_json_body();
        require_fields($body, ['refresh_token']);

        $result = $client->refreshToken($body['refresh_token']);

        if (isset($result['error'])) {
            respond_error('Não foi possível renovar a sessão.', 401);
        }

        $data = $result['data'];
        respond([
            'access_token'  => $data['access_token'],
            'refresh_token' => $data['refresh_token'],
            'expires_in'    => $data['expires_in'],
        ]);
    })(),

    // ── POST /auth?action=logout ─────────────────────────────────
    $method === 'POST' && $action === 'logout' => (function () use ($client) {
        $token  = get_bearer_token();
        $client->signOut($token);
        respond(['message' => 'Sessão encerrada.']);
    })(),

    // ── GET /auth?action=me ──────────────────────────────────────
    $method === 'GET' && $action === 'me' => (function () use ($client) {
        $auth   = AuthMiddleware::requireAuth();
        $result = $client->select(
            'profiles',
            'id, name, avatar_url, plan, created_at',
            ['id' => 'eq.' . $auth['user_id']],
            userToken: $auth['token']
        );

        if (isset($result['error']) || empty($result['data'][0])) {
            respond_error('Perfil não encontrado.', 404);
        }

        respond($result['data'][0]);
    })(),

    // ── Rota não encontrada ──────────────────────────────────────
    default => respond_error('Rota não encontrada.', 404),
};
