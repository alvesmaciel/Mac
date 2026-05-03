<?php
// ═══════════════════════════════════════════════════════════════
//  SupabaseClient.php — wrapper para a API REST do Supabase
// ═══════════════════════════════════════════════════════════════

require_once __DIR__ . '/../config/config.php';

class SupabaseClient
{
    private string $url;
    private string $anonKey;
    private string $serviceKey;

    public function __construct()
    {
        $this->url        = rtrim(SUPABASE_URL, '/');
        $this->anonKey    = SUPABASE_ANON_KEY;
        $this->serviceKey = SUPABASE_SERVICE_KEY;
    }

    // ── Auth endpoints (usa anon key + JWT do usuário) ───────────

    public function signUp(string $email, string $password, array $meta = []): array
    {
        return $this->request('POST', '/auth/v1/signup', [
            'email'    => $email,
            'password' => $password,
            'data'     => $meta,
        ], useServiceKey: false);
    }

    public function signIn(string $email, string $password): array
    {
        return $this->request('POST', '/auth/v1/token?grant_type=password', [
            'email'    => $email,
            'password' => $password,
        ], useServiceKey: false);
    }

    public function signInWithOAuth(string $provider): array
    {
        // Retorna a URL para redirecionar o usuário
        return [
            'url' => "{$this->url}/auth/v1/authorize?provider={$provider}"
                   . "&redirect_to=" . urlencode(FRONTEND_URL . '/auth/callback'),
        ];
    }

    public function refreshToken(string $refreshToken): array
    {
        return $this->request('POST', '/auth/v1/token?grant_type=refresh_token', [
            'refresh_token' => $refreshToken,
        ], useServiceKey: false);
    }

    public function signOut(string $accessToken): array
    {
        return $this->request('POST', '/auth/v1/logout', [], userToken: $accessToken);
    }

    public function getUser(string $accessToken): array
    {
        return $this->request('GET', '/auth/v1/user', [], userToken: $accessToken);
    }

    // ── PostgREST (tabelas) ───────────────────────────────────────

    /**
     * SELECT
     * @param string $table   nome da tabela
     * @param string $select  colunas (padrão: *)
     * @param array  $filters ex: ['user_id' => 'eq.uuid', 'type' => 'eq.expense']
     * @param array  $options ['order' => 'created_at.desc', 'limit' => 50]
     */
    public function select(
        string $table,
        string $select = '*',
        array  $filters = [],
        array  $options = [],
        string $userToken = ''
    ): array {
        $query = ['select' => $select];

        foreach ($filters as $col => $value) {
            $query[$col] = $value;
        }

        if (isset($options['order'])) $query['order'] = $options['order'];
        if (isset($options['limit'])) $query['limit'] = $options['limit'];
        if (isset($options['offset'])) $query['offset'] = $options['offset'];

        $qs = http_build_query($query);
        return $this->request('GET', "/rest/v1/{$table}?{$qs}", [], userToken: $userToken);
    }

    /** INSERT — retorna o registro criado */
    public function insert(string $table, array $data, string $userToken = ''): array
    {
        return $this->request(
            'POST',
            "/rest/v1/{$table}",
            $data,
            userToken: $userToken,
            extraHeaders: ['Prefer' => 'return=representation']
        );
    }

    /** UPDATE por filtros */
    public function update(string $table, array $data, array $filters, string $userToken = ''): array
    {
        $qs = http_build_query($filters);
        return $this->request(
            'PATCH',
            "/rest/v1/{$table}?{$qs}",
            $data,
            userToken: $userToken,
            extraHeaders: ['Prefer' => 'return=representation']
        );
    }

    /** DELETE por filtros */
    public function delete(string $table, array $filters, string $userToken = ''): array
    {
        $qs = http_build_query($filters);
        return $this->request(
            'DELETE',
            "/rest/v1/{$table}?{$qs}",
            [],
            userToken: $userToken,
            extraHeaders: ['Prefer' => 'return=representation']
        );
    }

    // ── HTTP core ────────────────────────────────────────────────

    private function request(
        string $method,
        string $path,
        array  $body = [],
        bool   $useServiceKey = true,
        string $userToken = '',
        array  $extraHeaders = []
    ): array {
        $apiKey = $useServiceKey ? $this->serviceKey : $this->anonKey;

        $headers = [
            'Content-Type: application/json',
            'apikey: ' . $apiKey,
        ];

        // Prioridade: token do usuário > service key > anon key
        if ($userToken) {
            $headers[] = 'Authorization: Bearer ' . $userToken;
        } else {
            $headers[] = 'Authorization: Bearer ' . $apiKey;
        }

        foreach ($extraHeaders as $k => $v) {
            $headers[] = "{$k}: {$v}";
        }

        $ch = curl_init($this->url . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_TIMEOUT        => 10,
        ]);

        if (in_array($method, ['POST', 'PATCH', 'PUT']) && !empty($body)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }

        $raw      = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['error' => 'Falha de conexão: ' . $error, 'status' => 0];
        }

        $decoded = json_decode($raw, true) ?? [];

        // Supabase retorna erro como objeto com chave "error" ou "message"
        if ($httpCode >= 400) {
            return [
                'error'  => $decoded['error_description'] ?? $decoded['message'] ?? 'Erro desconhecido',
                'status' => $httpCode,
            ];
        }

        return ['data' => $decoded, 'status' => $httpCode];
    }
}
