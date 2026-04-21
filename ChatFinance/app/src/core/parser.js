import { norm } from '../shared/utils.js';

/* ─────────────────────────────────────────
   CATEGORIAS BASE
───────────────────────────────────────── */
const BASE_CATEGORIES = {
    ifood: 'Alimentacao',
    mercado: 'Alimentacao',
    restaurante: 'Alimentacao',
    uber: 'Transporte',
    gasolina: 'Transporte',
    aluguel: 'Moradia',
    luz: 'Contas',
    agua: 'Contas',
    internet: 'Contas',
    netflix: 'Contas',
    salario: 'Salario',
    freelance: 'Freelance',
};

/* ─────────────────────────────────────────
   INTENTS
───────────────────────────────────────── */
const INTENTS = {
    income: /\b(recebi|ganhei|entrou|pix recebido|caiu)\b/,
    expense: /\b(gastei|paguei|comprei|debito|pix enviado)\b/,
    debt: /\b(pagar|boleto|fatura|cartao|parcela)\b/,
    receivable: /\b(receber|me devem|vao pagar)\b/,
};

/* ─────────────────────────────────────────
   STOPWORDS
───────────────────────────────────────── */
const STOPWORDS = [
    'de','do','da','no','na','com','por','para','um','uma','o','a'
];

/* ─────────────────────────────────────────
   PARSER
───────────────────────────────────────── */
export class FinanceParser {

    parse(text) {
        const cleaned = norm(text);

        // comandos primeiro
        const cmd = this.detectCommand(cleaned);
        if (cmd) return cmd;

        // múltiplas transações
        const parts = this.splitTransactions(text);

        const results = parts.map(part => this.parseSingle(part));

        return results.length === 1 ? results[0] : {
            type: 'multi',
            items: results
        };
    }

    /* ───────────────────────────── */
    parseSingle(text) {
        const cleaned = norm(text);

        const value = this.extractValue(text);
        const type = this.detectIntent(cleaned, value);
        const category = this.detectCategory(cleaned);
        const date = this.extractDate(cleaned);

        if (!value && type?.startsWith('cmd_')) {
            return { type, raw: text };
        }

        if (!value) {
            return { type: 'no_value', raw: text };
        }

        return {
            type,
            value,
            category,
            date: date.format('YYYY-MM-DD'),
            description: this.buildDescription(text),
            raw: text
        };
    }

    /* ───────────────────────────── */
    detectIntent(text, value) {
        for (const [type, regex] of Object.entries(INTENTS)) {
            if (regex.test(text)) return type;
        }

        // inferência automática
        if (value) return 'expense';

        return 'unknown';
    }

    /* ───────────────────────────── */
    detectCategory(text) {
        const words = text.split(/\s+/);

        const learned = JSON.parse(localStorage.getItem('learnedCategories') || '{}');

        const scores = {};

        for (const word of words) {

            if (learned[word]) {
                return learned[word];
            }

            for (const [key, cat] of Object.entries(BASE_CATEGORIES)) {
                if (word.includes(key)) {
                    scores[cat] = (scores[cat] || 0) + 1;
                }
            }
        }

        const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

        return best ? best[0] : 'Geral';
    }

    /* ───────────────────────────── */
    extractValue(text) {

        // padrão 2x 50
        const multi = text.match(/(\d+)\s*x\s*(\d+)/i);
        if (multi) {
            return parseFloat(multi[1]) * parseFloat(multi[2]);
        }

        const source = text.replace(/R\$\s*/gi, '');

        const numbers = [];

        const regex = /\d+[.,]?\d*/g;
        let match;

        while ((match = regex.exec(source))) {
            const val = parseFloat(match[0].replace(',', '.'));
            if (!isNaN(val)) numbers.push(val);
        }

        if (!numbers.length) return null;

        return Math.max(...numbers);
    }

    /* ───────────────────────────── */
    extractDate(text) {
        if (text.includes('ontem')) return dayjs().subtract(1, 'day');
        if (text.includes('amanha')) return dayjs().add(1, 'day');
        if (text.includes('hoje')) return dayjs();

        return dayjs();
    }

    /* ───────────────────────────── */
    splitTransactions(text) {
        return text.split(/\s+e\s+|;/gi).map(t => t.trim()).filter(Boolean);
    }

    /* ───────────────────────────── */
    buildDescription(text) {

        let cleaned = text
            .replace(/R\$\s*[\d.,]+/gi, '')
            .replace(/\d+[.,]?\d*/g, '');

        const words = norm(cleaned).split(/\s+/);

        return words
            .filter(w => !STOPWORDS.includes(w))
            .join(' ')
            .trim() || '-';
    }

    /* ───────────────────────────── */
    detectCommand(text) {
        if (/\b(saldo|total)\b/.test(text)) return { type: 'cmd_summary' };
        if (/\b(ultimas?|recentes?)\b.*\b(transacoes|lancamentos)\b/.test(text)) return { type: 'cmd_recent' };
        if (/\b(apagar|deletar).*(ultimo)\b/.test(text)) return { type: 'cmd_delete_last' };
        if (/\b(ajuda|help)\b/.test(text)) return { type: 'cmd_help' };

        return null;
    }
}
