import { escHtml, formatBRL, norm } from '../../shared/utils.js';
import { messageActions } from './message-actions.js';
import { conversationContext } from './conversation-context.js';
import { typingEffects } from './typing-effects.js';

const BASE_SUGGESTIONS = [
    { prefix: 'rec', full: 'recebi ', type: 'income', label: 'Receita', detail: 'Registrar entrada de dinheiro' },
    { prefix: 'ganh', full: 'ganhei ', type: 'income', label: 'Receita', detail: 'Salario, venda ou freelance' },
    { prefix: 'entr', full: 'entrada de ', type: 'income', label: 'Receita', detail: 'Lancar entrada manual' },
    { prefix: 'gast', full: 'gastei ', type: 'expense', label: 'Gasto', detail: 'Registrar despesa ja paga' },
    { prefix: 'comp', full: 'comprei ', type: 'expense', label: 'Gasto', detail: 'Compra imediata' },
    { prefix: 'desp', full: 'despesa de ', type: 'expense', label: 'Gasto', detail: 'Lancar despesa por categoria' },
    { prefix: 'pag', full: 'pagar ', type: 'debt', label: 'A Pagar', detail: 'Conta pendente ou boleto' },
    { prefix: 'bol', full: 'boleto ', type: 'debt', label: 'A Pagar', detail: 'Lancamento de boleto' },
    { prefix: 'vou', full: 'vou receber ', type: 'receivable', label: 'A Receber', detail: 'Valor esperado' },
    { prefix: 'sal', full: 'saldo', type: 'command', label: 'Resumo', detail: 'Ver consolidado financeiro' },
    { prefix: 'ult', full: 'ultimas transacoes', type: 'command', label: 'Recentes', detail: 'Ver ultimos lancamentos' },
    { prefix: 'list', full: 'listar gastos', type: 'command', label: 'Lista', detail: 'Filtrar gastos no chat' },
    { prefix: 'aju', full: 'ajuda', type: 'command', label: 'Ajuda', detail: 'Ver exemplos de uso' },
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
    onStateChange,

    // 🔥 NOVO
    categorizer,
    duplicateDetector,
    alerts,
    autoCorrection,
    recurringDetector,
    smartReply
}) {
    this.parser = parser;
    this.store = store;
    this.onStateChange = onStateChange;

    this.messagesEl = document.getElementById('chatMessages');
    this.inputEl = document.getElementById('chatInput');
    this.sendButton = document.getElementById('sendBtn');
    this.clearButton = document.getElementById('clearChatBtn');
    this.autocompleteEl = document.getElementById('autocompleteBox');

    this.acVisible = [];
    this.acSelected = -1;

    // 🧠 AUTOMAÇÕES (ESSENCIAL)
    this.categorizer = categorizer;
    this.duplicateDetector = duplicateDetector;
    this.smartAlerts = alerts;
    this.autoCorrection = autoCorrection;
    this.recurringDetector = recurringDetector;
    this.smartReply = smartReply;

    // 🆕 módulos UI
    this.messageActions = messageActions;
    this.conversationContext = conversationContext;
    this.typingEffects = typingEffects;
    this.isTyping = false;
}

    bind() {
        this.inputEl.addEventListener('input', () => this.updateAutocomplete(this.inputEl.value));
        this.inputEl.addEventListener('keydown', (event) => this.handleKeyDown(event));
        this.inputEl.addEventListener('blur', () => setTimeout(() => this.hideAutocomplete(), 150));
        this.sendButton.addEventListener('click', () => this.handleSend());
        this.clearButton.addEventListener('click', () => this.handleClearChat());

        // 🆕 Restaura histórico de mensagens
        this.messageActions.restoreMessages(this.messagesEl);
        this.conversationContext.restore();
    }

    renderWelcome() {
        this.messagesEl.innerHTML = `
            <div class="msg msg--system">
                <div class="msg-bubble">
                    Ola! Conte suas financas em linguagem natural.<br>
                    <br>
                    <span class="hint">Digite "Ajuda" para prosseguir!</span><br>
                    <br>
                    <span class="hint" style="color:var(--ink-faint)">Tambem posso mostrar saldo, gastos e ultimas transacoes</span>
                </div>
            </div>
        `;
    }

    getHistory() {
        return Array.from(this.messagesEl.querySelectorAll('.msg')).map((message) => ({
            cls: message.className,
            html: message.querySelector('.msg-bubble')?.innerHTML ?? '',
        }));
    }

    restoreHistory(history) {
        if (!Array.isArray(history) || !history.length) return;
        this.messagesEl.innerHTML = '';

        history.forEach(({ cls, html }) => {
            const message = document.createElement('div');
            message.className = cls;
            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble';
            bubble.innerHTML = html;
            message.appendChild(bubble);
            this.messagesEl.appendChild(message);
        });

        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    addBubble(html, cls) {
        // 🆕 Usa messageActions para criar bubble com ID
        const { element: message, id: messageId } = this.messageActions.createMessageBubble(html, cls.includes('msg--user') ? 'user' : 'response');
        message.className = `msg ${cls}`;

        this.messagesEl.appendChild(message);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

        return message;
    }

    buildResponse(parsed) {
        const description = parsed.description && parsed.description !== '-'
            ? `<br><span style="opacity:.6;font-size:.73rem">Detalhe: ${escHtml(parsed.description)}</span>`
            : '';

        switch (parsed.type) {
            case 'income':
                return { html: `Receita registrada.<br>Valor: <strong>${formatBRL(parsed.value)}</strong> | ${parsed.category}${description}`, cls: 'msg--response type-income' };
            case 'expense':
                return { html: `Gasto registrado.<br>Valor: <strong>${formatBRL(parsed.value)}</strong> | ${parsed.category}${description}`, cls: 'msg--response type-expense' };
            case 'debt':
                return { html: `Conta a pagar adicionada.<br>Valor: <strong>${formatBRL(parsed.value)}</strong> | ${parsed.category}${description}`, cls: 'msg--response type-debt' };
            case 'receivable':
                return { html: `Valor a receber registrado.<br>Valor: <strong>${formatBRL(parsed.value)}</strong> | ${parsed.category}${description}`, cls: 'msg--response type-receivable' };
            case 'no_value': {
                const names = { income: 'receita', expense: 'gasto', debt: 'conta a pagar', receivable: 'valor a receber' };
                return {
                    html: `Parece uma <strong>${names[parsed.intentType] ?? 'transacao'}</strong>, mas faltou o valor.<br><span class="hint">Ex: "${escHtml(parsed.raw)} 500"</span>`,
                    cls: 'msg--response type-unknown',
                };
            }
            case 'only_value':
                return {
                    html: `Achei o valor <strong>${formatBRL(parsed.value)}</strong>, mas faltou o tipo.<br><span class="hint">"recebi ${parsed.value}"</span> | <span class="hint">"gastei ${parsed.value}"</span>`,
                    cls: 'msg--response type-unknown',
                };
            case 'cmd_summary': {
                const totals = this.store.getTotals();
                const color = totals.balance >= 0 ? 'var(--green)' : 'var(--red)';
                return {
                    html: `Resumo atual.<br>Saldo: <strong style="color:${color}">${formatBRL(totals.balance)}</strong><br>Recebido: ${formatBRL(totals.income)} | Gasto: ${formatBRL(totals.expenses)}<br>A pagar: ${formatBRL(totals.debts)} | A receber: ${formatBRL(totals.receivables)}`,
                    cls: 'msg--response type-income',
                };
            }
            case 'cmd_recent':
                return {
                    html: this.buildListResponse('Ultimas transacoes', this.store.getRecentTransactions(5)),
                    cls: 'msg--response type-unknown',
                };
            case 'cmd_list_expenses':
                return {
                    html: this.buildListResponse('Gastos', this.store.getTransactionsByType('expense')),
                    cls: 'msg--response type-expense',
                };
            case 'cmd_list_income':
                return {
                    html: this.buildListResponse('Receitas', this.store.getTransactionsByType('income')),
                    cls: 'msg--response type-income',
                };
            case 'cmd_list_debts':
                return {
                    html: this.buildListResponse('A pagar', this.store.getTransactionsByType('debt')),
                    cls: 'msg--response type-debt',
                };
            case 'cmd_list_receivables':
                return {
                    html: this.buildListResponse('A receber', this.store.getTransactionsByType('receivable')),
                    cls: 'msg--response type-receivable',
                };
            case 'cmd_delete_last': {
                const removed = this.store.deleteLastTransaction();
                if (!removed) return { html: 'Nenhuma transacao para remover.', cls: 'msg--response type-unknown' };
                this.onStateChange();
                return { html: `Ultima transacao removida: <strong>${formatBRL(removed.value)}</strong> (${escHtml(removed.description)})`, cls: 'msg--response type-unknown' };
            }
            case 'cmd_help':
                return {
                    html: `
                        <strong>Exemplos:</strong><br>
                        <span class="hint">"recebi 1443,13 salario"</span><br>
                        <span class="hint">"ganhei 300 freelance"</span><br>
                        <span class="hint">"gastei 89,90 comida"</span><br>
                        <span class="hint">"comprei roupa 250"</span><br>
                        <span class="hint">"pagar aluguel 1200"</span><br>
                        <span class="hint">"boleto luz 87,50"</span><br>
                        <span class="hint">"vou receber 500"</span><br>
                        <span class="hint">"saldo"</span><br>
                        <span class="hint">"ultimas transacoes"</span><br>
                        <span class="hint">"listar gastos"</span>
                    `,
                    cls: 'msg--response type-unknown',
                };
            default:
                return { html: 'Nao entendi. Digite <span class="hint">"ajuda"</span> para ver exemplos.', cls: 'msg--response type-unknown' };
        }
    }

    buildListResponse(title, items) {
        if (!items.length) {
            return `<strong>${title}:</strong><br><span class="hint">Nenhum item encontrado.</span>`;
        }

        const content = items
            .slice()
            .reverse()
            .slice(0, 5)
            .map((item) => `- ${formatBRL(item.value)} | ${escHtml(item.category)}${item.description && item.description !== '-' ? ` <span style="opacity:.65">(${escHtml(item.description)})</span>` : ''}`)
            .join('<br>');

        return `<strong>${title}:</strong><br>${content}`;
    }

    

    handleSend() {
    const text = this.inputEl.value.trim();
    if (!text || this.isTyping) return;

    this.hideAutocomplete();

    // ✅ limpa IMEDIATO (resolve bug visual)
    this.inputEl.value = '';
    this.inputEl.focus();

    // 👤 mensagem do usuário
    const userMsg = this.addBubble(escHtml(text), 'msg--user');
    this.typingEffects.fadeInMessage(userMsg);

    this.conversationContext.addMessage('user', text);

    try {
        // ✏️ AUTO CORRECTION
        const corrected = this.autoCorrection?.correct
            ? this.autoCorrection.correct(text)
            : text;

        // 🧠 PARSE
        const parsed = this.parser.parse(corrected);

        if (!parsed) {
            this.addBubble("Não entendi. Digite 'ajuda'", 'msg--response type-unknown');
            return;
        }

        // 🏷️ AUTO CATEGORIZAÇÃO
        if (parsed.description && this.categorizer) {
            const suggestion = this.categorizer.suggestCategory(parsed.description, parsed.type);
            if (suggestion?.category) {
                parsed.category = suggestion.category;
            }
        }

        // 🔍 DUPLICATE DETECTOR
        const duplicate = this.duplicateDetector?.checkDuplicate
            ? this.duplicateDetector.checkDuplicate(parsed)
            : null;

        if (duplicate) {
            this.addBubble(
    `⚠️ Possível duplicata (${duplicate.similarity}%)`,
    'msg--response type-unknown'
);
        }

        // 💾 SALVAR + ATUALIZAR DASHBOARD
        if (['income', 'expense', 'debt', 'receivable'].includes(parsed.type) && parsed.value) {
            const tx = this.store.addTransaction(parsed);

// 🔥 vincula mensagem com transação
this.messageActions.linkTransactionToMessage(userMsg, tx.id);
            this.onStateChange?.();
        }

        // 🔔 ALERTAS
        const alerts = this.smartAlerts?.runChecks
            ? this.smartAlerts.runChecks(parsed)
            : [];

        alerts.forEach(a => {
            this.addBubble(`⚠️ ${a.message}`, 'msg--response type-unknown');
        });

        // 🔁 RECORRÊNCIA
        this.recurringDetector?.analyze?.(parsed);

        // 🤖 RESPOSTA
        const response = this.buildResponse(parsed);

        this.isTyping = true;
        const typingIndicator = this.typingEffects.showTypingIndicator(this.messagesEl);

        setTimeout(async () => {
            this.typingEffects.removeTypingIndicator(typingIndicator);

            await this.typingEffects.typeMessage(
    this.messagesEl,
    response.html,
    20
);  

            this.conversationContext.addMessage('bot', response.html);

            this.isTyping = false;
            this.persist();
        }, 300);

    } catch (err) {
        console.error("Erro no chat:", err);
        this.addBubble("⚠️ Erro ao processar mensagem.");
    }
}

    handleClearChat() {
        if (!confirm('Limpar apenas o historico do chat?')) return;
        this.renderWelcome();
        this.messageActions.clearAll(this.messagesEl);
        this.conversationContext.newConversation();
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

            if (score >= 0) {
                scored.push({ ...suggestion, score });
            }
        });

        const rawNumber = rawValue.match(/\d[\d.,]*/)?.[0];
        if (rawNumber) {
            [
                { full: `recebi ${rawNumber} `, type: 'income', label: 'Receita', detail: 'Transformar valor em receita', score: 115 },
                { full: `gastei ${rawNumber} `, type: 'expense', label: 'Gasto', detail: 'Transformar valor em gasto', score: 114 },
                { full: `pagar ${rawNumber} `, type: 'debt', label: 'A Pagar', detail: 'Transformar valor em conta', score: 113 },
            ].forEach((item) => scored.push(item));
        }

        const history = this.store.getAllTransactions().slice(-25).reverse();
        const seen = new Set(scored.map((item) => norm(item.full)));
        for (const tx of history) {
            const normalizedRaw = norm(tx.raw);
            if (seen.has(normalizedRaw) || !normalizedRaw.includes(normalized)) continue;
            seen.add(normalizedRaw);
            scored.push({
                full: tx.raw,
                type: tx.type,
                label: suggestionLabel(tx.type),
                detail: `${tx.category} | ${formatBRL(tx.value)}`,
                history: true,
                score: 80,
            });
        }

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

        if (event.key === 'Enter') this.handleSend();
    }

    persist() {
        this.store.save(this.getHistory());
        // 🆕 Persiste também as mensagens com ID
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


