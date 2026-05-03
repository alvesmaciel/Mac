import { escHtml, formatBRL, norm } from '../../shared/utils.js';

export class TransactionsTable {
    constructor({ onDelete, onUpdate }) {
        this.onDelete = onDelete;
        this.onUpdate = onUpdate;
        this.tbody = document.getElementById('txTableBody');
        this.emptyRow = document.getElementById('emptyRow');
        this.searchInput = document.getElementById('txSearchInput');
        this.filterSelect = document.getElementById('txFilterSelect');
        this.sortSelect = document.getElementById('txSortSelect');
        this.transactions = [];
        this.bindControls();
    }

    bindControls() {
        [this.searchInput, this.filterSelect, this.sortSelect].forEach((control) => {
            control?.addEventListener('input', () => this.render(this.transactions));
            control?.addEventListener('change', () => this.render(this.transactions));
        });
    }

    render(transactions) {
        this.transactions = [...transactions];
        const visibleTransactions = this.getVisibleTransactions();

        [...this.tbody.querySelectorAll('tr:not(#emptyRow)')].forEach((row) => row.remove());

        if (!visibleTransactions.length) {
            this.emptyRow.style.display = '';
            return;
        }

        this.emptyRow.style.display = 'none';

        visibleTransactions.forEach((tx) => {
            const tr = document.createElement('tr');
            const displayDate = new Date(tx.timestamp || tx.date || Date.now()).toLocaleDateString('pt-BR');

            tr.innerHTML = `
                <td class="tx-cell--type">
                    <select class="edit-type type-${tx.type}" data-id="${tx.id}">
                        <option value="income" ${tx.type === 'income' ? 'selected' : ''}>Receita</option>
                        <option value="expense" ${tx.type === 'expense' ? 'selected' : ''}>Gasto</option>
                        <option value="debt" ${tx.type === 'debt' ? 'selected' : ''}>A Pagar</option>
                        <option value="receivable" ${tx.type === 'receivable' ? 'selected' : ''}>A Receber</option>
                    </select>
                </td>
                <td><span class="tx-date-badge">${displayDate}</span></td>
                <td><input class="edit-desc" data-id="${tx.id}" value="${escHtml(tx.description)}"></td>
                <td><input class="edit-cat" data-id="${tx.id}" value="${escHtml(tx.category)}"></td>
                <td class="tx-cell--amount">
                    <input class="edit-val" data-id="${tx.id}" value="${tx.value}">
                    <span class="tx-cell-preview">${formatBRL(tx.value)}</span>
                </td>
                <td class="tx-cell--actions">
                    <div class="tx-actions">
                        <button class="tx-action-btn save-edit-btn" data-id="${tx.id}" type="button">Salvar</button>
                        <button class="tx-action-btn delete-tx-btn" data-id="${tx.id}" data-type="${tx.type}" type="button">Excluir</button>
                    </div>
                </td>
            `;
            this.tbody.appendChild(tr);
        });

        this.bindRowEvents();
    }

    getVisibleTransactions() {
        const query = norm(this.searchInput?.value || '');
        const filter = this.filterSelect?.value || 'all';
        const sort = this.sortSelect?.value || 'newest';

        const filtered = this.transactions.filter((tx) => {
            const sameType = filter === 'all' || tx.type === filter;
            const haystack = norm(`${tx.description} ${tx.category} ${tx.raw} ${tx.date || ''}`);
            const matchesSearch = !query || haystack.includes(query);
            return sameType && matchesSearch;
        });

        return filtered.sort((a, b) => {
            switch (sort) {
                case 'oldest':
                    return a.timestamp - b.timestamp || a.id - b.id;
                case 'highest':
                    return b.value - a.value || b.id - a.id;
                case 'lowest':
                    return a.value - b.value || b.id - a.id;
                case 'category':
                    return a.category.localeCompare(b.category, 'pt-BR') || b.timestamp - a.timestamp;
                case 'newest':
                default:
                    return b.timestamp - a.timestamp || b.id - a.id;
            }
        });
    }

    bindRowEvents() {
        this.tbody.querySelectorAll('.delete-tx-btn').forEach((button) => {
            button.addEventListener('click', () => {
                this.onDelete(Number(button.dataset.id), button.dataset.type);
            });
        });

        this.tbody.querySelectorAll('.save-edit-btn').forEach((button) => {
            button.addEventListener('click', () => this.handleSave(button.closest('tr')));
        });

        this.tbody.querySelectorAll('.edit-desc, .edit-cat, .edit-val, .edit-type').forEach((field) => {
            field.addEventListener('input', () => this.markDirty(field.closest('tr')));
            field.addEventListener('change', () => this.handleFieldChange(field));
            field.addEventListener('blur', () => this.handleSave(field.closest('tr')));
        });
    }

    handleFieldChange(field) {
        if (field.classList.contains('edit-type')) {
            field.className = `edit-type type-${field.value}`;
            const deleteButton = field.closest('tr').querySelector('.delete-tx-btn');
            deleteButton.dataset.type = field.value;
        }

        if (field.classList.contains('edit-val')) {
            const value = parseFloat(field.value) || 0;
            field.closest('td').querySelector('.tx-cell-preview').textContent = formatBRL(value);
        }
    }

    markDirty(row) {
        row.classList.add('tx-row-dirty');
    }

    handleSave(row) {
        if (!row || !row.classList.contains('tx-row-dirty')) return;

        const id = Number(row.querySelector('[data-id]').dataset.id);
        this.onUpdate(id, {
            type: row.querySelector('.edit-type').value,
            description: row.querySelector('.edit-desc').value,
            category: row.querySelector('.edit-cat').value,
            value: parseFloat(row.querySelector('.edit-val').value) || 0,
        });

        row.classList.remove('tx-row-dirty');
        row.classList.add('saved');
        setTimeout(() => row.classList.remove('saved'), 400);
    }
}
