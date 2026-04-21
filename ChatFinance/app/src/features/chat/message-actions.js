/**
 * Message Actions Module - Edit, Delete, Copy
 * Adiciona funcionalidades aos bubbles de chat
 */

import { appStorage } from '../../shared/storage.js';

export class MessageActions {
    constructor() {
        this.editingId = null;
        this.messages = appStorage.get('chatMessages') || [];
    }

    /**
     * Gera ID único para mensagem
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    linkTransactionToMessage(messageEl, transactionId) {
    messageEl.setAttribute('data-transaction-id', transactionId);
}

    /**
     * Cria bubble com ID e atributos data
     */
    createMessageBubble(html, type = 'user', originalId = null) {
    const messageId = originalId || this.generateMessageId();
    
    const div = document.createElement('div');
    div.className = `msg msg--${type}`;
    div.setAttribute('data-message-id', messageId);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    // 🔥 conteúdo separado
    const content = document.createElement('div');
    content.className = 'msg-content';
    content.innerHTML = html;

    bubble.appendChild(content);
    

    // 🔥 ações FORA do conteúdo
    if (type === 'user') {
        const actions = this.createActionButtons(messageId);
        div.appendChild(actions); // ⬅️ AQUI MUDA
    }

    div.appendChild(bubble);

    return { element: div, id: messageId };
}


    /**
     * Cria botões de ação (Edit, Delete, Copy)
     */
    createActionButtons(messageId) {
        const container = document.createElement('div');
        container.className = 'msg-actions';

        // Botão Edit
        const editBtn = document.createElement('button');
        editBtn.className = 'msg-action-btn msg-action-edit';
        editBtn.innerHTML = '✏️ Editar';
        editBtn.title = 'Editar esta mensagem';
        editBtn.addEventListener('click', () => this.onEditClick(messageId));

        // Botão Delete
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'msg-action-btn msg-action-delete';
        deleteBtn.innerHTML = '🗑️ Excluir';
        deleteBtn.title = 'Excluir esta mensagem';
        deleteBtn.addEventListener('click', () => this.onDeleteClick(messageId));

        // Botão Copy
        const copyBtn = document.createElement('button');
        copyBtn.className = 'msg-action-btn msg-action-copy';
        copyBtn.innerHTML = '📋 Copiar';
        copyBtn.title = 'Copiar texto';
        copyBtn.addEventListener('click', () => this.onCopyClick(messageId));

        container.appendChild(editBtn);
        container.appendChild(deleteBtn);
        container.appendChild(copyBtn);

        return container;
    }

    /**
     * Handler para Edit
     */
    onEditClick(messageId) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;

    const content = messageEl.querySelector('.msg-content');
    const actions = messageEl.querySelector('.msg-actions');

    const originalText = content.textContent.trim();

    if (actions) actions.style.display = 'none';

    const editForm = document.createElement('div');
    editForm.className = 'msg-edit-form';

    editForm.innerHTML = `
        <textarea class="msg-edit-input">${originalText}</textarea>
        <div class="msg-edit-buttons">
            <button class="msg-edit-save">Salvar</button>
            <button class="msg-edit-cancel">Cancelar</button>
        </div>
    `;

    content.innerHTML = '';
    content.appendChild(editForm);

    const textarea = editForm.querySelector('textarea');
    textarea.focus();

    editForm.querySelector('.msg-edit-save').onclick = () => {
        const newText = textarea.value.trim();
        this.saveEdit(messageId, newText);
    };

    editForm.querySelector('.msg-edit-cancel').onclick = () => {
        content.textContent = originalText;
        if (actions) actions.style.display = 'flex';
    };
}

    /**
     * Salva edição da mensagem
     */
    saveEdit(messageId, newText) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;

    const content = messageEl.querySelector('.msg-content');
    const actions = messageEl.querySelector('.msg-actions');

    content.textContent = newText;

    if (actions) actions.style.display = 'flex';

    // 🔥 REPROCESSA (ESSA É A PARTE QUE FALTAVA)
    this.reprocessMessage(
        messageId,
        newText,
        window.app.parser,
        window.app.store,
        window.app.renderAll
    );

    this.updateMessageInStorage(messageId, newText);

// 🚀 dispara evento global
window.dispatchEvent(new CustomEvent('messageEdited', {
    detail: { messageId, newText }
}));
}

    /**
     * Handler para Delete
     */
    onDeleteClick(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        if (confirm('Tem certeza que deseja excluir esta mensagem?')) {
            // Fade out animation
            messageEl.style.opacity = '0';
            messageEl.style.transform = 'translateX(-20px)';
            messageEl.style.transition = 'all 0.3s ease';

            setTimeout(() => {
                messageEl.remove();
                this.removeMessageFromStorage(messageId);
            }, 300);
        }
    }

    /**
     * Handler para Copy
     */
    async onCopyClick(messageId) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;

    const text = messageEl.querySelector('.msg-content').textContent.trim();

    try {
        await navigator.clipboard.writeText(text);

        const copyBtn = messageEl.querySelector('.msg-action-copy');
        const original = copyBtn.innerHTML;

        copyBtn.innerHTML = '✅ Copiado!';
        setTimeout(() => copyBtn.innerHTML = original, 1500);

    } catch (error) {
        console.error('Erro ao copiar:', error);
    }
    
}


    /**
     * Atualiza mensagem no storage
     */
    updateMessageInStorage(messageId, newText) {
        const messages = appStorage.get('chatMessages') || [];
        const index = messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            messages[index].text = newText;
            messages[index].edited = true;
            messages[index].editedAt = new Date().toISOString();
            appStorage.set('chatMessages', messages);
        }
    }

    /**
     * Remove mensagem do storage
     */
    removeMessageFromStorage(messageId) {
        const messages = appStorage.get('chatMessages') || [];
        const filtered = messages.filter(m => m.id !== messageId);
        appStorage.set('chatMessages', filtered);
    }

    /**
     * Persiste todas as mensagens
     */
    saveAllMessages(messagesEl) {
        const messages = [];
        messagesEl.querySelectorAll('.msg').forEach(el => {
            const id = el.getAttribute('data-message-id');
            const type = el.classList.contains('msg--user') ? 'user' : 'response';
            const text = el.querySelector('.msg-bubble')?.textContent.trim() || '';
            
            messages.push({
                id,
                type,
                text,
                timestamp: new Date().toISOString(),
            });
        });

        appStorage.set('chatMessages', messages);
        return messages;
    }

    /**
     * Restaura mensagens do storage
     */
    async restoreMessages(messagesEl) {
        const messages = appStorage.get('chatMessages') || [];
        
        if (messages.length === 0) return;

        messagesEl.innerHTML = '';

        for (const msg of messages) {
            const { element } = this.createMessageBubble(msg.text, msg.type, msg.id);
            messagesEl.appendChild(element);
        }

        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    /**
     * Limpa todas as mensagens
     */
    clearAll(messagesEl) {
        messagesEl.innerHTML = '';
        appStorage.remove('chatMessages');
    }

    reprocessMessage(messageId, newText, parser, store, onUpdate) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;

    const oldTxId = messageEl.getAttribute('data-transaction-id');

    // 🔥 remove transação antiga
    if (oldTxId) {
        store.deleteTransactionById(oldTxId);
    }

    // 🔥 parse novo texto
    const parsed = parser.parse(newText);

    if (!parsed || !parsed.value) return;

    // 🔥 adiciona nova
    const newTx = store.addTransaction(parsed);

    // 🔥 atualiza vínculo
    messageEl.setAttribute('data-transaction-id', newTx.id);

    // 🔥 atualiza dashboard
    onUpdate?.();
}

}

export const messageActions = new MessageActions();
