import { appStorage } from '../../shared/storage.js';
import { confirmDialog } from '../../shared/dialog.js';

export class MessageActions {
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    linkTransactionToMessage(messageEl, transactionId) {
        if (messageEl) {
            messageEl.setAttribute('data-transaction-id', transactionId);
        }
    }

    createMessageBubble(html, type = 'user', originalId = null, author = null) {
        const messageId = originalId || this.generateMessageId();
        const wrapper = document.createElement('div');
        wrapper.className = `msg msg--${type}`;
        wrapper.setAttribute('data-message-id', messageId);

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        if (author) {
            const meta = document.createElement('div');
            meta.className = 'msg-author';
            meta.textContent = author;
            bubble.appendChild(meta);
        }

        const content = document.createElement('div');
        content.className = 'msg-content';
        content.innerHTML = html;
        bubble.appendChild(content);
        wrapper.appendChild(bubble);

        if (type === 'user') {
            wrapper.appendChild(this.createActionButtons(messageId));
        }

        return { element: wrapper, id: messageId };
    }

    createActionButtons(messageId) {
        const container = document.createElement('div');
        container.className = 'msg-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'msg-action-btn msg-action-edit';
        editBtn.type = 'button';
        editBtn.title = 'Editar mensagem';
        editBtn.setAttribute('aria-label', 'Editar mensagem');
        editBtn.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
        `;
        editBtn.addEventListener('click', () => this.onEditClick(messageId));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'msg-action-btn msg-action-delete';
        deleteBtn.type = 'button';
        deleteBtn.title = 'Excluir mensagem';
        deleteBtn.setAttribute('aria-label', 'Excluir mensagem');
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18"/>
                <path d="M8 6V4h8v2"/>
                <path d="M19 6l-1 14H6L5 6"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', () => this.onDeleteClick(messageId));

        const copyBtn = document.createElement('button');
        copyBtn.className = 'msg-action-btn msg-action-copy';
        copyBtn.type = 'button';
        copyBtn.title = 'Copiar mensagem';
        copyBtn.setAttribute('aria-label', 'Copiar mensagem');
        copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
        `;
        copyBtn.addEventListener('click', () => this.onCopyClick(messageId));

        container.appendChild(editBtn);
        container.appendChild(deleteBtn);
        container.appendChild(copyBtn);
        return container;
    }

    onEditClick(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        const content = messageEl.querySelector('.msg-content');
        const actions = messageEl.querySelector('.msg-actions');
        const originalText = content.textContent.trim();

        if (actions) actions.style.display = 'none';

        content.innerHTML = `
            <div class="msg-edit-form">
                <textarea class="msg-edit-input">${originalText}</textarea>
                <div class="msg-edit-buttons">
                    <button class="msg-edit-save" type="button">Salvar</button>
                    <button class="msg-edit-cancel" type="button">Cancelar</button>
                </div>
            </div>
        `;

        const textarea = content.querySelector('.msg-edit-input');
        textarea.focus();

        content.querySelector('.msg-edit-save').addEventListener('click', () => {
            const newText = textarea.value.trim();
            this.saveEdit(messageId, newText);
        });

        content.querySelector('.msg-edit-cancel').addEventListener('click', () => {
            content.textContent = originalText;
            if (actions) actions.style.display = 'flex';
        });
    }

    saveEdit(messageId, newText) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        const content = messageEl.querySelector('.msg-content');
        const actions = messageEl.querySelector('.msg-actions');
        const transactionId = messageEl.getAttribute('data-transaction-id');

        content.textContent = newText;
        if (actions) actions.style.display = 'flex';

        this.updateMessageInStorage(messageId, newText);

        window.dispatchEvent(new CustomEvent('chatMessageEdited', {
            detail: { messageId, newText, transactionId },
        }));
    }

    async onDeleteClick(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        const confirmed = await confirmDialog({
            title: 'Excluir mensagem',
            message: 'A mensagem sera removida do chat. Se ela estiver vinculada a uma transacao, o registro tambem sera excluido.',
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar',
            variant: 'danger',
        });
        if (!confirmed) return;

        const transactionId = messageEl.getAttribute('data-transaction-id');
        messageEl.remove();
        this.removeMessageFromStorage(messageId);

        window.dispatchEvent(new CustomEvent('chatMessageDeleted', {
            detail: { messageId, transactionId },
        }));
    }

    async onCopyClick(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        const button = messageEl.querySelector('.msg-action-copy');
        try {
            await navigator.clipboard.writeText(messageEl.querySelector('.msg-content')?.textContent.trim() || '');
            const previous = button.innerHTML;
            button.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 13 4 4L19 7"/>
                </svg>
            `;
            setTimeout(() => {
                button.innerHTML = previous;
            }, 1200);
        } catch (error) {
            console.error('Erro ao copiar:', error);
        }
    }

    updateMessageInStorage(messageId, newText) {
        const messages = appStorage.get('chatMessages') || [];
        const index = messages.findIndex((message) => message.id === messageId);
        if (index !== -1) {
            messages[index].html = newText;
            messages[index].edited = true;
            appStorage.set('chatMessages', messages);
        }
    }

    removeMessageFromStorage(messageId) {
        const messages = appStorage.get('chatMessages') || [];
        appStorage.set('chatMessages', messages.filter((message) => message.id !== messageId));
    }

    saveAllMessages(messagesEl) {
        const messages = [];
        messagesEl.querySelectorAll('.msg').forEach((el) => {
            messages.push({
                id: el.getAttribute('data-message-id'),
                type: el.classList.contains('msg--user') ? 'user' : 'response',
                html: el.querySelector('.msg-content')?.innerHTML || '',
                author: el.querySelector('.msg-author')?.textContent || '',
                transactionId: el.getAttribute('data-transaction-id') || null,
            });
        });

        appStorage.set('chatMessages', messages);
    }

    restoreMessages(messagesEl) {
        const messages = appStorage.get('chatMessages') || [];
        if (!messages.length) return false;

        messagesEl.innerHTML = '';

        messages.forEach((msg) => {
            const { element } = this.createMessageBubble(msg.html, msg.type, msg.id, msg.author);
            if (msg.transactionId) {
                element.setAttribute('data-transaction-id', msg.transactionId);
            }
            messagesEl.appendChild(element);
        });

        messagesEl.scrollTop = messagesEl.scrollHeight;
        return true;
    }

    clearAll(messagesEl) {
        messagesEl.innerHTML = '';
        appStorage.remove('chatMessages');
    }
}

export const messageActions = new MessageActions();
