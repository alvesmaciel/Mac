/* ═══════════════════════════════════════════════════
   WorkspaceUI — ChatFinance
   Dropdown selector injected into #wsDropdownAnchor.
═══════════════════════════════════════════════════ */

import { escHtml } from '../../shared/utils.js';

const ICONS = ['🏠', '💼', '🏢', '🎯', '💰', '📦', '🚗', '✈️', '🎓', '❤️', '🌱', '⭐'];

export class WorkspaceUI {

    /**
     * @param {WorkspaceManager} manager
     * @param {Function} onSwitch — called with (workspaceId) when user switches workspace
     */
    constructor(manager, onSwitch) {
        this.manager   = manager;
        this.onSwitch  = onSwitch;
        this._dropOpen = false;
        // class fields for modal state
        this._editingId    = null;
        this._selectedIcon = ICONS[0];
    }

    /** Renders the full selector HTML into #wsDropdownAnchor and binds all events */
    mount() {
        const anchor = document.getElementById('wsDropdownAnchor');
        if (!anchor) return;
        anchor.innerHTML = this._buildSelectorHTML();
        this._bindEvents();
        this._updateDisplay();
    }

    /** Call after any workspace data change to refresh button label */
    refresh() {
        this._updateDisplay();
        // Only rebuild list if dropdown is currently open
        if (this._dropOpen) this._rebuildDropdownItems();
    }

    /* ══ HTML builders ═══════════════════════════ */

    _buildSelectorHTML() {
        return `
      <div class="ws-selector" id="wsSelector">

        <button class="ws-btn" id="wsBtnToggle" type="button">
          <span class="ws-icon" id="wsActiveIcon">🏠</span>
          <span class="ws-name" id="wsActiveName">Geral</span>
          <svg class="ws-chevron" id="wsChevron" width="13" height="13" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div class="ws-dropdown hidden" id="wsDropdown">
          <div class="ws-drop-list" id="wsDropList"></div>
          <div class="ws-drop-footer">
            <button class="ws-add-btn" id="wsAddBtn" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5"  y1="12" x2="19" y2="12"/>
              </svg>
              Novo espaço
            </button>
          </div>
        </div>
      </div>

      <!-- ── CREATE / EDIT MODAL ── -->
      <div class="ws-modal-overlay hidden" id="wsModalOverlay">
        <div class="ws-modal" id="wsModal">
          <h3 class="ws-modal-title" id="wsModalTitle">Novo espaço</h3>

          <div class="ws-icon-picker" id="wsIconPicker">
            ${ICONS.map(ic => `<button class="ws-icon-opt" data-icon="${ic}" type="button">${ic}</button>`).join('')}
          </div>

          <div class="ws-modal-field">
            <label class="ws-modal-label">Nome do espaço</label>
            <input type="text" class="ws-modal-input" id="wsNameInput"
                   placeholder="Ex: Casa, Empresa, Viagem…" maxlength="32" />
          </div>

          <div class="ws-modal-actions">
            <button class="ws-modal-cancel"  id="wsModalCancel"  type="button">Cancelar</button>
            <button class="ws-modal-confirm" id="wsModalConfirm" type="button">Criar</button>
          </div>
        </div>
      </div>

      <!-- ── DELETE CONFIRM ── -->
      <div class="ws-modal-overlay hidden" id="wsDeleteOverlay">
        <div class="ws-modal ws-modal--sm">
          <h3 class="ws-modal-title">Excluir espaço?</h3>
          <p class="ws-modal-warn" id="wsDeleteWarn"></p>
          <div class="ws-modal-actions">
            <button class="ws-modal-cancel" id="wsDeleteCancel"  type="button">Cancelar</button>
            <button class="ws-modal-delete" id="wsDeleteConfirm" type="button">Excluir</button>
          </div>
        </div>
      </div>
    `;
    }

    /** Builds the inner HTML for the drop list (called every time it opens) */
    _buildDropdownItems() {
        const list     = this.manager.getAll();
        const activeId = this.manager.getActiveId();

        return list.map(ws => `
      <div class="ws-drop-item ${ws.id === activeId ? 'active' : ''}" data-id="${escHtml(ws.id)}">
        <span class="ws-drop-icon">${ws.icon}</span>
        <span class="ws-drop-name">${escHtml(ws.name)}</span>
        <div class="ws-drop-actions">
          ${ws.id !== 'geral' ? `
            <button class="ws-edit-btn" data-id="${escHtml(ws.id)}" type="button" title="Renomear">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="ws-del-btn" data-id="${escHtml(ws.id)}" data-name="${escHtml(ws.name)}"
                    type="button" title="Excluir">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>`).join('');
    }

    /* ══ State helpers ═══════════════════════════ */

    _updateDisplay() {
        const ws   = this.manager.getActive();
        const icon = document.getElementById('wsActiveIcon');
        const name = document.getElementById('wsActiveName');
        if (icon) icon.textContent = ws?.icon ?? '🏠';
        if (name) name.textContent = ws?.name ?? 'Geral';
    }

    _rebuildDropdownItems() {
        const list = document.getElementById('wsDropList');
        if (!list) return;
        list.innerHTML = this._buildDropdownItems();
        this._bindItemEvents();
    }

    _openDropdown() {
        const dd = document.getElementById('wsDropdown');
        const ch = document.getElementById('wsChevron');
        if (!dd) return;
        this._rebuildDropdownItems();
        dd.classList.remove('hidden');
        ch?.classList.add('open');
        this._dropOpen = true;
    }

    _closeDropdown() {
        const dd = document.getElementById('wsDropdown');
        const ch = document.getElementById('wsChevron');
        dd?.classList.add('hidden');
        ch?.classList.remove('open');
        this._dropOpen = false;
    }

    /* ══ Modal helpers ═══════════════════════════ */

    _openCreateModal() {
        this._editingId    = null;
        this._selectedIcon = ICONS[0];
        document.getElementById('wsModalTitle').textContent   = 'Novo espaço';
        document.getElementById('wsModalConfirm').textContent = 'Criar';
        document.getElementById('wsNameInput').value          = '';
        this._highlightIcon(this._selectedIcon);
        document.getElementById('wsModalOverlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('wsNameInput').focus(), 50);
    }

    _openEditModal(id) {
        const ws = this.manager.getAll().find(w => w.id === id);
        if (!ws) return;
        this._editingId    = id;
        this._selectedIcon = ws.icon;
        document.getElementById('wsModalTitle').textContent   = 'Editar espaço';
        document.getElementById('wsModalConfirm').textContent = 'Salvar';
        document.getElementById('wsNameInput').value          = ws.name;
        this._highlightIcon(ws.icon);
        document.getElementById('wsModalOverlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('wsNameInput').focus(), 50);
    }

    _closeModal() {
        document.getElementById('wsModalOverlay')?.classList.add('hidden');
    }

    _highlightIcon(icon) {
        document.querySelectorAll('.ws-icon-opt').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.icon === icon);
        });
    }

    /* ══ Event binding ═══════════════════════════ */

    _bindEvents() {
        // ── Toggle dropdown
        document.getElementById('wsBtnToggle')?.addEventListener('click', e => {
            e.stopPropagation();
            this._dropOpen ? this._closeDropdown() : this._openDropdown();
        });

        // ── Close on outside click
        document.addEventListener('click', e => {
            if (!document.getElementById('wsSelector')?.contains(e.target)) {
                this._closeDropdown();
            }
        });

        // ── New workspace button (inside dropdown footer)
        document.getElementById('wsAddBtn')?.addEventListener('click', e => {
            e.stopPropagation();
            this._closeDropdown();
            this._openCreateModal();
        });

        // ── Icon picker (event delegation)
        document.getElementById('wsIconPicker')?.addEventListener('click', e => {
            const btn = e.target.closest('.ws-icon-opt');
            if (!btn) return;
            this._selectedIcon = btn.dataset.icon;
            this._highlightIcon(this._selectedIcon);
        });

        // ── Modal: cancel / backdrop close
        document.getElementById('wsModalCancel')?.addEventListener('click', () => this._closeModal());
        document.getElementById('wsModalOverlay')?.addEventListener('click', e => {
            if (e.target.id === 'wsModalOverlay') this._closeModal();
        });

        // ── Modal: Enter key submits
        document.getElementById('wsNameInput')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('wsModalConfirm')?.click();
        });

        // ── Modal: confirm (create or edit)
        document.getElementById('wsModalConfirm')?.addEventListener('click', () => {
            const name = document.getElementById('wsNameInput').value.trim();
            if (!name) {
                document.getElementById('wsNameInput').focus();
                return;
            }

            if (this._editingId) {
                this.manager.rename(this._editingId, name, this._selectedIcon);
            } else {
                const ws = this.manager.create(name, this._selectedIcon);
                this.manager.setActive(ws.id);
                this.onSwitch(ws.id);
            }

            this._closeModal();
            this._updateDisplay();
            this.refresh();
        });

        // ── Delete overlay: cancel
        document.getElementById('wsDeleteCancel')?.addEventListener('click', () => {
            document.getElementById('wsDeleteOverlay').classList.add('hidden');
        });
        document.getElementById('wsDeleteOverlay')?.addEventListener('click', e => {
            if (e.target.id === 'wsDeleteOverlay') {
                document.getElementById('wsDeleteOverlay').classList.add('hidden');
            }
        });

        // ── Delete overlay: confirm
        document.getElementById('wsDeleteConfirm')?.addEventListener('click', () => {
            const id = document.getElementById('wsDeleteConfirm').dataset.targetId;
            if (!id) return;
            this.manager.delete(id);
            document.getElementById('wsDeleteOverlay').classList.add('hidden');
            this._updateDisplay();
            this.refresh();
            this.onSwitch(this.manager.getActiveId());
        });

        this._bindItemEvents();
    }

    _bindItemEvents() {
        // ── Switch workspace on row click
        document.querySelectorAll('.ws-drop-item').forEach(item => {
            item.addEventListener('click', e => {
                if (e.target.closest('.ws-edit-btn') || e.target.closest('.ws-del-btn')) return;
                const id = item.dataset.id;
                this.manager.setActive(id);
                this._closeDropdown();
                this._updateDisplay();
                this.onSwitch(id);
            });
        });

        // ── Edit button
        document.querySelectorAll('.ws-edit-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this._closeDropdown();
                this._openEditModal(btn.dataset.id);
            });
        });

        // ── Delete button (shows confirm modal)
        document.querySelectorAll('.ws-del-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const warn    = document.getElementById('wsDeleteWarn');
                const confirm = document.getElementById('wsDeleteConfirm');
                warn.textContent         = `Todos os dados de "${btn.dataset.name}" serão apagados permanentemente.`;
                confirm.dataset.targetId = btn.dataset.id;
                this._closeDropdown();
                document.getElementById('wsDeleteOverlay').classList.remove('hidden');
            });
        });
    }
}