import { appStorage } from '../../shared/storage.js';

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
        editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', () => this.onEditClick(messageId));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'msg-action-btn msg-action-delete';
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Excluir';
        deleteBtn.addEventListener('click', () => this.onDeleteClick(messageId));

        const copyBtn = document.createElement('button');
        copyBtn.className = 'msg-action-btn msg-action-copy';
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copiar';
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

    onDeleteClick(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;
        if (!confirm('Deseja excluir esta mensagem?')) return;

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
            const previous = button.textContent;
            button.textContent = 'Copiado';
            setTimeout(() => {
                button.textContent = previous;
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
