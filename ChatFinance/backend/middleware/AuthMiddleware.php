<?php
// ═══════════════════════════════════════════════════════════════
//  AuthMiddleware.php — valida o JWT do Supabase em toda rota protegida
// ═══════════════════════════════════════════════════════════════

require_once __DIR__ . '/../config/SupabaseClient.php';
require_once __DIR__ . '/../utils/helpers.php';

class AuthMiddleware
{
    /**
     * Valida o token e retorna os dados do usuário.
     * Se inválido, responde 401 e encerra a execução.
     */
    public static function requireAuth(): array
    {
        $token = get_bearer_token();

        if (empty($token)) {
            respond_error('Token de autenticação ausente.', 401);
        }

        $client   = new SupabaseClient();
        $response = $client->getUser($token);

        if (isset($response['error']) || empty($response['data']['id'])) {
            respond_error('Token inválido ou expirado.', 401);
        }

        // Retorna o payload do usuário autenticado
        return [
            'user_id' => $response['data']['id'],
            'email'   => $response['data']['email'] ?? '',
            'token'   => $token,
        ];
    }
}
