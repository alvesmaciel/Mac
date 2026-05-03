/**
 * Conversation Context Manager
 * Mantém contexto, histórico e padrões de conversa
 */

import { appStorage } from '../../shared/storage.js';

export class ConversationContext {
    constructor() {
        this.currentConversation = [];
        this.conversationHistory = appStorage.get('conversationHistory') || [];
        this.contextData = appStorage.get('contextData') || {
            lastCategory: null,
            lastType: null,
            patterns: {},
            frequency: {},
            userPreferences: {}
        };
    }

    /**
     * Adiciona mensagem ao contexto atual
     */
    addMessage(role, text, metadata = {}) {
        const message = {
            id: this.generateId(),
            role, // 'user' | 'bot'
            text,
            timestamp: Date.now(),
            ...metadata
        };

        this.currentConversation.push(message);
        this.updatePatterns(message);
        this.save();

        return message;
    }

    /**
     * Extrai contexto da conversa para sugestões
     */
    getContext() {
        const recent = this.currentConversation.slice(-5); // Últimas 5 mensagens
        
        return {
            recentMessages: recent,
            lastUserMessage: this.getLastUserMessage(),
            lastBotResponse: this.getLastBotResponse(),
            patterns: this.contextData.patterns,
            userPreferences: this.contextData.userPreferences,
            conversationTopic: this.inferTopic(),
        };
    }

    /**
     * Retorna última mensagem do usuário
     */
    getLastUserMessage() {
        return [...this.currentConversation]
            .reverse()
            .find(m => m.role === 'user') || null;
    }

    /**
     * Retorna última resposta do bot
     */
    getLastBotResponse() {
        return [...this.currentConversation]
            .reverse()
            .find(m => m.role === 'bot') || null;
    }

    /**
     * Infere tópico da conversa analisando mensagens recentes
     */
    inferTopic() {
        const keywords = {
            expense: ['gasto', 'gastei', 'comprei', 'despesa', 'pago'],
            income: ['recebi', 'ganhei', 'entrada', 'salário', 'fatura'],
            debt: ['pagar', 'boleto', 'dever', 'devendo'],
            receivable: ['receber', 'vou receber', 'recebia'],
            summary: ['saldo', 'total', 'resumo', 'quanto', 'gastos'],
        };

        const recent = this.currentConversation
            .slice(-3)
            .map(m => m.text.toLowerCase())
            .join(' ');

        let maxScore = 0;
        let topic = 'general';

        Object.entries(keywords).forEach(([key, words]) => {
            const score = words.filter(w => recent.includes(w)).length;
            if (score > maxScore) {
                maxScore = score;
                topic = key;
            }
        });

        return topic;
    }

    /**
     * Atualiza padrões de uso
     */
    updatePatterns(message) {
    if (message.role !== 'user') return;

    // 🔒 Garante estrutura SEMPRE válida
    if (!this.contextData) {
        this.contextData = {};
    }

    if (!this.contextData.patterns) {
        this.contextData.patterns = {};
    }

    if (!this.contextData.frequency) {
        this.contextData.frequency = {};
    }

    const words = message.text.toLowerCase().split(/\s+/);

    words.forEach(word => {
        if (word.length > 3) {
            this.contextData.patterns[word] =
                (this.contextData.patterns[word] || 0) + 1;
        }
    });

    if (message.metadata?.category) {
        const cat = message.metadata.category;
        this.contextData.frequency[cat] =
            (this.contextData.frequency[cat] || 0) + 1;
    }

    this.save();
}

    /**
     * Retorna sugestões inteligentes baseadas em contexto
     */
    getSuggestions() {
        const context = this.getContext();
        const suggestions = [];

        // Se último tipo foi despesa, sugerir receita
        if (context.patterns.expense > context.patterns.income) {
            suggestions.push({
                type: 'income',
                text: 'Alguma entrada?',
                icon: '📈',
                detail: 'Registrar receita'
            });
        }

        // Se houver um padrão de categoria
        const topCategory = Object.entries(context.userPreferences)
            .sort((a, b) => b[1] - a[1])[0];

        if (topCategory) {
            suggestions.push({
                type: 'category',
                text: `${topCategory[0]}?`,
                icon: '🏷️',
                detail: `Sua categoria mais frequente`
            });
        }

        return suggestions;
    }

    /**
     * Novo histórico de conversa (limpar)
     */
    newConversation() {
        if (this.currentConversation.length > 0) {
            this.conversationHistory.push({
                messages: [...this.currentConversation],
                startTime: this.currentConversation[0]?.timestamp,
                endTime: Date.now(),
            });
        }

        this.currentConversation = [];
        this.save();
    }

    /**
     * Retorna histórico de conversas
     */
    getConversationHistory() {
        return this.conversationHistory;
    }

    /**
     * Análise de padrões por período
     */
    analyzePatterns(days = 7) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const recentMessages = this.currentConversation.filter(
            m => m.timestamp > cutoff
        );

        const analysis = {
            totalMessages: recentMessages.length,
            userMessages: recentMessages.filter(m => m.role === 'user').length,
            botMessages: recentMessages.filter(m => m.role === 'bot').length,
            patterns: this.contextData.patterns,
            frequency: this.contextData.frequency,
            averageWordsPerMessage: recentMessages
                .reduce((sum, m) => sum + m.text.split(' ').length, 0) 
                / (recentMessages.length || 1),
        };

        return analysis;
    }

    /**
     * Gera ID único
     */
    generateId() {
        return `ctx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    /**
     * Salva contexto no storage
     */
    save() {
        appStorage.set('conversationContext', this.currentConversation);
        appStorage.set('conversationHistory', this.conversationHistory);
        appStorage.set('contextData', this.contextData);
    }

    /**
     * Restaura contexto do storage
     */
    restore() {
    this.currentConversation = appStorage.get('conversationContext') || [];
    this.conversationHistory = appStorage.get('conversationHistory') || [];

    const saved = appStorage.get('contextData');

    this.contextData = {
        lastCategory: null,
        lastType: null,
        patterns: {},
        frequency: {},
        userPreferences: {},
        ...(saved || {})
    };
}

    /**
     * Limpa tudo
     */
    clear() {
        this.currentConversation = [];
        this.contextData = {
            lastCategory: null,
            lastType: null,
            patterns: {},
            frequency: {},
            userPreferences: {}
        };
        appStorage.remove('conversationContext');
        appStorage.remove('contextData');
    }
}

export const conversationContext = new ConversationContext();
