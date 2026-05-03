<?php
// ═══════════════════════════════════════════════════════════════
//  transactions/index.php — CRUD de transações
//
//  GET    /transactions?workspace_id=&type=&limit=&offset=  → listar
//  POST   /transactions                                      → criar
//  PATCH  /transactions?id=                                  → atualizar
//  DELETE /transactions?id=                                  → excluir
//  GET    /transactions?action=totals&workspace_id=          → totais KPI
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

// ── Tipos e categorias válidos ───────────────────────────────────
const VALID_TYPES = ['income', 'expense', 'debt', 'receivable'];

match (true) {

    // ── GET totals ───────────────────────────────────────────────
    $method === 'GET' && $action === 'totals' => (function () use ($auth, $client) {
        $workspace_id = sanitize_string($_GET['workspace_id'] ?? '');
        if (!$workspace_id) respond_error('workspace_id obrigatório.', 422);

        $result = $client->select(
            'transactions',
            'type, value',
            [
                'workspace_id' => 'eq.' . $workspace_id,
                'user_id'      => 'eq.' . $auth['user_id'],
            ],
            userToken: $auth['token']
        );

        if (isset($result['error'])) respond_error($result['error'], 400);

        $totals = ['income' => 0, 'expense' => 0, 'debt' => 0, 'receivable' => 0];

        foreach ($result['data'] as $tx) {
            $totals[$tx['type']] = round($totals[$tx['type']] + (float) $tx['value'], 2);
        }

        respond([
            'income'      => $totals['income'],
            'expenses'    => $totals['expense'],
            'debts'       => $totals['debt'],
            'receivables' => $totals['receivable'],
            'balance'     => round($totals['income'] - $totals['expense'], 2),
        ]);
    })(),

    // ── GET list ─────────────────────────────────────────────────
    $method === 'GET' => (function () use ($auth, $client) {
        $workspace_id = sanitize_string($_GET['workspace_id'] ?? '');
        if (!$workspace_id) respond_error('workspace_id obrigatório.', 422);

        $filters = [
            'workspace_id' => 'eq.' . $workspace_id,
            'user_id'      => 'eq.' . $auth['user_id'],
        ];

        if (!empty($_GET['type']) && in_array($_GET['type'], VALID_TYPES)) {
            $filters['type'] = 'eq.' . $_GET['type'];
        }

        if (!empty($_GET['category'])) {
            $filters['category'] = 'eq.' . sanitize_string($_GET['category']);
        }

        if (!empty($_GET['from'])) {
            $filters['transaction_date'] = 'gte.' . sanitize_string($_GET['from'], 10);
        }

        if (!empty($_GET['to'])) {
            $filters['transaction_date'] = 'lte.' . sanitize_string($_GET['to'], 10);
        }

        $options = [
            'order'  => 'transaction_date.desc,created_at.desc',
            'limit'  => min((int) ($_GET['limit'] ?? 100), 500),
            'offset' => (int) ($_GET['offset'] ?? 0),
        ];

        $result = $client->select(
            'transactions',
            'id, type, value, category, description, raw, transaction_date, is_recurring, recurring_rule_id, created_at, updated_at',
            $filters,
            $options,
            $auth['token']
        );

        if (isset($result['error'])) respond_error($result['error'], 400);

        respond($result['data']);
    })(),

    // ── POST create ──────────────────────────────────────────────
    $method === 'POST' => (function () use ($auth, $client) {
        $body = get_json_body();
        require_fields($body, ['workspace_id', 'type', 'value']);

        if (!in_array($body['type'], VALID_TYPES)) {
            respond_error('Tipo inválido. Use: income, expense, debt ou receivable.', 422);
        }

        $value = sanitize_float($body['value']);
        if ($value <= 0) {
            respond_error('O valor deve ser maior que zero.', 422);
        }

        $payload = [
            'workspace_id'     => sanitize_string($body['workspace_id']),
            'user_id'          => $auth['user_id'],
            'type'             => $body['type'],
            'value'            => $value,
            'category'         => sanitize_string($body['category'] ?? 'Geral', 100),
            'description'      => sanitize_string($body['description'] ?? '-', 500),
            'raw'              => sanitize_string($body['raw'] ?? '', 500),
            'transaction_date' => sanitize_string($body['transaction_date'] ?? date('Y-m-d'), 10),
            'is_recurring'     => (bool) ($body['is_recurring'] ?? false),
            'recurring_rule_id'=> !empty($body['recurring_rule_id'])
                                    ? sanitize_string($body['recurring_rule_id'])
                                    : null,
        ];

        $result = $client->insert('transactions', $payload, $auth['token']);

        if (isset($result['error'])) respond_error($result['error'], 400);

        respond($result['data'][0] ?? $result['data'], 201);
    })(),

    // ── PATCH update ─────────────────────────────────────────────
    $method === 'PATCH' => (function () use ($auth, $client) {
        $id = sanitize_string($_GET['id'] ?? '');
        if (!$id) respond_error('id da transação obrigatório.', 422);

        $body    = get_json_body();
        $allowed = ['type', 'value', 'category', 'description', 'raw', 'transaction_date', 'is_recurring'];
        $payload = [];

        foreach ($allowed as $field) {
            if (!array_key_exists($field, $body)) continue;

            $payload[$field] = match ($field) {
                'type'         => in_array($body[$field], VALID_TYPES) ? $body[$field] : respond_error('Tipo inválido.', 422),
                'value'        => sanitize_float($body[$field]),
                'is_recurring' => (bool) $body[$field],
                default        => sanitize_string((string) $body[$field], 500),
            };
        }

        if (empty($payload)) respond_error('Nenhum campo válido para atualizar.', 422);

        $result = $client->update(
            'transactions',
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
        if (!$id) respond_error('id da transação obrigatório.', 422);

        $result = $client->delete(
            'transactions',
            ['id' => 'eq.' . $id, 'user_id' => 'eq.' . $auth['user_id']],
            $auth['token']
        );

        if (isset($result['error'])) respond_error($result['error'], 400);

        respond(['message' => 'Transação excluída.']);
    })(),

    default => respond_error('Método não suportado.', 405),
};
