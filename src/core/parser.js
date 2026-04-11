import { norm } from '../shared/utils.js';

const CATEGORIES = {
    alimento: 'Alimentacao',
    alimentos: 'Alimentacao',
    comida: 'Alimentacao',
    restaurante: 'Alimentacao',
    lanche: 'Alimentacao',
    mercado: 'Alimentacao',
    supermercado: 'Alimentacao',
    padaria: 'Alimentacao',
    cafe: 'Alimentacao',
    pizza: 'Alimentacao',
    hamburguer: 'Alimentacao',
    marmita: 'Alimentacao',
    feira: 'Alimentacao',
    ifood: 'Alimentacao',
    rappi: 'Alimentacao',
    delivery: 'Alimentacao',
    almoco: 'Alimentacao',
    jantar: 'Alimentacao',
    janta: 'Alimentacao',
    aluguel: 'Aluguel',
    condominio: 'Moradia',
    iptu: 'Moradia',
    reforma: 'Moradia',
    transporte: 'Transporte',
    uber: 'Transporte',
    gasolina: 'Transporte',
    combustivel: 'Transporte',
    carro: 'Transporte',
    onibus: 'Transporte',
    metro: 'Transporte',
    estacionamento: 'Transporte',
    pedagio: 'Transporte',
    moto: 'Transporte',
    taxi: 'Transporte',
    passagem: 'Transporte',
    brt: 'Transporte',
    lazer: 'Lazer',
    cinema: 'Lazer',
    show: 'Lazer',
    festa: 'Lazer',
    bar: 'Lazer',
    balada: 'Lazer',
    game: 'Lazer',
    jogo: 'Lazer',
    hobby: 'Lazer',
    passeio: 'Lazer',
    viagem: 'Viagem',
    hotel: 'Viagem',
    pousada: 'Viagem',
    airbnb: 'Viagem',
    saude: 'Saude',
    medico: 'Saude',
    remedio: 'Saude',
    farmacia: 'Saude',
    academia: 'Saude',
    hospital: 'Saude',
    dentista: 'Saude',
    exame: 'Saude',
    plano: 'Saude',
    salario: 'Salario',
    freelance: 'Freelance',
    investimento: 'Investimento',
    dividendo: 'Investimento',
    dividendos: 'Investimento',
    bonus: 'Bonus',
    decimo: 'Bonus',
    conta: 'Contas',
    luz: 'Contas',
    energia: 'Contas',
    agua: 'Contas',
    internet: 'Contas',
    telefone: 'Contas',
    celular: 'Contas',
    streaming: 'Contas',
    netflix: 'Contas',
    spotify: 'Contas',
    amazon: 'Contas',
    educacao: 'Educacao',
    escola: 'Educacao',
    faculdade: 'Educacao',
    curso: 'Educacao',
    livro: 'Educacao',
    material: 'Educacao',
    roupa: 'Vestuario',
    vestuario: 'Vestuario',
    sapato: 'Vestuario',
    tenis: 'Vestuario',
    pet: 'Pet',
    vet: 'Pet',
    veterinario: 'Pet',
    racao: 'Pet',
};

const INTENT_GROUPS = [
    {
        type: 'receivable',
        patterns: [/\bvou\s+receber\b/, /\bvou\s+ganhar\b/, /\bespero\s+receber\b/, /\ba\s+receber\b/, /\btenho\s+a\s+receber\b/, /\bme\s+devem\b/, /\bme\s+pagam\b/, /\bvao\s+me\s+pagar\b/, /\bestou\s+para\s+receber\b/, /\btenho\s+um\s+pix\s+para\s+receber\b/, /\bvalor\s+a\s+receber\b/],
        skip: ['vou', 'receber', 'ganhar', 'espero', 'a', 'tenho', 'me', 'devem', 'pagam', 'vao', 'pagar', 'estou', 'para', 'um', 'pix', 'valor'],
    },
    {
        type: 'income',
        patterns: [/\brecebi\b/, /\bganhei\b/, /\bentrou\b/, /\bdepositaram\b/, /\bme\s+pagaram\b/, /\bme\s+depositaram\b/, /\bcaiu\s+na\s+conta\b/, /\bcaiu\b/, /\bvendi\b/, /\bfiz\s+uma?\s+venda\b/, /\brecebimento\b/, /\bentrada\s+de\b/, /\bentrou\s+um\s+pix\b/, /\breceita\s+de\b/, /\bme\s+fizeram\s+um\s+pix\b/, /\bpix\s+recebido\b/],
        skip: ['recebi', 'ganhei', 'entrou', 'depositaram', 'me', 'pagaram', 'caiu', 'na', 'conta', 'vendi', 'fiz', 'uma', 'venda', 'recebimento', 'entrada', 'de', 'um', 'pix', 'receita', 'fizeram', 'recebido'],
    },
    {
        type: 'expense',
        patterns: [/\bgastei\b/, /\bpaguei\b/, /\bcomprei\b/, /\bsaiu\b/, /\bgasto\s+de\b/, /\btirei\s+da\s+conta\b/, /\bdebitou\b/, /\bdesembolsei\b/, /\bfiz\s+um\s+gasto\b/, /\bdespesa\s+de\b/, /\bgastei\s+com\b/, /\bpaguei\s+por\b/, /\bsaida\s+de\b/, /\bpix\s+enviado\b/],
        skip: ['gastei', 'paguei', 'comprei', 'saiu', 'gasto', 'de', 'tirei', 'da', 'conta', 'debitou', 'desembolsei', 'fiz', 'um', 'despesa', 'com', 'por', 'saida', 'pix', 'enviado'],
    },
    {
        type: 'debt',
        patterns: [/\btenho\s+que\s+pagar\b/, /\bpreciso\s+pagar\b/, /\bdevo\s+pagar\b/, /\bdevo\b/, /\bpagar\b/, /\bboleto\b/, /\bparcela\b/, /\bprestacao\b/, /\bvence\b/, /\bvencimento\b/, /\bconta\s+a\s+pagar\b/, /\bemprestimo\b/, /\bfinanciamento\b/, /\bcartao\b/, /\bfatura\b/, /\bparcelei\b/, /\btenho\s+uma\s+conta\b/, /\bconta\s+pendente\b/, /\bconta\s+para\s+pagar\b/],
        skip: ['pagar', 'tenho', 'que', 'preciso', 'devo', 'boleto', 'parcela', 'prestacao', 'vence', 'emprestimo', 'financiamento', 'cartao', 'fatura', 'parcelei', 'uma', 'conta', 'pendente', 'para'],
    },
];

export class FinanceParser {
    parse(text) {
        const lower = norm(text);
        const management = this.detectManagement(lower);
        if (management) return management;

        for (const group of INTENT_GROUPS) {
            if (group.patterns.some((pattern) => pattern.test(lower))) {
                const value = this.extractValue(text);
                if (!value) return { type: 'no_value', intentType: group.type, raw: text };

                return {
                    type: group.type,
                    value,
                    description: this.buildDescription(text, group.skip),
                    category: this.detectCategory(text),
                    raw: text,
                };
            }
        }

        const onlyValue = this.extractValue(text);
        if (onlyValue && /^[\sR$\d.,]+$/.test(text.trim())) {
            return { type: 'only_value', value: onlyValue, raw: text };
        }

        return { type: 'unknown', raw: text };
    }

    detectManagement(lower) {
        if (/\b(apagar|deletar|remover|excluir)\b.*(ultimo|last)\b/.test(lower)) return { type: 'cmd_delete_last' };
        if (/\b(saldo|total|resumo|quanto\s+tenho)\b/.test(lower)) return { type: 'cmd_summary' };
        if (/\b(ajuda|help|como\s+usar|exemplos|comandos)\b/.test(lower)) return { type: 'cmd_help' };
        if (/\b(ultimas|ultimos|recentes)\b.*\b(transacoes|lancamentos)\b|\b(transacoes|lancamentos)\b.*\b(recentes)\b|\bo\s+que\s+eu\s+lancei\s+por\s+ultimo\b/.test(lower)) return { type: 'cmd_recent' };
        if (/\b(listar|mostrar|ver|quais\s+sao|me\s+mostra)\b.*\b(gastos|despesas)\b|\bmeus\s+(gastos|despesas)\b/.test(lower)) return { type: 'cmd_list_expenses' };
        if (/\b(listar|mostrar|ver|quais\s+sao|me\s+mostra)\b.*\b(receitas|ganhos|entradas)\b|\bminhas\s+(receitas|entradas)\b/.test(lower)) return { type: 'cmd_list_income' };
        if (/\b(listar|mostrar|ver|quais\s+sao|me\s+mostra)\b.*\b(a pagar|dividas|boletos)\b|\bo\s+que\s+tenho\s+para\s+pagar\b/.test(lower)) return { type: 'cmd_list_debts' };
        if (/\b(listar|mostrar|ver|quais\s+sao|me\s+mostra)\b.*\b(a receber|recebiveis)\b|\bo\s+que\s+tenho\s+para\s+receber\b/.test(lower)) return { type: 'cmd_list_receivables' };
        return null;
    }

    detectCategory(text) {
        const words = norm(text).split(/[\s,.\-_/]+/);

        for (const word of words) {
            if (CATEGORIES[word]) return CATEGORIES[word];
        }

        for (const word of words) {
            if (word.length < 4) continue;
            for (const [key, category] of Object.entries(CATEGORIES)) {
                if (key.length >= 4 && word.includes(key)) return category;
            }
        }

        return 'Geral';
    }

    extractValue(text) {
        const source = text.replace(/R\$\s*/gi, '').replace(/reais/gi, '');
        const found = [];

        const ptBr = /\b(\d[\d.]*),(\d{1,2})\b/g;
        let match;
        while ((match = ptBr.exec(source)) !== null) {
            const integer = match[1].replace(/\./g, '');
            const value = parseFloat(integer + '.' + match[2]);
            if (!Number.isNaN(value)) found.push(value);
        }

        const enUs = /\b(\d[\d,]*)\.(\d{1,2})(?!\d)\b/g;
        while ((match = enUs.exec(source)) !== null) {
            const integer = match[1].replace(/,/g, '');
            const value = parseFloat(integer + '.' + match[2]);
            if (!Number.isNaN(value)) found.push(value);
        }

        if (found.length) return Math.max(...found);

        const thousand = /\b(\d{1,3}(?:\.\d{3})+)\b/g;
        while ((match = thousand.exec(source)) !== null) {
            found.push(parseFloat(match[1].replace(/\./g, '')));
        }
        if (found.length) return Math.max(...found);

        const integer = /\b(\d+)\b/g;
        while ((match = integer.exec(source)) !== null) {
            found.push(parseFloat(match[1]));
        }
        if (found.length) return Math.max(...found);

        return null;
    }

    buildDescription(text, skipWords = []) {
        let description = text
            .replace(/R\$\s*[\d.,]+/gi, '')
            .replace(/\b\d[\d.,]*\b/g, '')
            .replace(/\breais\b/gi, '');

        if (skipWords.length) {
            const escaped = skipWords.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            description = description.replace(new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi'), '');
        }

        return description
            .replace(/\s{2,}/g, ' ')
            .replace(/^[\s,.\-:]+|[\s,.\-:]+$/g, '')
            .trim() || '-';
    }
}
