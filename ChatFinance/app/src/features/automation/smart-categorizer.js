/**
 * Smart Categorizer - Auto-categorização evolutiva
 * Aprende com histórico e sugere categorias baseado em descrição/padrões
 */

import { appStorage } from '../../shared/storage.js';

export class SmartCategorizer {
    constructor(store) {
        this.store = store;
        this.categoryKeywords = appStorage.get('categoryKeywords') || this.initDefaultKeywords();
        this.categoryHistory = appStorage.get('categoryHistory') || {};
    }

    /**
     * Palavras-chave padrão por categoria
     */
    initDefaultKeywords() {
        return {
            'Alimentação': ['comida', 'refeição', 'restaurante', 'pizza', 'hamburguer', 'supermercado', 'açougue', 'padaria', 'café', 'bar'],
            'Transporte': ['uber', 'táxi', 'combustível', 'gasolina', 'ônibus', 'metrô', 'estacionamento', 'passagem', 'viagem'],
            'Saúde': ['farmácia', 'médico', 'hospital', 'dentista', 'spa', 'academia', 'fisioterapia', 'remédio'],
            'Entretenimento': ['cinema', 'show', 'jogo', 'Netflix', 'spotify', 'livro', 'streaming', 'diversão'],
            'Utilities': ['energia', 'água', 'gás', 'internet', 'telefone', 'conta', 'boleto'],
            'Compras': ['loja', 'roupas', 'sapatos', 'eletrônicos', 'Amazon', 'shopping', 'compra'],
            'Trabalho': ['trabalho', 'freelance', 'cliente', 'projeto', 'salário', 'consultoria'],
            'Casa': ['aluguel', 'imóvel', 'moradia', 'móvel', 'reforma', 'pintura'],
            'Educação': ['curso', 'faculdade', 'universidade', 'livro', 'escola', 'aula'],
        };
    }

    /**
     * Sugere categoria baseado em descrição
     */
    suggestCategory(description, type = 'expense') {
        if (!description) return null;

        const normalized = this.normalize(description);
        const suggestions = [];

        // 1. Busca por palavras-chave exatas
        Object.entries(this.categoryKeywords).forEach(([category, keywords]) => {
            keywords.forEach(keyword => {
                if (normalized.includes(this.normalize(keyword))) {
                    suggestions.push({ category, score: 0.9, reason: 'palavra-chave exata' });
                }
            });
        });

        // 2. Busca por similaridade de string
        const words = normalized.split(/\s+/);
        Object.entries(this.categoryKeywords).forEach(([category, keywords]) => {
            let matchScore = 0;
            keywords.forEach(keyword => {
                const keywordWords = this.normalize(keyword).split(/\s+/);
                keywordWords.forEach(kw => {
                    if (words.some(w => this.similarity(w, kw) > 0.7)) {
                        matchScore += 0.5;
                    }
                });
            });

            if (matchScore > 0) {
                suggestions.push({ category, score: Math.min(0.7, matchScore / 3), reason: 'similaridade' });
            }
        });

        // 3. Busca no histórico do usuário
        const userHistory = this.findSimilarHistoric(description);
        if (userHistory) {
            suggestions.push({ category: userHistory.category, score: 0.8, reason: 'histórico do usuário' });
        }

        // Retorna melhor sugestão
        if (suggestions.length === 0) return null;

        const best = suggestions.sort((a, b) => b.score - a.score)[0];
        return {
            category: best.category,
            confidence: best.score,
            reason: best.reason,
            alternatives: suggestions
                .filter(s => s.category !== best.category)
                .sort((a, b) => b.score - a.score)
                .slice(0, 2),
        };
    }

    /**
     * Busca descrições similares no histórico
     */
    findSimilarHistoric(description) {
        const normalized = this.normalize(description);
        const transactions = this.store.getAllTransactions();

        let bestMatch = null;
        let bestSimilarity = 0;

        transactions.forEach(tx => {
            if (tx.description) {
                const similarity = this.levenshteinSimilarity(
                    normalized,
                    this.normalize(tx.description)
                );

                if (similarity > bestSimilarity && similarity > 0.6) {
                    bestSimilarity = similarity;
                    bestMatch = tx;
                }
            }
        });

        return bestMatch;
    }

    /**
     * Aprende com a categorização do usuário
     */
    learnFromUser(description, category, type = 'expense') {
        // Extrai palavras-chave da descrição
        const words = this.normalize(description)
            .split(/\s+/)
            .filter(w => w.length > 2);

        // Adiciona ao histórico
        if (!this.categoryHistory[category]) {
            this.categoryHistory[category] = [];
        }

        this.categoryHistory[category].push({
            description,
            timestamp: Date.now(),
            type,
        });

        // Atualiza palavras-chave
        words.forEach(word => {
            if (!this.categoryKeywords[category]) {
                this.categoryKeywords[category] = [];
            }

            if (!this.categoryKeywords[category].includes(word) && word.length > 2) {
                // Adiciona palavra com peso baseado em frequência
                const frequency = this.getWordFrequency(word, category);
                if (frequency >= 2) {
                    this.categoryKeywords[category].push(word);
                }
            }
        });

        this.save();
    }

    /**
     * Calcula frequência de palavra em categoria
     */
    getWordFrequency(word, category) {
        if (!this.categoryHistory[category]) return 0;

        let count = 0;
        this.categoryHistory[category].forEach(item => {
            if (this.normalize(item.description).includes(this.normalize(word))) {
                count++;
            }
        });

        return count;
    }

    /**
     * Auto-categoriza transação
     */
    autoFlattenTransaction(transaction) {
        const suggestion = this.suggestCategory(transaction.description, transaction.type);

        if (!suggestion) return transaction;

        if (suggestion.confidence >= 0.85) {
            // Confiança alta, auto-categoriza
            return {
                ...transaction,
                category: suggestion.category,
                autoCategored: true,
                categorySuggestionScore: suggestion.confidence,
            };
        } else if (suggestion.confidence >= 0.60) {
            // Confiança média, sugere ao usuário
            return {
                ...transaction,
                suggestedCategory: suggestion.category,
                categorySuggestion: suggestion,
            };
        }

        return transaction;
    }

    /**
     * Normaliza string para comparação
     */
    normalize(str) {
        return (str || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * Calcula similaridade entre duas strings (0-1)
     */
    similarity(a, b) {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Distância de Levenshtein entre strings
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
     * Similaridade Levenshtein (0-1)
     */
    levenshteinSimilarity(a, b) {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Retorna todas as categorias conhecidas
     */
    getAllCategories() {
        return Object.keys(this.categoryKeywords);
    }

    /**
     * Retorna palavras-chave de uma categoria
     */
    getCategoryKeywords(category) {
        return this.categoryKeywords[category] || [];
    }

    /**
     * Adiciona nova categoria
     */
    addCategory(category, keywords = []) {
        if (!this.categoryKeywords[category]) {
            this.categoryKeywords[category] = keywords;
            this.save();
            return true;
        }
        return false;
    }

    /**
     * Remove categoria
     */
    removeCategory(category) {
        delete this.categoryKeywords[category];
        delete this.categoryHistory[category];
        this.save();
    }

    /**
     * Reseta conhecimento aprendido
     */
    resetLearning() {
        this.categoryKeywords = this.initDefaultKeywords();
        this.categoryHistory = {};
        this.save();
    }

    /**
     * Salva dados
     */
    save() {
        appStorage.set('categoryKeywords', this.categoryKeywords);
        appStorage.set('categoryHistory', this.categoryHistory);
    }

    /**
     * Restaura dados
     */
    restore() {
        this.categoryKeywords = appStorage.get('categoryKeywords') || this.initDefaultKeywords();
        this.categoryHistory = appStorage.get('categoryHistory') || {};
    }
}

export const smartCategorizer = null;
