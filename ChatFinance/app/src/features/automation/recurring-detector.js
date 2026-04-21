/**
 * Recurring Detector - Detecta transações recorrentes (diária, semanal, mensal)
 * Permite criar regras de auto-lançamento
 */

import { appStorage } from '../../shared/storage.js';

export class RecurringDetector {
    constructor(store) {
        this.store = store;
        this.recurringRules = appStorage.get('recurringRules') || [];
    }

    /**
     * Analisa transações para detectar padrões recorrentes
     */
    detectRecurring(category, type, minOccurrences = 3) {
        const matching = this.store.getAllTransactions()
            .filter(tx => tx.category === category && tx.type === type);

        if (matching.length < minOccurrences) return null;

        const sorted = matching
            .map(tx => ({ ...tx, ts: tx.timestamp || Date.now() }))
            .sort((a, b) => a.ts - b.ts);

        // Calcula intervalos entre transações
        const intervals = [];
        for (let i = 1; i < sorted.length; i++) {
            intervals.push(sorted[i].ts - sorted[i - 1].ts);
        }

        if (intervals.length === 0) return null;

        // Agrupa intervalos similares
        const pattern = this.classifyPattern(intervals);
        if (!pattern) return null;

        // Calcula valor médio
        const avgValue = matching.reduce((sum, tx) => sum + tx.value, 0) / matching.length;

        return {
            category,
            type,
            pattern,
            frequency: this.frequencyLabel(pattern),
            avgValue: parseFloat(avgValue.toFixed(2)),
            count: matching.length,
            confidence: this.calculateConfidence(intervals),
            lastOccurrence: sorted[sorted.length - 1].ts,
            nextPredicted: this.predictNextOccurrence(sorted[sorted.length - 1].ts, pattern),
            intervals,
        };
    }

    /**
     * Classifica padrão de intervalo de tempo
     */
    classifyPattern(intervals) {
        // Calcula média de intervalos
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        // Calcula desvio padrão
        const variance = intervals
            .reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);

        // Se variação é alta, não é padrão regular
        if (stdDev / avgInterval > 0.3) return null;

        const hoursInInterval = avgInterval / (1000 * 60 * 60);
        const daysInInterval = hoursInInterval / 24;

        // Classifica tipo de recorrência
        if (daysInInterval < 1) return { type: 'hourly', days: daysInInterval, hours: hoursInInterval };
        if (daysInInterval < 2) return { type: 'daily', days: 1 };
        if (daysInInterval < 8) return { type: 'weekly', days: Math.round(daysInInterval) };
        if (daysInInterval < 35) return { type: 'monthly', days: Math.round(daysInInterval) };
        if (daysInInterval < 365) return { type: 'quarterly', days: Math.round(daysInInterval) };
        return { type: 'yearly', days: Math.round(daysInInterval) };
    }

    /**
     * Calcula confiança da detecção (0-1)
     */
    calculateConfidence(intervals) {
        if (intervals.length < 2) return 0.3;

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals
            .reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);

        // Quanto menor a variação, maior a confiança
        const normalizedStdDev = stdDev / avgInterval;

        if (normalizedStdDev < 0.05) return 0.95;
        if (normalizedStdDev < 0.10) return 0.85;
        if (normalizedStdDev < 0.15) return 0.75;
        if (normalizedStdDev < 0.25) return 0.60;
        if (normalizedStdDev < 0.35) return 0.40;

        return Math.max(0.1, 1 - normalizedStdDev);
    }

    /**
     * Etiqueta de frequência legível
     */
    frequencyLabel(pattern) {
        const labels = {
            hourly: 'A cada hora',
            daily: 'Diária',
            weekly: 'Semanal',
            monthly: 'Mensal',
            quarterly: 'Trimestral',
            yearly: 'Anual',
        };
        return labels[pattern.type] || 'Regular';
    }

    /**
     * Prediz próxima ocorrência
     */
    predictNextOccurrence(lastTs, pattern) {
        const daysInMs = pattern.days * 24 * 60 * 60 * 1000;
        return lastTs + daysInMs;
    }

    /**
     * Cria regra de recorrência automática
     */
    createRule(category, type, pattern, enabled = false) {
        const rule = {
            id: `rule_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            category,
            type,
            pattern,
            enabled,
            created: Date.now(),
            lastExecuted: null,
            nextExecution: this.predictNextOccurrence(Date.now(), pattern),
        };

        this.recurringRules.push(rule);
        this.save();

        return rule;
    }

    /**
     * Executa regras de recorrência pendentes
     */
    executeRecurringRules() {
        const now = Date.now();
        const executed = [];

        this.recurringRules.forEach(rule => {
            if (!rule.enabled) return;
            if (now < rule.nextExecution) return;

            // Executa a regra (cria transação automática)
            const pattern = this.store.getAllTransactions()
                .filter(tx => tx.category === rule.category && tx.type === rule.type)
                .map(tx => ({ ...tx, ts: tx.timestamp || Date.now() }))
                .sort((a, b) => b.ts - a.ts)[0];

            if (pattern) {
                const avgValue = this.store.getAllTransactions()
                    .filter(tx => tx.category === rule.category && tx.type === rule.type)
                    .reduce((sum, tx) => sum + tx.value, 0) / 
                    this.store.getAllTransactions()
                        .filter(tx => tx.category === rule.category && tx.type === rule.type).length;

                const newTransaction = {
                    type: rule.type,
                    value: parseFloat(avgValue.toFixed(2)),
                    category: rule.category,
                    description: `Auto: ${rule.category}`,
                    timestamp: now,
                    isRecurring: true,
                    recurringRuleId: rule.id,
                };

                this.store.addTransaction(newTransaction);

                // Atualiza próxima execução
                rule.lastExecuted = now;
                rule.nextExecution = this.predictNextOccurrence(now, rule.pattern);

                executed.push({
                    ruleId: rule.id,
                    transaction: newTransaction,
                    nextExecution: rule.nextExecution,
                });
            }
        });

        this.save();
        return executed;
    }

    /**
     * Lista regras ativas
     */
    getActiveRules() {
        return this.recurringRules.filter(r => r.enabled);
    }

    /**
     * Desativa/Ativa regra
     */
    toggleRule(ruleId, enabled) {
        const rule = this.recurringRules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
            this.save();
        }
    }

    /**
     * Remove regra
     */
    removeRule(ruleId) {
        this.recurringRules = this.recurringRules.filter(r => r.id !== ruleId);
        this.save();
    }

    /**
     * Salva regras
     */
    save() {
        appStorage.set('recurringRules', this.recurringRules);
    }

    /**
     * Restaura regras
     */
    restore() {
        this.recurringRules = appStorage.get('recurringRules') || [];
    }

    /**
     * Sugestões de regras para criar
     */
    getSuggestedRules() {
        const recurring = [];
        const categories = new Set(
            this.store.getAllTransactions().map(tx => tx.category)
        );

        categories.forEach(category => {
            ['expense', 'income', 'debt'].forEach(type => {
                const detected = this.detectRecurring(category, type, 2);
                if (detected && detected.confidence > 0.6) {
                    recurring.push(detected);
                }
            });
        });

        return recurring.sort((a, b) => b.confidence - a.confidence);
    }

    analyze(transaction) {
        if (!transaction?.category || !transaction?.type) return [];
        const detected = this.detectRecurring(transaction.category, transaction.type, 3);
        if (!detected || detected.confidence < 0.6) return [];
        return [detected];
    }
}

export const recurringDetector = null;
