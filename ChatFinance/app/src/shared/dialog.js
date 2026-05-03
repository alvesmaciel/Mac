export function confirmDialog({
    title = 'Confirmar acao',
    message = 'Tem certeza que deseja continuar?',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'default',
} = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = `app-dialog app-dialog--${variant}`;
        dialog.innerHTML = `
            <div class="app-dialog__header">
                <h3>${title}</h3>
            </div>
            <div class="app-dialog__body">
                <p>${message}</p>
            </div>
            <div class="app-dialog__footer">
                <button type="button" class="btn btn-secondary" data-dialog-cancel>${cancelLabel}</button>
                <button type="button" class="btn btn-primary" data-dialog-confirm>${confirmLabel}</button>
            </div>
        `;

        const cleanup = (value) => {
            overlay.classList.remove('is-visible');
            setTimeout(() => {
                overlay.remove();
                resolve(value);
            }, 180);
        };

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) cleanup(false);
        });

        dialog.querySelector('[data-dialog-cancel]')?.addEventListener('click', () => cleanup(false));
        dialog.querySelector('[data-dialog-confirm]')?.addEventListener('click', () => cleanup(true));

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.classList.add('is-visible');
        });
    });
}
