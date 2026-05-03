/**
 * Storage Manager - Abstrai localStorage com versionamento
 * Facilita migração futura para IndexedDB/DB
 */

export class StorageManager {
    constructor(namespace = 'autofinance') {
        this.namespace = namespace;
        this.version = '1.0';
    }

    /**
     * Salva dados com namespace e timestamp
     */
    set(key, value) {
        try {
            const data = {
                version: this.version,
                timestamp: Date.now(),
                value: value,
            };
            const fullKey = `${this.namespace}:${key}`;
            localStorage.setItem(fullKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error(`[Storage] Erro ao salvar ${key}:`, error);
            return false;
        }
    }

    /**
     * Recupera dados pelo key
     */
    get(key) {
        try {
            const fullKey = `${this.namespace}:${key}`;
            const item = localStorage.getItem(fullKey);
            if (!item) return null;

            const data = JSON.parse(item);
            return data.value;
        } catch (error) {
            console.error(`[Storage] Erro ao recuperar ${key}:`, error);
            return null;
        }
    }

    /**
     * Remove um item
     */
    remove(key) {
        try {
            const fullKey = `${this.namespace}:${key}`;
            localStorage.removeItem(fullKey);
            return true;
        } catch (error) {
            console.error(`[Storage] Erro ao remover ${key}:`, error);
            return false;
        }
    }

    /**
     * Limpa todos os dados do namespace
     */
    clear() {
        try {
            const keys = Object.keys(localStorage);
            const prefix = `${this.namespace}:`;
            keys.forEach(key => {
                if (key.startsWith(prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('[Storage] Erro ao limpar:', error);
            return false;
        }
    }

    /**
     * Lista todas as chaves do namespace
     */
    keys() {
        const allKeys = Object.keys(localStorage);
        const prefix = `${this.namespace}:`;
        return allKeys
            .filter(k => k.startsWith(prefix))
            .map(k => k.substring(prefix.length));
    }

    /**
     * Retorna objeto com todos os dados
     */
    getAll() {
        const result = {};
        this.keys().forEach(key => {
            result[key] = this.get(key);
        });
        return result;
    }

    /**
     * Salva múltiplos itens
     */
    setMultiple(obj) {
        Object.entries(obj).forEach(([key, value]) => {
            this.set(key, value);
        });
    }

    /**
     * Retorna metadados (timestamp de última modificação)
     */
    getMetadata(key) {
        try {
            const fullKey = `${this.namespace}:${key}`;
            const item = localStorage.getItem(fullKey);
            if (!item) return null;

            const data = JSON.parse(item);
            return {
                version: data.version,
                timestamp: data.timestamp,
                lastModified: new Date(data.timestamp).toLocaleString('pt-BR'),
            };
        } catch (error) {
            return null;
        }
    }
}

// Instância global
export const appStorage = new StorageManager('autofinance');
