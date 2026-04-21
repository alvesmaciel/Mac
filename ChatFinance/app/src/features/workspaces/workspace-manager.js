/* ═══════════════════════════════════════════════════
   WorkspaceManager — ChatFinance
   Manages multiple financial spaces per user.
   Each workspace has its own localStorage key.
═══════════════════════════════════════════════════ */

const WS_INDEX_KEY  = 'autofinance_workspaces_v1';
const WS_ACTIVE_KEY = 'autofinance_active_ws';

export class WorkspaceManager {

    constructor() {
        this._ensureDefault();
    }

    /* ─── private ─────────────────────────────── */

    _loadIndex() {
        try { return JSON.parse(localStorage.getItem(WS_INDEX_KEY) || '[]'); }
        catch { return []; }
    }

    _saveIndex(list) {
        localStorage.setItem(WS_INDEX_KEY, JSON.stringify(list));
    }

    _ensureDefault() {
        const list = this._loadIndex();
        if (!list.length) {
            this._saveIndex([{
                id:        'geral',
                name:      'Geral',
                icon:      '🏠',
                createdAt: new Date().toISOString(),
            }]);
        }
    }

    /* ─── public API ──────────────────────────── */

    /** Returns all workspaces */
    getAll() {
        return this._loadIndex();
    }

    /** Returns the active workspace id */
    getActiveId() {
        const saved = localStorage.getItem(WS_ACTIVE_KEY);
        const list  = this._loadIndex();
        if (saved && list.find(w => w.id === saved)) return saved;
        return list[0]?.id ?? 'geral';
    }

    /** Sets the active workspace */
    setActive(id) {
        localStorage.setItem(WS_ACTIVE_KEY, id);
    }

    /** Returns the active workspace object */
    getActive() {
        const id   = this.getActiveId();
        const list = this._loadIndex();
        return list.find(w => w.id === id) ?? list[0];
    }

    /** Returns the localStorage key for a given workspace id */
    storeKey(id) {
        // Keep backward compatibility: 'geral' uses the original key
        return id === 'geral' ? 'autofinance_v3' : `autofinance_ws_${id}`;
    }

    /** Creates a new workspace. Returns the created object. */
    create(name, icon = '📁') {
        const list = this._loadIndex();
        const id   = 'ws_' + Date.now();
        const ws   = { id, name: name.trim(), icon, createdAt: new Date().toISOString() };
        list.push(ws);
        this._saveIndex(list);
        return ws;
    }

    /** Renames / changes the icon of a workspace (cannot rename 'geral') */
    rename(id, name, icon) {
        if (id === 'geral') return;
        const list = this._loadIndex();
        const ws   = list.find(w => w.id === id);
        if (!ws) return;
        if (name !== undefined) ws.name = name.trim();
        if (icon !== undefined) ws.icon = icon;
        this._saveIndex(list);
    }

    /** Deletes a workspace and its stored data. Returns false if protected. */
    delete(id) {
        if (id === 'geral') return false;
        const list = this._loadIndex().filter(w => w.id !== id);
        this._saveIndex(list);
        localStorage.removeItem(this.storeKey(id));
        try { sessionStorage.removeItem(this.storeKey(id) + '_bak'); } catch (_) {}
        if (this.getActiveId() === id) this.setActive('geral');
        return true;
    }
}