import { round2, totalOf } from '../shared/utils.js';

const DEFAULT_KEY = 'autofinance_v3';

export class FinanceStore {
    constructor(storageKey = DEFAULT_KEY) {
        this._storageKey = storageKey;
        this.balance = 0;
        this.income = [];
        this.expenses = [];
        this.debts = [];
        this.receivables = [];
        this.txIdCounter = 0;
    }

    nextId() {
        this.txIdCounter += 1;
        return this.txIdCounter;
    }

    normalizeTransaction(tx, type) {
        const timestamp = tx.timestamp ?? (tx.date ? new Date(tx.date).getTime() : Date.now());
        return {
            ...tx,
            type: tx.type || type,
            timestamp,
            date: tx.date || new Date(timestamp).toISOString().slice(0, 10),
        };
    }

    load() {
        try {
            const raw = localStorage.getItem(this._storageKey);
            if (!raw) return null;

            const data = JSON.parse(raw);
            this.balance = data.balance ?? 0;
            this.income = (data.income ?? []).map((tx) => this.normalizeTransaction(tx, 'income'));
            this.expenses = (data.expenses ?? []).map((tx) => this.normalizeTransaction(tx, 'expense'));
            this.debts = (data.debts ?? []).map((tx) => this.normalizeTransaction(tx, 'debt'));
            this.receivables = (data.receivables ?? []).map((tx) => this.normalizeTransaction(tx, 'receivable'));
            this.txIdCounter = data.txIdCounter ?? 0;
            this.recalculateBalance();
            return data;
        } catch (error) {
            console.warn('AutoFinance: erro ao carregar.', error);
            return null;
        }
    }

    save(chatHistory = []) {
        try {
            const payload = JSON.stringify({
                balance: this.balance,
                income: this.income,
                expenses: this.expenses,
                debts: this.debts,
                receivables: this.receivables,
                txIdCounter: this.txIdCounter,
                chatHistory,
            });
            localStorage.setItem(this._storageKey, payload);
            try {
                sessionStorage.setItem(`${this._storageKey}_bak`, payload);
            } catch (_) {}
        } catch (error) {
            console.warn('AutoFinance: erro ao salvar.', error);
        }
    }

    clear() {
        this.balance = 0;
        this.income = [];
        this.expenses = [];
        this.debts = [];
        this.receivables = [];
        this.txIdCounter = 0;
        localStorage.removeItem(this._storageKey);
        try {
            sessionStorage.removeItem(`${this._storageKey}_bak`);
        } catch (_) {}
    }

    addTransaction(parsed) {
        const timestamp = parsed.timestamp ?? (parsed.date ? new Date(parsed.date).getTime() : Date.now());
        const tx = this.normalizeTransaction({
            id: this.nextId(),
            description: parsed.description || '-',
            value: Number(parsed.value) || 0,
            category: parsed.category || 'Geral',
            raw: parsed.raw || parsed.description || '',
            timestamp,
            date: parsed.date || new Date(timestamp).toISOString().slice(0, 10),
            isRecurring: parsed.isRecurring || false,
            recurringRuleId: parsed.recurringRuleId || null,
        }, parsed.type);

        switch (parsed.type) {
            case 'income':
                this.income.push(tx);
                this.balance = round2(this.balance + tx.value);
                break;
            case 'expense':
                this.expenses.push(tx);
                this.balance = round2(this.balance - tx.value);
                break;
            case 'debt':
                this.debts.push(tx);
                break;
            case 'receivable':
                this.receivables.push(tx);
                break;
            default:
                return null;
        }

        return tx;
    }

    deleteById(id, type) {
        const list = this.getTypeMap()[type];
        if (!list) return null;

        const index = list.findIndex((item) => Number(item.id) === Number(id));
        if (index === -1) return null;

        const [removed] = list.splice(index, 1);
        this.recalculateBalance();
        return removed;
    }

    deleteTransactionById(id) {
        for (const [type, list] of Object.entries(this.getTypeMap())) {
            const index = list.findIndex((item) => Number(item.id) === Number(id));
            if (index !== -1) {
                const [removed] = list.splice(index, 1);
                this.recalculateBalance();
                return { ...removed, type };
            }
        }
        return null;
    }

    deleteLastTransaction() {
        const all = this.getAllTransactions();
        if (!all.length) return null;
        const last = all[all.length - 1];
        return this.deleteById(last.id, last.type);
    }

    updateTransaction(id, newData) {
        const groups = this.getTypeMap();
        let current = null;

        for (const list of Object.values(groups)) {
            const index = list.findIndex((item) => Number(item.id) === Number(id));
            if (index !== -1) {
                current = list.splice(index, 1)[0];
                break;
            }
        }

        if (!current || !groups[newData.type]) return null;

        const updated = this.normalizeTransaction({
            ...current,
            type: newData.type,
            description: newData.description,
            category: newData.category,
            value: Number(newData.value) || 0,
        }, newData.type);

        groups[newData.type].push(updated);
        this.recalculateBalance();
        return updated;
    }

    recalculateBalance() {
        this.balance = round2(totalOf(this.income) - totalOf(this.expenses));
    }

    getTotals() {
        return {
            balance: this.balance,
            income: totalOf(this.income),
            expenses: totalOf(this.expenses),
            debts: totalOf(this.debts),
            receivables: totalOf(this.receivables),
        };
    }

    getMonthlyTotals() {
        const map = {};
        this.getAllTransactions().forEach((tx) => {
            const key = (tx.date || '').slice(0, 7);
            if (!key) return;
            if (!map[key]) map[key] = { income: 0, expenses: 0 };
            if (tx.type === 'income') map[key].income = round2(map[key].income + tx.value);
            if (tx.type === 'expense') map[key].expenses = round2(map[key].expenses + tx.value);
        });
        return map;
    }

    getCategoryTotals(type = null) {
        const map = {};
        const candidates = type ? (this.getTypeMap()[type] ?? []) : [...this.expenses, ...this.debts];

        candidates.forEach((tx) => {
            map[tx.category] = round2((map[tx.category] ?? 0) + tx.value);
        });
        return map;
    }

    getTransactionsByType(type) {
        return [...(this.getTypeMap()[type] ?? [])];
    }

    getRecentTransactions(limit = 5) {
        return this.getAllTransactions()
            .slice()
            .sort((a, b) => b.timestamp - a.timestamp || b.id - a.id)
            .slice(0, limit);
    }

    getAllTransactions() {
        const withType = (type) => (tx) => this.normalizeTransaction({ ...tx, type }, type);
        return [
            ...this.income.map(withType('income')),
            ...this.expenses.map(withType('expense')),
            ...this.debts.map(withType('debt')),
            ...this.receivables.map(withType('receivable')),
        ].sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);
    }

    hasTransactions() {
        return this.getAllTransactions().length > 0;
    }

    getTypeMap() {
        return {
            income: this.income,
            expense: this.expenses,
            debt: this.debts,
            receivable: this.receivables,
        };
    }
}
