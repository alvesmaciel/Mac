/**
 * Smart Alerts - Sistema de alertas inteligentes
 * Notifica usuário sobre eventos, duplicatas, padrões anormais
 */

import { appStorage } from '../../shared/storage.js';

export class SmartAlerts {
    constructor(store, duplicateDetector, patternAnalyzer) {
        this.store = store;
        this.duplicateDetector = duplicateDetector;
        this.patternAnalyzer = patternAnalyzer;
        this.alerts = appStorage.get('smartAlerts') || [];
        this.alertsEnabled = true;
    }

    /**
     * Gera alertas para uma nova transação
     */
    generateAlertsForTransaction(transaction) {
        const alerts = [];

        // Alerta 1: Duplicata detectada
        if (this.duplicateDetector) {
            const duplicate = this.duplicateDetector.checkDuplicate(transaction, 30);
            if (duplicate) {
                alerts.push(this.createAlert(
                    'duplicate',
                    '⚠️ Transação duplicada',
                    `${(duplicate.similarity * 100).toFixed(0)}% de similaridade com transação de ${duplicate.timeDiff.formatted}`,
                    'warning',
                    duplicate
                ));
            }
        }

        // Alerta 2: Transação atípica (muito diferente do padrão)
        if (this.patternAnalyzer) {
            const anomalies = this.patternAnalyzer.detectAnomalies(
                this.store.getAllTransactions().concat([transaction])
            );

            const txAnomaly = anomalies.find(a => a.transaction.id === transaction.id);
            if (txAnomaly) {
                alerts.push(this.createAlert(
                    'anomaly',
                    '📊 Transação atípica',
                    `Valor esperado: ${txAnomaly.expectedRange}`,
                    'info',
                    txAnomaly
                ));
            }
        }

        // Alerta 3: Limite de categoria excedido
        const categoryLimit = appStorage.get('categoryLimits')?.[transaction.category];
        if (categoryLimit) {
            const categoryTotal = this.store.getTransactionsByType(transaction.type)
                .filter(tx => tx.category === transaction.category)
                .reduce((sum, tx) => sum + tx.value, 0);

            if (categoryTotal > categoryLimit) {
                const exceeded = (categoryTotal - categoryLimit).toFixed(2);
                alerts.push(this.createAlert(
                    'limit_exceeded',
                    '💸 Limite de categoria excedido',
                    `${transaction.category}: ${exceeded} acima do limite`,
                    'warning',
                    { category: transaction.category, exceeded }
                ));
            }
        }

        // Alerta 4: Comportamento incomum (muitas transações em pouco tempo)
        const recentTransactions = this.store.getAllTransactions()
            .filter(tx => (tx.timestamp || Date.now()) > Date.now() - (1 * 60 * 60 * 1000)); // Última hora

        if (recentTransactions.length > 10) {
            alerts.push(this.createAlert(
                'high_frequency',
                '⚡ Atividade incomum',
                `${recentTransactions.length} transações na última hora`,
                'info'
            ));
        }

        // Alerta 5: Transação com valor muito grande
        const avgValue = this.store.getAllTransactions()
            .filter(tx => tx.type === transaction.type)
            .reduce((sum, tx) => sum + tx.value, 0) / 
            this.store.getAllTransactions().filter(tx => tx.type === transaction.type).length;

        if (transaction.value > avgValue * 3) {
            alerts.push(this.createAlert(
                'high_value',
                '💰 Transação de alto valor',
                `${(transaction.value / avgValue).toFixed(1)}x a média`,
                'info'
            ));
        }

        this.addAlerts(alerts);
        return alerts;
    }

    /**
     * Cria um objeto de alerta
     */
    createAlert(type, title, message, severity = 'info', metadata = null) {
        return {
            id: `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            type,
            title,
            message,
            severity, // 'info' | 'warning' | 'critical'
            timestamp: Date.now(),
            read: false,
            metadata,
            action: this.getAlertAction(type),
        };
    }

    /**
     * Retorna ação recomendada para cada tipo de alerta
     */
    getAlertAction(type) {
        const actions = {
            duplicate: { label: 'Remover duplicata', action: 'remove_duplicate' },
            anomaly: { label: 'Ver detalhes', action: 'view_anomaly' },
            limit_exceeded: { label: 'Gerenciar limites', action: 'manage_limits' },
            high_frequency: { label: 'Ver histórico', action: 'view_history' },
            high_value: { label: 'Confirmar', action: 'confirm' },
        };

        return actions[type] || { label: 'Descartar', action: 'dismiss' };
    }

    /**
     * Adiciona alertas à lista
     */
    addAlerts(alerts) {
        this.alerts = this.alerts.concat(alerts);
        this.save();
    }

    /**
     * Marca alerta como lido
     */
    markAsRead(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.read = true;
            this.save();
        }
    }

    /**
     * Remove alerta
     */
    dismissAlert(alertId) {
        this.alerts = this.alerts.filter(a => a.id !== alertId);
        this.save();
    }

    /**
     * Retorna alertas não lidos
     */
    getUnreadAlerts() {
        return this.alerts.filter(a => !a.read);
    }

    /**
     * Retorna alertas por severidade
     */
    getAlertsBySeverity(severity) {
        return this.alerts.filter(a => a.severity === severity && !a.read);
    }

    /**
     * Gera alertas periódicos (diários, semanais)
     */
    generatePeriodicAlerts() {
        const alerts = [];
        const lastCheckKey = 'lastAlertCheck';
        const lastCheck = appStorage.get(lastCheckKey) || 0;
        const now = Date.now();

        // Executar apenas uma vez por dia
        if (now - lastCheck < 24 * 60 * 60 * 1000) return alerts;

        // Alerta 1: Resumo diário
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTransactions = this.store.getAllTransactions()
            .filter(tx => (tx.timestamp || Date.now()) >= today.getTime());

        if (todayTransactions.length > 0) {
            const todayTotal = todayTransactions
                .filter(tx => tx.type === 'expense')
                .reduce((sum, tx) => sum + tx.value, 0);

            alerts.push(this.createAlert(
                'daily_summary',
                '📋 Resumo do dia',
                `${todayTransactions.length} transações | Gasto: R$ ${todayTotal.toFixed(2)}`,
                'info'
            ));
        }

        // Alerta 2: Alerta de categoria em alta
        if (this.patternAnalyzer) {
            const suggestions = this.patternAnalyzer.generateSuggestions(7);
            suggestions.forEach(sug => {
                if (sug.type === 'category_alert' && parseFloat(sug.percentage) > 40) {
                    alerts.push(this.createAlert(
                        'high_category',
                        `${sug.icon} ${sug.title}`,
                        `${sug.percentage}% de todo o gasto`,
                        'warning'
                    ));
                }
            });
        }

        appStorage.set(lastCheckKey, now);
        this.addAlerts(alerts);
        return alerts;
    }

    /**
     * Limpa alertas antigos (> 30 dias)
     */
    cleanOldAlerts(days = 30) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
        this.save();
    }

    /**
     * Ativa/Desativa alertas
     */
    toggle(enabled) {
        this.alertsEnabled = enabled;
        appStorage.set('smartAlertsEnabled', enabled);
    }

    /**
     * Salva alertas no storage
     */
    save() {
        appStorage.set('smartAlerts', this.alerts);
    }

    /**
     * Restaura alertas do storage
     */
    restore() {
        this.alerts = appStorage.get('smartAlerts') || [];
        this.alertsEnabled = appStorage.get('smartAlertsEnabled') !== false;
    }

    /**
     * Retorna estatísticas de alertas
     */
    getStats() {
        return {
            total: this.alerts.length,
            unread: this.getUnreadAlerts().length,
            critical: this.getAlertsBySeverity('critical').length,
            warning: this.getAlertsBySeverity('warning').length,
            info: this.getAlertsBySeverity('info').length,
        };
    }
}

export const smartAlerts = null; // Será inicializado
