/**
 * Auto-Correction + Fallback Engine - Correção automática e fallback inteligente
 * Trata erros de entrada, ambigüidades e oferece correções
 */

import { appStorage } from '../../shared/storage.js';

export class AutoCorrection {
    constructor() {
        this.corrections = appStorage.get('userCorrections') || {};
        this.commonMistakes = this.initCommonMistakes();
    }

    /**
     * Inicializa erros comuns e suas correções
     */
    initCommonMistakes() {
        return {
            // Abreviações comuns
            'uber': 'Uber',
            'ifood': 'iFood',
            'spotify': 'Spotify',
            'netflix': 'Netflix',
            'mc': 'McDonald\'s',
            'bk': 'Burger King',
            'shopee': 'Shopee',
            'amazon': 'Amazon',

            // Erros de digitação comuns em português
            'alugel': 'aluguel',
            'eletricidade': 'energia',
            'gasolina': 'combustível',
            'supermercádo': 'supermercado',
            'restaurente': 'restaurante',
            'medicamento': 'remédio',
            'roupha': 'roupa',
            'sapáto': 'sapato',
        };
    }

    /**
     * Corrige texto automaticamente
     */
    correctText(text) {
        if (!text) return text;

        let corrected = text;

        // 1. Aplica correções de erros comuns
        Object.entries(this.commonMistakes).forEach(([mistake, correction]) => {
            const regex = new RegExp(`\\b${mistake}\\b`, 'gi');
            corrected = corrected.replace(regex, correction);
        });

        // 2. Aplica correções aprendidas do usuário
        Object.entries(this.corrections).forEach(([mistake, correction]) => {
            const regex = new RegExp(`\\b${mistake}\\b`, 'gi');
            corrected = corrected.replace(regex, correction);
        });

        // 3. Normaliza espaçamentos
        corrected = corrected.replace(/\s+/g, ' ').trim();

        // 4. Corrige pontuação
        corrected = this.fixPunctuation(corrected);

        return corrected;
    }

    /**
     * Corrige pontuação
     */
    fixPunctuation(text) {
        // Remove espaços antes de pontuação
        text = text.replace(/\s+([.!?,;:])/g, '$1');

        // Adiciona espaço depois de pontuação
        text = text.replace(/([.!?,;:])([a-zA-Z0-9])/g, '$1 $2');

        return text;
    }

    /**
     * Detecta possível erro e oferece correção
     */
    detectPossibleMistake(text) {
        const normalized = text.toLowerCase();

        // Busca possíveis erros
        for (const [mistake, correction] of Object.entries(this.commonMistakes)) {
            if (normalized.includes(mistake)) {
                return {
                    mistake,
                    correction,
                    confidence: 0.8,
                    type: 'known_mistake',
                };
            }
        }

        // Busca erros aprendidos
        for (const [mistake, correction] of Object.entries(this.corrections)) {
            if (normalized.includes(mistake)) {
                return {
                    mistake,
                    correction,
                    confidence: 0.9,
                    type: 'user_learned',
                };
            }
        }

        // Verifica typos simples
        const typo = this.detectTypo(text);
        if (typo) return typo;

        return null;
    }

    /**
     * Detecta typos usando Levenshtein
     */
    detectTypo(text) {
        const words = text.toLowerCase().split(/\s+/);
        const allWords = [...Object.keys(this.commonMistakes), ...Object.keys(this.corrections)];

        for (const word of words) {
            if (word.length < 3) continue;

            let bestMatch = null;
            let bestDistance = 2; // Máximo 2 caracteres de diferença

            for (const candidate of allWords) {
                const distance = this.levenshteinDistance(word, candidate);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = candidate;
                }
            }

            if (bestMatch) {
                const correction = this.commonMistakes[bestMatch] || this.corrections[bestMatch];
                return {
                    mistake: word,
                    correction,
                    confidence: 1 - (bestDistance / Math.max(word.length, bestMatch.length)),
                    type: 'typo',
                };
            }
        }

        return null;
    }

    /**
     * Distância de Levenshtein
     */
    levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    /**
     * Aprende correção do usuário
     */
    learnCorrection(mistake, correction) {
        this.corrections[mistake.toLowerCase()] = correction;
        this.save();
    }

    /**
     * Salva correções
     */
    save() {
        appStorage.set('userCorrections', this.corrections);
    }

    /**
     * Restaura correções
     */
    restore() {
        this.corrections = appStorage.get('userCorrections') || {};
    }
}

/**
 * Fallback Engine - Oferece alternativas inteligentes para inputs ambíguos
 */
export class FallbackEngine {
    constructor(store, parser) {
        this.store = store;
        this.parser = parser;
    }

    /**
     * Oferece fallbacks para uma entrada ambígua
     */
    generateFallbacks(input, parsed) {
        const fallbacks = [];

        // Fallback 1: Se não identificou valor, usa valores recentes
        if (parsed.type === 'no_value' || !parsed.value) {
            const recentValues = this.getRecentValues(parsed.intentType);
            recentValues.forEach((value, i) => {
                fallbacks.push({
                    type: 'recent_value',
                    text: `${parsed.raw} ${value}`,
                    value,
                    confidence: 0.7 - (i * 0.1),
                    reason: `Valor recente em ${parsed.intentType}`,
                });
            });
        }

        // Fallback 2: Se não identificou categoria, usa categorias frequentes
        if (!parsed.category || parsed.category === '-') {
            const frequentCategories = this.getFrequentCategories(parsed.type);
            frequentCategories.forEach((category, i) => {
                fallbacks.push({
                    type: 'frequent_category',
                    text: `${input} ${category}`,
                    category,
                    confidence: 0.75 - (i * 0.15),
                    reason: `Categoria frequente`,
                });
            });
        }

        // Fallback 3: Interpreta como comando se não entende
        if (parsed.type === 'unknown') {
            const commands = this.getSuggestedCommands(input);
            commands.forEach((cmd, i) => {
                fallbacks.push({
                    type: 'command_suggestion',
                    text: cmd.example,
                    command: cmd.command,
                    confidence: cmd.confidence,
                    reason: cmd.description,
                });
            });
        }

        // Fallback 4: Se tipo ambíguo, oferece alternativas
        if (parsed.type === 'expense' || parsed.type === 'income') {
            const alternative = parsed.type === 'expense' ? 'income' : 'expense';
            fallbacks.push({
                type: 'type_alternative',
                text: input.replace(/(gastei|recebi|comprei|ganhei)/, alternative === 'income' ? 'recebi' : 'gastei'),
                alternativeType: alternative,
                confidence: 0.5,
                reason: `Você quis dizer ${alternative}?`,
            });
        }

        return fallbacks.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    }

    /**
     * Retorna valores recentes para um tipo
     */
    getRecentValues(type) {
        if (!type) return [];

        const typeMap = {
            expense: 'expense',
            income: 'income',
            debt: 'debt',
        };

        const mappedType = typeMap[type];
        if (!mappedType) return [];

        return [...new Set(
            this.store.getAllTransactions()
                .filter(tx => tx.type === mappedType)
                .slice(-10)
                .map(tx => tx.value)
        )].slice(0, 3);
    }

    /**
     * Retorna categorias mais frequentes
     */
    getFrequentCategories(type) {
        const categoryCount = {};

        this.store.getAllTransactions()
            .filter(tx => tx.type === type)
            .forEach(tx => {
                categoryCount[tx.category] = (categoryCount[tx.category] || 0) + 1;
            });

        return Object.entries(categoryCount)
            .sort((a, b) => b[1] - a[1])
            .map(([cat]) => cat)
            .slice(0, 3);
    }

    /**
     * Sugere comandos baseado em entrada
     */
    getSuggestedCommands(input) {
        const commands = [
            { command: 'saldo', example: 'saldo', description: 'Ver saldo total', confidence: 0.6 },
            { command: 'recent', example: 'últimas transações', description: 'Ver transações recentes', confidence: 0.6 },
            { command: 'list_expenses', example: 'listar gastos', description: 'Ver todos os gastos', confidence: 0.6 },
            { command: 'help', example: 'ajuda', description: 'Ver exemplos de uso', confidence: 0.6 },
        ];

        const normalized = input.toLowerCase();

        return commands.filter(cmd => {
            const cmdWords = cmd.example.split(/\s+/);
            const inputWords = normalized.split(/\s+/);

            const matches = cmdWords.filter(word => 
                inputWords.some(iw => this.similarity(word, iw) > 0.6)
            ).length;

            return matches > 0;
        }).map(cmd => ({
            ...cmd,
            confidence: 0.5 + (cmd.confidence / 2),
        }));
    }

    /**
     * Calcula similaridade entre strings
     */
    similarity(a, b) {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Distância de Levenshtein
     */
    levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }
}

export const autoCorrection = new AutoCorrection();
export const fallbackEngine = null;
