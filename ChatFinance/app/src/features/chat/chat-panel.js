import { escHtml, formatBRL, norm } from '../../shared/utils.js';
import { messageActions } from './message-actions.js';
import { conversationContext } from './conversation-context.js';
import { typingEffects } from './typing-effects.js';
import { FallbackEngine } from '../automation/auto-correction.js';

const BASE_SUGGESTIONS = [
    { prefix: 'rec', full: 'recebi ', type: 'income', label: 'Receita', detail: 'Registrar entrada' },
    { prefix: 'ganh', full: 'ganhei ', type: 'income', label: 'Receita', detail: 'Salario ou renda extra' },
    { prefix: 'gast', full: 'gastei ', type: 'expense', label: 'Gasto', detail: 'Registrar despesa' },
    { prefix: 'comp', full: 'comprei ', type: 'expense', label: 'Gasto', detail: 'Compra imediata' },
    { prefix: 'pag', full: 'pagar ', type: 'debt', label: 'A Pagar', detail: 'Conta pendente' },
    { prefix: 'vou', full: 'vou receber ', type: 'receivable', label: 'A Receber', detail: 'Valor esperado' },
    { prefix: 'sal', full: 'saldo', type: 'command', label: 'Resumo', detail: 'Ver resumo financeiro' },
    { prefix: 'ult', full: 'ultimas transacoes', type: 'command', label: 'Recentes', detail: 'Ver ultimos lancamentos' },
    { prefix: 'aju', full: 'ajuda', type: 'command', label: 'Ajuda', detail: 'Ver exemplos' },
];

const TYPE_AC_CLS = {
    income: 'ac-income',
    expense: 'ac-expense',
    debt: 'ac-debt',
    receivable: 'ac-receivable',
    command: 'ac-command',
};

export class ChatPanel {
    constructor({
        parser,
        store,
        settings,
        onStateChange,
        categorizer,
        duplicateDetector,
        alerts,
        autoCorrection,
        recurringDetector,
    }) {
        this.parser = parser;
        this.store = store;
        this.settings = settings;
        this.onStateChange = onStateChange;
        this.categorizer = categorizer;
        this.duplicateDetector = duplicateDetector;
        this.smartAlerts = alerts;
        this.autoCorrection = autoCorrection;
        this.recurringDetector = recurringDetector;
        this.fallbackEngine = new FallbackEngine(store, parser);

        this.messagesEl = document.getElementById('chatMessages');
        this.inputEl = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendBtn');
        this.clearButton = document.getElementById('clearChatBtn');
        this.autocompleteEl = document.getElementById('autocompleteBox');

        this.messageActions = messageActions;
        this.conversationContext = conversationContext;
        this.typingEffects = typingEffects;

        this.acVisible = [];
        this.acSelected = -1;
        this.isTyping = false;
    }

    bind() {
        this.inputEl.addEventListener('input', () => this.updateAutocomplete(this.inputEl.value));
        this.inputEl.addEventListener('keydown', (event) => this.handleKeyDown(event));
        this.inputEl.addEventListener('blur', () => setTimeout(() => this.hideAutocomplete(), 150));
        this.sendButton.addEventListener('click', () => this.handleSend());
        this.clearButton.addEventListener('click', () => this.handleClearChat());
        this.conversationContext.restore();
    }

    renderWelcome() {
        this.messagesEl.innerHTML = '';
        this.addBubble(
            `Ola! Conte suas financas em linguagem natural.<br><br><span class="hint">Exemplos: "recebi 1443 salario", "gastei 89 mercado" ou "saldo".</span>`,
            'msg--response type-unknown',
            'AutoFinance',
        );
    }

    getHistory() {
        return Array.from(this.messagesEl.querySelectorAll('.msg')).map((message) => ({
            cls: message.className,
            html: message.querySelector('.msg-content')?.innerHTML ?? '',
            author: message.querySelector('.msg-author')?.textContent ?? '',
            transactionId: message.getAttribute('data-transaction-id') || null,
            messageId: message.getAttribute('data-message-id') || null,
        }));
    }

    restoreHistory(history) {
        if (!Array.isArray(history) || !history.length) return;
        this.messagesEl.innerHTML = '';

        history.forEach(({ cls, html, author, transactionId, messageId }) => {
            const type = cls.includes('msg--user') ? 'user' : 'response';
            const { element } = this.messageActions.createMessageBubble(html, type, messageId, author);
            element.className = cls;
            if (transactionId) {
                element.setAttribute('data-transaction-id', transactionId);
            }
            this.messagesEl.appendChild(element);
        });

        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    addBubble(html, cls, author = 'AutoFinance') {
        const type = cls.includes('msg--user') ? 'user' : 'response';
        const { element } = this.messageActions.createMessageBubble(html, type, null, author);
        element.className = `msg ${cls}`;
        this.messagesEl.appendChild(element);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        return element;
    }

    buildResponse(parsed) {
        const description = parsed.description && parsed.description !== '-'
            ? `<br><span style="opacity:.7;font-size:.73rem">Detalhe: ${escHtml(parsed.description)}</span>`
            : '';
        const dateLabel = parsed.date
            ? `<br><span style="opacity:.7;font-size:.73rem">Data: ${new Date(parsed.date).toLocaleDateString('pt-BR')}</span>`
            : '';

        switch (parsed.type) {
            case 'income':
                return { html: `Receita registrada.<br>Valor: <strong>${formatBRL(parsed.value)}</strong> | ${escHtml(parsed.category)}${description}${dateLabel}`, cls: 'msg--response type-income' };
            case 'expense':
                return { html: `Gasto registrado.<br>Valor: <strong>${formatBRL(parsed.value)}</strong> | ${escHtml(parsed.category)}${description}${dateLabel}`, cls: 'msg--response type-expense' };
            case 'debt':
                return { html: `Conta a pagar adicionada.<br>Valor: <strong>${formatBRL(parsed.value)}</strong> | ${escHtml(parsed.category)}${description}${dateLabel}`, cls: 'msg--response type-debt' };
            case 'receivable':
                return { html: `Valor a receber registrado.<br>Valor: <strong>${formatBRL(parsed.value)}</strong> | ${escHtml(parsed.category)}${description}${dateLabel}`, cls: 'msg--response type-receivable' };
            case 'no_value':
                return { html: `Entendi a intencao, mas faltou o valor.<br><span class="hint">Exemplo: "${escHtml(parsed.raw)} 500"</span>`, cls: 'msg--response type-unknown' };
            case 'cmd_summary': {
                const totals = this.store.getTotals();
                const color = totals.balance >= 0 ? 'var(--green)' : 'var(--red)';
                return {
                    html: `Resumo atual.<br>Saldo: <strong style="color:${color}">${formatBRL(totals.balance)}</strong><br>Recebido: ${formatBRL(totals.income)} | Gasto: ${formatBRL(totals.expenses)}<br>A pagar: ${formatBRL(totals.debts)} | A receber: ${formatBRL(totals.receivables)}`,
                    cls: 'msg--response type-income',
                };
            }
            case 'cmd_recent':
                return { html: this.buildListResponse('Ultimas transacoes', this.store.getRecentTransactions(5)), cls: 'msg--response type-unknown' };
            case 'cmd_help':
                return {
                    html: `
                        <strong>Exemplos de uso</strong><br>
                        <span class="hint">recebi 1443 salario</span><br>
                        <span class="hint">gastei 89 mercado ontem</span><br>
                        <span class="hint">pagar aluguel 1200</span><br>
                        <span class="hint">vou receber 500 sexta</span><br>
                        <span class="hint">saldo</span>
                    `,
                    cls: 'msg--response type-unknown',
                };
            default:
                return { html: 'Nao entendi a mensagem. Digite "ajuda" para ver exemplos.', cls: 'msg--response type-unknown' };
        }
    }

    buildListResponse(title, items) {
        if (!items.length) {
            return `<strong>${title}:</strong><br><span class="hint">Nenhum item encontrado.</span>`;
        }

        const content = items.map((item) => {
            const date = new Date(item.timestamp || item.date || Date.now()).toLocaleDateString('pt-BR');
            return `- ${formatBRL(item.value)} | ${escHtml(item.category)} <span style="opacity:.65">${date}</span>`;
        }).join('<br>');

        return `<strong>${title}:</strong><br>${content}`;
    }

    maybeShowFallbacks(text, parsed) {
        if (!this.settings.get('fallbackSuggestions', true)) return;

        const fallbacks = this.fallbackEngine.generateFallbacks(text, parsed);
        if (!fallbacks.length) return;

        const html = fallbacks
            .map((item) => `<span class="hint">${escHtml(item.text)}</span>`)
            .join('<br>');

        this.addBubble(`Talvez voce queira dizer:<br>${html}`, 'msg--response type-unknown', 'Sugestao');
    }

    async handleSend() {
        const text = this.inputEl.value.trim();
        if (!text || this.isTyping) return;

        this.hideAutocomplete();
        this.inputEl.value = '';
        this.inputEl.focus();

        const userMsg = this.addBubble(escHtml(text), 'msg--user', 'Voce');
        this.typingEffects.fadeInMessage(userMsg);

        if (this.settings.get('chatContextRemembering', true)) {
            this.conversationContext.addMessage('user', text);
        }

        try {
            const corrected = this.settings.get('autoCorrection', true)
                ? this.autoCorrection.correct(text)
                : text;
            const parsed = this.parser.parse(corrected);

            if (!parsed || parsed.type === 'unknown') {
                this.addBubble('Nao entendi. Digite "ajuda" para ver exemplos.', 'msg--response type-unknown', 'AutoFinance');
                this.maybeShowFallbacks(text, parsed || { type: 'unknown', raw: text });
                this.persist();
                return;
            }

            if (parsed.type === 'multi') {
                this.addBubble('Por enquanto, envie uma transacao por mensagem para manter a revisao confiavel.', 'msg--response type-unknown', 'AutoFinance');
                this.persist();
                return;
            }

            if (this.settings.get('autoCateg', true) && parsed.description && parsed.type && !parsed.type.startsWith('cmd_')) {
                const suggestion = this.categorizer.suggestCategory(parsed.description, parsed.type);
                if (suggestion?.category && suggestion.confidence >= this.settings.get('autoCategConfidenceThreshold', 0.85)) {
                    parsed.category = suggestion.category;
                }
            }

            if (['income', 'expense', 'debt', 'receivable'].includes(parsed.type) && parsed.value) {
                if (this.settings.get('duplicateDetection', true)) {
                    const duplicate = this.duplicateDetector.checkDuplicate(parsed);
                    if (duplicate) {
                        this.addBubble(
                            `Possivel duplicata detectada: ${duplicate.similarityLabel} de similaridade com item de ${duplicate.timeDiff.formatted}.`,
                            'msg--response type-unknown',
                            'Validador',
                        );
                    }
                }

                const createdTx = this.store.addTransaction(parsed);
                this.messageActions.linkTransactionToMessage(userMsg, createdTx.id);

                if (this.settings.get('learnFromCorrections', true) && createdTx.description && createdTx.category) {
                    this.categorizer.learnFromUser(createdTx.description, createdTx.category, createdTx.type);
                }

                if (this.settings.get('smartAlerts', true)) {
                    const alerts = this.smartAlerts.generateAlertsForTransaction(createdTx);
                    alerts.slice(0, 2).forEach((alert) => {
                        this.addBubble(alert.message, 'msg--response type-unknown', 'Alerta');
                    });
                }

                if (this.settings.get('recurringDetection', true)) {
                    this.recurringDetector.analyze(createdTx);
                }

                this.onStateChange?.();
            }

            const response = this.buildResponse(parsed);
            this.isTyping = true;
            const useTyping = this.settings.get('chatTypingEffect', true);
            const typingIndicator = useTyping ? this.typingEffects.showTypingIndicator(this.messagesEl, 'AutoFinance') : null;

            setTimeout(async () => {
                if (typingIndicator) this.typingEffects.removeTypingIndicator(typingIndicator);

                if (useTyping) {
                    await this.typingEffects.typeMessage(this.messagesEl, response.html, 18, {
                        cls: response.cls,
                        author: 'AutoFinance',
                    });
                } else {
                    this.addBubble(response.html, response.cls, 'AutoFinance');
                }

                if (this.settings.get('chatContextRemembering', true)) {
                    this.conversationContext.addMessage('bot', response.html);
                }

                this.isTyping = false;
                this.persist();
            }, useTyping ? 220 : 0);
        } catch (error) {
            console.error('Erro no chat:', error);
            this.addBubble('Erro ao processar a mensagem.', 'msg--response type-unknown', 'Sistema');
            this.persist();
            this.isTyping = false;
        }
    }

    handleClearChat() {
        if (!confirm('Limpar apenas o historico do chat?')) return;
        this.messageActions.clearAll(this.messagesEl);
        this.conversationContext.newConversation();
        this.renderWelcome();
        this.persist();
    }

    updateAutocomplete(value) {
        const normalized = norm(value);
        if (!normalized || normalized.length < 2) {
            this.hideAutocomplete();
            return;
        }

        const suggestions = this.buildAutocompleteSuggestions(normalized, value);
        if (!suggestions.length) {
            this.hideAutocomplete();
            return;
        }

        this.acVisible = suggestions.slice(0, 6);
        this.autocompleteEl.innerHTML = '';
        this.acSelected = -1;

        this.acVisible.forEach((suggestion) => {
            const item = document.createElement('div');
            item.className = 'ac-item';
            item.innerHTML = `
                <span class="ac-tag ${TYPE_AC_CLS[suggestion.type] || 'ac-income'}">${escHtml(suggestion.label)}</span>
                <div class="ac-main">
                    <span>${escHtml(suggestion.full)}</span>
                    <span class="ac-sub">${escHtml(suggestion.detail || '')}</span>
                </div>
                ${suggestion.history ? '<span class="ac-meta">historico</span>' : ''}
            `;
            item.addEventListener('mousedown', (event) => {
                event.preventDefault();
                this.applyAutocomplete(suggestion.full);
            });
            this.autocompleteEl.appendChild(item);
        });

        this.autocompleteEl.classList.add('visible');
    }

    buildAutocompleteSuggestions(normalized, rawValue) {
        const scored = [];

        BASE_SUGGESTIONS.forEach((suggestion) => {
            const full = norm(suggestion.full);
            let score = -1;

            if (full.startsWith(normalized)) score = 120;
            else if (normalized.startsWith(suggestion.prefix)) score = 105;
            else if (full.includes(normalized)) score = 90;

            if (score >= 0) scored.push({ ...suggestion, score });
        });

        const rawNumber = rawValue.match(/\d[\d.,]*/)?.[0];
        if (rawNumber) {
            scored.push(
                { full: `recebi ${rawNumber} `, type: 'income', label: 'Receita', detail: 'Transformar valor em receita', score: 115 },
                { full: `gastei ${rawNumber} `, type: 'expense', label: 'Gasto', detail: 'Transformar valor em gasto', score: 114 },
                { full: `pagar ${rawNumber} `, type: 'debt', label: 'A Pagar', detail: 'Transformar valor em conta', score: 113 },
            );
        }

        const history = this.store.getAllTransactions().slice(-20).reverse();
        const seen = new Set(scored.map((item) => norm(item.full)));
        history.forEach((tx) => {
            const normalizedRaw = norm(tx.raw || '');
            if (!normalizedRaw || seen.has(normalizedRaw) || !normalizedRaw.includes(normalized)) return;
            seen.add(normalizedRaw);
            scored.push({
                full: tx.raw,
                type: tx.type,
                label: suggestionLabel(tx.type),
                detail: `${tx.category} | ${formatBRL(tx.value)}`,
                history: true,
                score: 80,
            });
        });

        return scored
            .sort((a, b) => b.score - a.score || a.full.length - b.full.length)
            .filter((item, index, list) => index === list.findIndex((candidate) => norm(candidate.full) === norm(item.full)));
    }

    applyAutocomplete(full) {
        this.inputEl.value = full;
        this.inputEl.focus();
        this.inputEl.setSelectionRange(full.length, full.length);
        this.hideAutocomplete();
    }

    hideAutocomplete() {
        this.autocompleteEl.classList.remove('visible');
        this.autocompleteEl.innerHTML = '';
        this.acVisible = [];
        this.acSelected = -1;
    }

    navigateAutocomplete(direction) {
        const items = this.autocompleteEl.querySelectorAll('.ac-item');
        if (!items.length) return false;
        items[this.acSelected]?.classList.remove('selected');
        this.acSelected = (this.acSelected + direction + items.length) % items.length;
        items[this.acSelected].classList.add('selected');
        return true;
    }

    handleKeyDown(event) {
        if (this.autocompleteEl.classList.contains('visible')) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.navigateAutocomplete(1);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.navigateAutocomplete(-1);
                return;
            }
            if ((event.key === 'Tab' || event.key === 'Enter') && this.acSelected >= 0 && this.acVisible[this.acSelected]) {
                event.preventDefault();
                this.applyAutocomplete(this.acVisible[this.acSelected].full);
                return;
            }
            if (event.key === 'Escape') {
                this.hideAutocomplete();
                return;
            }
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            this.handleSend();
        }
    }

    persist() {
        this.store.save(this.getHistory());
        this.messageActions.saveAllMessages(this.messagesEl);
    }
}

function suggestionLabel(type) {
    return {
        income: 'Receita',
        expense: 'Gasto',
        debt: 'A Pagar',
        receivable: 'A Receber',
    }[type] || 'Item';
}
