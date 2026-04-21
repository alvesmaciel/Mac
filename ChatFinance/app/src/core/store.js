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

    load() {
        try {
            const raw = localStorage.getItem(this._storageKey);
            if (!raw) return null;

            const data = JSON.parse(raw);
            this.balance      = data.balance      ?? 0;
            this.income       = data.income       ?? [];
            this.expenses     = data.expenses     ?? [];
            this.debts        = data.debts        ?? [];
            this.receivables  = data.receivables  ?? [];
            this.txIdCounter  = data.txIdCounter  ?? 0;
            return data;
        } catch (error) {
            console.warn('AutoFinance: erro ao carregar.', error);
            return null;
        }
    }

    save(chatHistory = []) {
        try {
            const payload = JSON.stringify({
                balance:      this.balance,
                income:       this.income,
                expenses:     this.expenses,
                debts:        this.debts,
                receivables:  this.receivables,
                txIdCounter:  this.txIdCounter,
                chatHistory,
            });
            localStorage.setItem(this._storageKey, payload);
            try { sessionStorage.setItem(this._storageKey + '_bak', payload); } catch (_) {}
        } catch (error) {
            console.warn('AutoFinance: erro ao salvar.', error);
        }
    }

    clear() {
        this.balance      = 0;
        this.income       = [];
        this.expenses     = [];
        this.debts        = [];
        this.receivables  = [];
        this.txIdCounter  = 0;
        localStorage.removeItem(this._storageKey);
        try { sessionStorage.removeItem(this._storageKey + '_bak'); } catch (_) {}
    }

    addTransaction(parsed) {
        const tx = {
            id:          this.nextId(),
            description: parsed.description,
            value:       parsed.value,
            category:    parsed.category,
            raw:         parsed.raw,
            date:        new Date().toISOString(),
        };

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
        }

        return tx;
    }

    deleteById(id, type) {
        const list = this.getTypeMap()[type];
        if (!list) return null;

        const index = list.findIndex(item => item.id === id);
        if (index === -1) return null;

        const [removed] = list.splice(index, 1);
        this.recalculateBalance();
        return removed;
    }

    deleteLastTransaction() {
        const all = this.getAllTransactions();
        if (!all.length) return null;

        const last    = all[all.length - 1];
        const removed = this.deleteById(last.id, last.type);
        return removed ? { ...removed, type: last.type } : null;
    }

    updateTransaction(id, newData) {
        const groups  = this.getTypeMap();
        let current   = null;

        for (const list of Object.values(groups)) {
            const index = list.findIndex(item => item.id === id);
            if (index !== -1) {
                current = list.splice(index, 1)[0];
                break;
            }
        }

        if (!current) return null;

        const updated = {
            ...current,
            description: newData.description,
            category:    newData.category,
            value:       parseFloat(newData.value) || 0,
        };

        groups[newData.type].push(updated);
        this.recalculateBalance();
        return updated;
    }

    recalculateBalance() {
        this.balance = round2(totalOf(this.income) - totalOf(this.expenses));
    }

    getTotals() {
        return {
            balance:     this.balance,
            income:      totalOf(this.income),
            expenses:    totalOf(this.expenses),
            debts:       totalOf(this.debts),
            receivables: totalOf(this.receivables),
        };
    }

    getMonthlyTotals() {
        const map = {};
        this.getAllTransactions().forEach(tx => {
            const key = (tx.date ?? '').slice(0, 7);
            if (!key) return;
            if (!map[key]) map[key] = { income: 0, expenses: 0 };
            if (tx.type === 'income')  map[key].income   = round2(map[key].income   + tx.value);
            if (tx.type === 'expense') map[key].expenses = round2(map[key].expenses + tx.value);
        });
        return map;
    }

    getCategoryTotals(type = null) {
        const map        = {};
        const candidates = type
            ? (this.getTypeMap()[type] ?? [])
            : [...this.expenses, ...this.debts];

        candidates.forEach(tx => {
            map[tx.category] = round2((map[tx.category] ?? 0) + tx.value);
        });
        return map;
    }

    getTransactionsByType(type) {
        return [...(this.getTypeMap()[type] ?? [])];
    }

    getRecentTransactions(limit = 5) {
        return this.getAllTransactions().slice(-limit).reverse();
    }

    getAllTransactions() {
        const withType = type => tx => ({ ...tx, type });
        return [
            ...this.income.map(withType('income')),
            ...this.expenses.map(withType('expense')),
            ...this.debts.map(withType('debt')),
            ...this.receivables.map(withType('receivable')),
        ].sort((a, b) => a.id - b.id);
    }

    hasTransactions() {
        return this.getAllTransactions().length > 0;
    }

    deleteTransactionById(id) {
    this.transactions = this.transactions.filter(tx => tx.id !== id);
    this.save();
}

    getTypeMap() {
        return {
            income:     this.income,
            expense:    this.expenses,
            debt:       this.debts,
            receivable: this.receivables,
        };
    }
}