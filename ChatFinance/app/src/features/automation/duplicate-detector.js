/**
 * Duplicate Detector - Detecta transações duplicadas
 * Com suporte a data para diferenciação de transações idênticas
 */

export class DuplicateDetector {
    constructor(store) {
        this.store = store;
        this.sensitivity = 0.85; // 85% de similaridade
    }

    /**
     * Detecta se uma nova transação é duplicada
     * @param {Object} newTransaction - Transação candidata
     * @param {Number} timeWindowMinutes - Janela de tempo em minutos
     * @returns {Object|null} - Transação duplicada encontrada ou null
     */
    checkDuplicate(newTransaction, timeWindowMinutes = 30) {
        const allTransactions = this.store.getAllTransactions();
        const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);

        const recentTransactions = allTransactions.filter(tx => {
            // Se não tiver timestamp, assume recente
            const txTime = tx.timestamp || Date.now();
            return txTime > cutoffTime;
        });

        for (const existingTx of recentTransactions) {
            const similarity = this.calculateSimilarity(newTransaction, existingTx);
            
            if (similarity >= this.sensitivity) {
                return {
                    transaction: existingTx,
                    similarity: similarity,
                    timeDiff: this.getTimeDifference(newTransaction.timestamp, existingTx.timestamp),
                };
            }
        }

        return null;
    }

    /**
     * Calcula similaridade entre duas transações (0-1)
     */
    calculateSimilarity(tx1, tx2) {
        if (tx1.type !== tx2.type) return 0;

        let score = 0;
        let factors = 0;

        // Fator 1: Valor (30% do peso)
        if (Math.abs(tx1.value - tx2.value) < 0.01) {
            score += 0.30;
        } else {
            const valueDiff = Math.abs(tx1.value - tx2.value) / Math.max(tx1.value, tx2.value);
            if (valueDiff < 0.05) {
                score += 0.30 * (1 - valueDiff);
            }
        }
        factors += 0.30;

        // Fator 2: Categoria (40% do peso)
        if (this.normalizeString(tx1.category) === this.normalizeString(tx2.category)) {
            score += 0.40;
        } else {
            const categoryDistance = this.levenshteinDistance(
                this.normalizeString(tx1.category),
                this.normalizeString(tx2.category)
            );
            if (categoryDistance <= 1) {
                score += 0.40 * 0.7;
            }
        }
        factors += 0.40;

        // Fator 3: Descrição (20% do peso)
        if (this.normalizeString(tx1.description || '') === this.normalizeString(tx2.description || '')) {
            score += 0.20;
        } else {
            const descDistance = this.levenshteinDistance(
                this.normalizeString(tx1.description || ''),
                this.normalizeString(tx2.description || '')
            );
            if (descDistance <= 2) {
                score += 0.20 * (1 - descDistance / 10);
            }
        }
        factors += 0.20;

        // Fator 4: Data/Hora (10% do peso)
        const timeDiff = this.getTimeDifference(tx1.timestamp, tx2.timestamp);
        if (timeDiff.minutes < 5) {
            score += 0.10;
        } else if (timeDiff.minutes < 60) {
            score += 0.10 * 0.5;
        }
        factors += 0.10;

        return score / factors;
    }

    /**
     * Calcula distância de Levenshtein entre strings
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
     * Normaliza string para comparação
     */
    normalizeString(str) {
        return (str || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * Calcula diferença de tempo entre duas transações
     */
    getTimeDifference(time1, time2) {
        const t1 = time1 || Date.now();
        const t2 = time2 || Date.now();
        const diffMs = Math.abs(t1 - t2);

        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        return {
            minutes,
            hours,
            days,
            formatted: this.formatTimeDifference(diffMs),
        };
    }

    /**
     * Formata diferença de tempo legível
     */
    formatTimeDifference(diffMs) {
        if (diffMs < 60000) return 'Há poucos segundos';
        if (diffMs < 3600000) return `Há ${Math.floor(diffMs / 60000)} minutos`;
        if (diffMs < 86400000) return `Há ${Math.floor(diffMs / 3600000)} horas`;
        return `Há ${Math.floor(diffMs / 86400000)} dias`;
    }

    /**
     * Retorna todas as transações duplicadas em uma lista
     */
    findAllDuplicates(timeWindowMinutes = 1440) { // 24 horas por padrão
        const allTransactions = this.store.getAllTransactions();
        const duplicates = [];
        const processed = new Set();

        for (let i = 0; i < allTransactions.length; i++) {
            const tx1Id = `${i}_${allTransactions[i].value}`;
            if (processed.has(tx1Id)) continue;

            const group = [{ index: i, tx: allTransactions[i] }];

            for (let j = i + 1; j < allTransactions.length; j++) {
                const tx2Id = `${j}_${allTransactions[j].value}`;
                if (processed.has(tx2Id)) continue;

                const similarity = this.calculateSimilarity(allTransactions[i], allTransactions[j]);
                if (similarity >= this.sensitivity) {
                    group.push({ index: j, tx: allTransactions[j], similarity });
                    processed.add(tx2Id);
                }
            }

            if (group.length > 1) {
                duplicates.push(group);
                processed.add(tx1Id);
            }
        }

        return duplicates;
    }

    /**
     * Retorna sugestão de ação para duplicata
     */
    getDuplicateWarning(duplicate) {
        const timeDiff = duplicate.timeDiff;
        let urgency = 'info';

        if (timeDiff.minutes < 5) urgency = 'critical';
        else if (timeDiff.minutes < 30) urgency = 'warning';
        else if (timeDiff.days >= 1) urgency = 'suggestion';

        return {
            urgency,
            message: `Transação similar encontrada: ${timeDiff.formatted}`,
            suggestion: 'Deseja remover esta duplicata?',
            duplicate: duplicate.transaction,
            similarity: `${(duplicate.similarity * 100).toFixed(0)}%`,
        };
    }
}

export const duplicateDetector = null; // Será inicializado com store
