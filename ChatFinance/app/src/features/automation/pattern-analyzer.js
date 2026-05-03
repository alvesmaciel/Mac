/**
 * Pattern Analyzer - Detecção de padrões de transações
 * Identifica tendências, frequências e comportamentos
 */

export class PatternAnalyzer {
    constructor(store) {
        this.store = store;
    }

    /**
     * Analisa transações para detectar padrões
     */
    analyzePatterns(days = 30) {
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const transactions = this.store.getAllTransactions()
            .filter(tx => (tx.timestamp || Date.now()) > cutoffTime);

        return {
            period: `${days} dias`,
            totalTransactions: transactions.length,
            byType: this.analyzeByType(transactions),
            byCategory: this.analyzeByCategory(transactions),
            byDayOfWeek: this.analyzeByDayOfWeek(transactions),
            byHour: this.analyzeByHour(transactions),
            trends: this.detectTrends(transactions),
            frequency: this.analyzeFrequency(transactions),
        };
    }

    /**
     * Analisa transações por tipo
     */
    analyzeByType(transactions) {
        const types = {};

        transactions.forEach(tx => {
            if (!types[tx.type]) {
                types[tx.type] = {
                    count: 0,
                    total: 0,
                    average: 0,
                    min: Infinity,
                    max: 0,
                };
            }
            types[tx.type].count++;
            types[tx.type].total += tx.value;
            types[tx.type].min = Math.min(types[tx.type].min, tx.value);
            types[tx.type].max = Math.max(types[tx.type].max, tx.value);
        });

        Object.keys(types).forEach(type => {
            types[type].average = types[type].total / types[type].count;
            types[type].min = types[type].min === Infinity ? 0 : types[type].min;
        });

        return types;
    }

    /**
     * Analisa transações por categoria
     */
    analyzeByCategory(transactions) {
        const categories = {};

        transactions.forEach(tx => {
            const cat = tx.category || 'Sem categoria';
            if (!categories[cat]) {
                categories[cat] = {
                    count: 0,
                    total: 0,
                    types: {},
                };
            }
            categories[cat].count++;
            categories[cat].total += tx.value;
            categories[cat].types[tx.type] = (categories[cat].types[tx.type] || 0) + 1;
        });

        // Ordena por total gasto
        const sorted = Object.entries(categories)
            .sort((a, b) => b[1].total - a[1].total)
            .reduce((obj, [key, val]) => {
                obj[key] = { ...val, average: val.total / val.count };
                return obj;
            }, {});

        return sorted;
    }

    /**
     * Analisa transações por dia da semana
     */
    analyzeByDayOfWeek(transactions) {
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        const dayStats = {};

        transactions.forEach(tx => {
            const date = new Date(tx.timestamp || Date.now());
            const dayName = days[date.getDay()];

            if (!dayStats[dayName]) {
                dayStats[dayName] = { count: 0, total: 0, dayIndex: date.getDay() };
            }
            dayStats[dayName].count++;
            dayStats[dayName].total += tx.value;
        });

        // Calcula média por dia
        Object.keys(dayStats).forEach(day => {
            dayStats[day].average = dayStats[day].total / dayStats[day].count;
        });

        return dayStats;
    }

    /**
     * Analisa transações por hora do dia
     */
    analyzeByHour(transactions) {
        const hours = {};

        transactions.forEach(tx => {
            const date = new Date(tx.timestamp || Date.now());
            const hour = `${String(date.getHours()).padStart(2, '0')}:00`;

            if (!hours[hour]) {
                hours[hour] = { count: 0, total: 0 };
            }
            hours[hour].count++;
            hours[hour].total += tx.value;
        });

        // Ordena por hora
        const sorted = Object.keys(hours)
            .sort()
            .reduce((obj, key) => {
                obj[key] = { ...hours[key], average: hours[key].total / hours[key].count };
                return obj;
            }, {});

        return sorted;
    }

    /**
     * Detecta tendências (crescimento/queda)
     */
    detectTrends(transactions) {
        if (transactions.length < 2) return null;

        const sorted = transactions.sort((a, b) => a.timestamp - b.timestamp);
        const midpoint = Math.floor(sorted.length / 2);

        const firstHalf = sorted.slice(0, midpoint);
        const secondHalf = sorted.slice(midpoint);

        const firstHalfTotal = firstHalf.reduce((sum, tx) => sum + tx.value, 0);
        const secondHalfTotal = secondHalf.reduce((sum, tx) => sum + tx.value, 0);

        const avgFirst = firstHalfTotal / firstHalf.length;
        const avgSecond = secondHalfTotal / secondHalf.length;

        const percentChange = ((avgSecond - avgFirst) / avgFirst) * 100;
        const trend = percentChange > 5 ? 'crescente' : percentChange < -5 ? 'decrescente' : 'estável';

        return {
            trend,
            percentChange: percentChange.toFixed(2),
            firstHalfAvg: avgFirst.toFixed(2),
            secondHalfAvg: avgSecond.toFixed(2),
        };
    }

    /**
     * Analisa frequência de transações
     */
    analyzeFrequency(transactions) {
        if (transactions.length === 0) return null;

        const intervals = [];
        const sorted = transactions.sort((a, b) => a.timestamp - b.timestamp);

        for (let i = 1; i < sorted.length; i++) {
            const interval = sorted[i].timestamp - sorted[i - 1].timestamp;
            intervals.push(interval);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const minInterval = Math.min(...intervals);
        const maxInterval = Math.max(...intervals);

        // Calcula em horas
        const avgHours = (avgInterval / (1000 * 60 * 60)).toFixed(1);
        const minHours = (minInterval / (1000 * 60 * 60)).toFixed(1);
        const maxHours = (maxInterval / (1000 * 60 * 60)).toFixed(1);

        return {
            frequency: this.classifyFrequency(avgHours),
            avgInterval: `${avgHours}h`,
            minInterval: `${minHours}h`,
            maxInterval: `${maxHours}h`,
            totalInPeriod: transactions.length,
        };
    }

    /**
     * Classifica frequência de transações
     */
    classifyFrequency(avgHours) {
        avgHours = parseFloat(avgHours);

        if (avgHours < 1) return 'Muito frequente (< 1h)';
        if (avgHours < 6) return 'Frequente (< 6h)';
        if (avgHours < 24) return 'Diário';
        if (avgHours < 168) return 'Semanal';
        if (avgHours < 720) return 'Mensal';
        return 'Infrequente';
    }

    /**
     * Detecta transações atípicas
     */
    detectAnomalies(transactions) {
        const byCategory = this.analyzeByCategory(transactions);
        const anomalies = [];

        Object.entries(byCategory).forEach(([category, stats]) => {
            if (stats.count < 2) return;

            const values = transactions
                .filter(tx => tx.category === category)
                .map(tx => tx.value)
                .sort((a, b) => a - b);

            const mean = stats.average;
            const stdDev = this.calculateStdDev(values, mean);
            const threshold = mean + (2 * stdDev); // 2 desvios padrão

            transactions.forEach(tx => {
                if (tx.category === category && tx.value > threshold) {
                    anomalies.push({
                        transaction: tx,
                        category,
                        expectedRange: `${(mean - stdDev).toFixed(2)} - ${(mean + stdDev).toFixed(2)}`,
                        value: tx.value,
                        deviation: ((tx.value - mean) / stdDev).toFixed(2),
                    });
                }
            });
        });

        return anomalies;
    }

    /**
     * Calcula desvio padrão
     */
    calculateStdDev(values, mean) {
        if (values.length === 0) return 0;

        const variance = values
            .reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;

        return Math.sqrt(variance);
    }

    /**
     * Gera sugestões baseadas em padrões
     */
    generateSuggestions(days = 30) {
        const analysis = this.analyzePatterns(days);
        const suggestions = [];

        // Sugestão 1: Categoria com maior gasto
        const categoryByTotal = Object.entries(analysis.byCategory)
            .sort((a, b) => b[1].total - a[1].total);

        if (categoryByTotal[0]) {
            const [category, stats] = categoryByTotal[0];
            suggestions.push({
                type: 'category_alert',
                title: `Maior gasto: ${category}`,
                value: stats.total,
                percentage: ((stats.total / analysis.byType.expense?.total || 0) * 100).toFixed(1),
                icon: '🔥',
            });
        }

        // Sugestão 2: Tendências
        if (analysis.trends) {
            suggestions.push({
                type: 'trend_alert',
                title: `Gastos ${analysis.trends.trend}`,
                detail: `${analysis.trends.percentChange}% de mudança`,
                icon: analysis.trends.percentChange > 0 ? '📈' : '📉',
            });
        }

        // Sugestão 3: Dia mais ativo
        const dayByCount = Object.entries(analysis.byDayOfWeek)
            .sort((a, b) => b[1].count - a[1].count);

        if (dayByCount[0]) {
            suggestions.push({
                type: 'day_pattern',
                title: `Mais ativo: ${dayByCount[0][0]}`,
                count: dayByCount[0][1].count,
                icon: '📅',
            });
        }

        return suggestions;
    }
}

export const patternAnalyzer = null; // Será inicializado com store
