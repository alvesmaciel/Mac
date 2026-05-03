<?php
// ═══════════════════════════════════════════════════════════════
//  workspaces/index.php — CRUD de workspaces
//
//  GET    /workspaces          → listar todos do usuário
//  POST   /workspaces          → criar novo
//  PATCH  /workspaces?id=      → renomear / trocar ícone
//  DELETE /workspaces?id=      → excluir (não permite padrão)
//  PATCH  /workspaces?action=set_default&id=  → definir como padrão
// ═══════════════════════════════════════════════════════════════

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/SupabaseClient.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../utils/helpers.php';

set_cors_headers();

$auth   = AuthMiddleware::requireAuth();
$client = new SupabaseClient();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

match (true) {

    // ── GET list ─────────────────────────────────────────────────
    $method === 'GET' => (function () use ($auth, $client) {
        $result = $client->select(
            'workspaces',
            'id, name, icon, is_default, created_at',
            ['user_id' => 'eq.' . $auth['user_id']],
            ['order' => 'created_at.asc'],
            $auth['token']
        );

        if (isset($result['error'])) respond_error($result['error'], 400);

        respond($result['data']);
    })(),

    // ── POST create ──────────────────────────────────────────────
    $method === 'POST' => (function () use ($auth, $client) {
        $body = get_json_body();
        require_fields($body, ['name']);

        $name = sanitize_string($body['name'], 50);
        if (strlen($name) < 1) respond_error('O nome não pode estar vazio.', 422);

        $payload = [
            'user_id'    => $auth['user_id'],
            'name'       => $name,
            'icon'       => sanitize_string($body['icon'] ?? '📁', 10),
            'is_default' => false,
        ];

        $result = $client->insert('workspaces', $payload, $auth['token']);

        if (isset($result['error'])) respond_error($result['error'], 400);

        respond($result['data'][0] ?? $result['data'], 201);
    })(),

    // ── PATCH set_default ────────────────────────────────────────
    $method === 'PATCH' && $action === 'set_default' => (function () use ($auth, $client) {
        $id = sanitize_string($_GET['id'] ?? '');
        if (!$id) respond_error('id obrigatório.', 422);

        // Remove padrão atual
        $client->update(
            'workspaces',
            ['is_default' => false],
            ['user_id' => 'eq.' . $auth['user_id'], 'is_default' => 'eq.true'],
            $auth['token']
        );

        // Define novo padrão
        $result = $client->update(
            'workspaces',
            ['is_default' => true],
            ['id' => 'eq.' . $id, 'user_id' => 'eq.' . $auth['user_id']],
            $auth['token']
        );

        if (isset($result['error'])) respond_error($result['error'], 400);

        respond(['message' => 'Workspace padrão atualizado.']);
    })(),

    // ── PATCH rename/icon ────────────────────────────────────────
    $method === 'PATCH' => (function () use ($auth, $client) {
        $id = sanitize_string($_GET['id'] ?? '');
        if (!$id) respond_error('id obrigatório.', 422);

        $body    = get_json_body();
        $payload = [];

        if (!empty($body['name'])) {
            $payload['name'] = sanitize_string($body['name'], 50);
        }
        if (!empty($body['icon'])) {
            $payload['icon'] = sanitize_string($body['icon'], 10);
        }
        if (empty($payload)) respond_error('Nenhum campo válido.', 422);

        $result = $client->update(
            'workspaces',
            $payload,
            ['id' => 'eq.' . $id, 'user_id' => 'eq.' . $auth['user_id']],
            $auth['token']
        );

        if (isset($result['error'])) respond_error($result['error'], 400);

        respond($result['data'][0] ?? []);
    })(),

    // ── DELETE ───────────────────────────────────────────────────
    $method === 'DELETE' => (function () use ($auth, $client) {
        $id = sanitize_string($_GET['id'] ?? '');
        if (!$id) respond_error('id obrigatório.', 422);

        // Verifica se é o workspace padrão
        $check = $client->select(
            'workspaces',
            'is_default',
            ['id' => 'eq.' . $id, 'user_id' => 'eq.' . $auth['user_id']],
            userToken: $auth['token']
        );

        if (empty($check['data'][0])) {
            respond_error('Workspace não encontrado.', 404);
        }

        if ($check['data'][0]['is_default']) {
            respond_error('O workspace padrão não pode ser excluído.', 403);
        }

        $result = $client->delete(
            'workspaces',
            ['id' => 'eq.' . $id, 'user_id' => 'eq.' . $auth['user_id']],
            $auth['token']
        );

        if (isset($result['error'])) respond_error($result['error'], 400);

        respond(['message' => 'Workspace excluído.']);
    })(),

    default => respond_error('Método não suportado.', 405),
};
