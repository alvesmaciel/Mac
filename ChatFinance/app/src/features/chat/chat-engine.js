import { FinanceParser } from '../../core/parser.js';

export class ChatEngine {
    constructor({ onAddTransaction, onDeleteLast, onSummary }) {
        this.parser = new FinanceParser();
        this.history = [];

        this.onAddTransaction = onAddTransaction;
        this.onDeleteLast = onDeleteLast;
        this.onSummary = onSummary;
    }

    async handle(input) {
        const parsed = this.parser.parse(input);

        this.history.push({ role: 'user', text: input });

        let response;

        if (parsed.type === 'multi') {
            response = this.handleMultiple(parsed.items);
        } else {
            response = this.handleSingle(parsed);
        }

        this.history.push({ role: 'bot', text: response.text });

        return response;
    }

    handleSingle(data) {

        if (data.type?.startsWith('cmd_')) {
            return this.handleCommand(data);
        }

        if (data.type === 'no_value') {
            return this.reply("Não consegui identificar o valor.");
        }

        if (data.type === 'unknown') {
            return this.reply("Não entendi 🤔 Tenta: 'gastei 30 no uber'");
        }

        this.onAddTransaction?.(data);

        return this.smartReply(data);
    }

    handleMultiple(items) {
        items.forEach(item => this.onAddTransaction?.(item));

        const total = items.reduce((s, i) => s + i.value, 0);

        return this.reply(
            `Registrei ${items.length} transações (R$ ${total.toFixed(2)})`
        );
    }

    handleCommand(cmd) {
        switch (cmd.type) {

            case 'cmd_summary':
                const summary = this.onSummary?.();
                return this.reply(`Saldo: R$ ${summary?.balance ?? 0}`);

            case 'cmd_delete_last':
                this.onDeleteLast?.();
                return this.reply("Última removida.");

            case 'cmd_help':
                return this.reply("Ex: 'gastei 50 no mercado'");

            default:
                return this.reply("Comando não reconhecido.");
        }
    }

    smartReply(data) {

        const value = `R$ ${data.value.toFixed(2)}`;

        const variations = {
            expense: [
                `Registrei ${value} em ${data.category}`,
                `${value} gasto anotado`,
            ],
            income: [
                `Entrou ${value} 💰`,
                `${value} recebido`,
            ]
        };

        const list = variations[data.type] || [`Registrei ${value}`];

        return this.reply(list[Math.floor(Math.random() * list.length)]);
    }

    reply(text) {
        return { text };
    }
}