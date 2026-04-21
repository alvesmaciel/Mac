/* ═══════════════════════════════════════
   MAC Studio — profile.js
═══════════════════════════════════════ */

const PROFILE_KEY = 'mac_profile_v1';

/* ── helpers ── */
const $ = id => document.getElementById(id);
function toast(msg, duration = 2800) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('visible'), duration);
}

/* ── LOAD / SAVE ── */
function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
  } catch { return {}; }
}

function saveProfile(data) {
  const existing = loadProfile();
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...existing, ...data }));
}

/* ── INIT ── */
(function init() {
  const p = loadProfile();

  // Restore user from auth if available
  try {
    const logged = JSON.parse(localStorage.getItem('af_logged') || '{}');
    if (logged.name && !p.fullName) p.fullName = logged.name;
    if (logged.email && !p.email) p.email = logged.email;
  } catch {}

  // Populate fields
  if (p.fullName)    $('fullName').value    = p.fullName;
  if (p.email)       $('email').value       = p.email;
  if (p.phone)       $('phone').value       = p.phone;
  if (p.country)     $('country').value     = p.country;
  if (p.occupation)  $('occupation').value  = p.occupation;
  if (p.bio)         $('bio').value         = p.bio;
  if (p.currency)    $('currency').value    = p.currency;
  if (p.theme)       setTheme(p.theme);

  // Avatar
  if (p.photo) {
    showPhoto(p.photo);
  } else {
    updateInitials(p.fullName || '');
  }

  updateAvatarSidebar(p.fullName || 'Seu Nome', p.occupation || '—');
  updateBioCount(p.bio || '');

  // Apply theme
  applyTheme(p.theme || 'light');
})();

/* ── SIDEBAR NAV ── */
document.querySelectorAll('.side-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.side-nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const sec = document.getElementById('section-' + btn.dataset.section);
    if (sec) sec.classList.add('active');
  });
});

/* ── SAVE BUTTON ── */
$('saveBtn').addEventListener('click', () => {
  const data = {
    fullName:   $('fullName').value.trim(),
    email:      $('email').value.trim(),
    phone:      $('phone').value.trim(),
    country:    $('country').value,
    occupation: $('occupation').value.trim(),
    bio:        $('bio').value.trim(),
    currency:   $('currency').value,
  };

  saveProfile(data);
  updateInitials(data.fullName);
  updateAvatarSidebar(data.fullName || 'Seu Nome', data.occupation || '—');

  // Sync with auth store
  try {
    const logged = JSON.parse(localStorage.getItem('af_logged') || '{}');
    if (data.fullName) logged.name = data.fullName;
    if (data.email) logged.email = data.email;
    localStorage.setItem('af_logged', JSON.stringify(logged));
  } catch {}

  toast('✓ Perfil salvo com sucesso');
});

/* ── AVATAR HELPERS ── */
function updateInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  let initials = '--';
  if (parts.length >= 2) initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  else if (parts.length === 1) initials = parts[0].slice(0, 2).toUpperCase();
  $('avatarInitials').textContent = initials;
}

function updateAvatarSidebar(name, role) {
  $('avatarName').textContent = name || 'Seu Nome';
  $('avatarRole').textContent = role || '—';
}

function showPhoto(src) {
  const img = $('avatarImg');
  const initials = $('avatarInitials');
  img.src = src;
  img.classList.remove('hidden');
  initials.classList.add('hidden');
  $('removePhotoBtn').classList.remove('hidden');
}

function clearPhoto() {
  const img = $('avatarImg');
  img.src = '';
  img.classList.add('hidden');
  $('avatarInitials').classList.remove('hidden');
  $('removePhotoBtn').classList.add('hidden');
  const p = loadProfile();
  delete p.photo;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

/* ── PHOTO UPLOAD ── */
$('photoInput').addEventListener('change', function () {
  const file = this.files?.[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('⚠ Foto muito grande. Máximo: 3MB'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    const src = e.target.result;
    showPhoto(src);
    saveProfile({ photo: src });
    toast('✓ Foto atualizada');
  };
  reader.readAsDataURL(file);
});

$('removePhotoBtn').addEventListener('click', () => {
  clearPhoto();
  const p = loadProfile();
  updateInitials(p.fullName || '');
  toast('Foto removida');
});

/* ── BIO CHAR COUNT ── */
function updateBioCount(val) {
  $('bioCount').textContent = `${val.length} / 160`;
}
$('bio').addEventListener('input', function () {
  updateBioCount(this.value);
});

/* ── THEME TOGGLE ── */
document.querySelectorAll('.theme-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    setTheme(btn.dataset.val);
    saveProfile({ theme: btn.dataset.val });
    applyTheme(btn.dataset.val);
  });
});

function setTheme(val) {
  document.querySelectorAll('.theme-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
}

function applyTheme(val) {
  if (val === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (val === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefersDark);
  }
}

/* ── PASSWORD CHANGE ── */
$('newPwd').addEventListener('input', function () {
  const val = this.value;
  const fill = $('strengthFill');
  const label = $('strengthLabel');

  if (!val) { fill.style.width = '0%'; label.textContent = ''; return; }

  let score = 0;
  if (val.length >= 8)              score++;
  if (val.length >= 12)             score++;
  if (/[A-Z]/.test(val))            score++;
  if (/[0-9]/.test(val))            score++;
  if (/[^A-Za-z0-9]/.test(val))     score++;

  const levels = [
    { pct: '16%', color: '#C0392B', text: 'Muito fraca' },
    { pct: '33%', color: '#B7791F', text: 'Fraca' },
    { pct: '55%', color: '#B7791F', text: 'Média' },
    { pct: '78%', color: '#2D6A4F', text: 'Forte' },
    { pct: '100%', color: '#2D6A4F', text: 'Muito forte ✓' },
  ];
  const l = levels[Math.min(score - 1, 4)] || levels[0];
  fill.style.width    = l.pct;
  fill.style.background = l.color;
  label.textContent   = l.text;
  label.style.color   = l.color;
});

$('changePwdBtn').addEventListener('click', () => {
  const current  = $('currentPwd').value;
  const newPwd   = $('newPwd').value;
  const confirm  = $('confirmPwd').value;
  const msg      = $('pwdMsg');

  msg.className = 'msg-inline';

  if (!current || !newPwd || !confirm) {
    msg.textContent = 'Preencha todos os campos.';
    msg.classList.add('error');
    return;
  }
  if (newPwd.length < 8) {
    msg.textContent = 'Nova senha precisa ter ao menos 8 caracteres.';
    msg.classList.add('error');
    return;
  }
  if (newPwd !== confirm) {
    msg.textContent = 'As senhas não coincidem.';
    msg.classList.add('error');
    return;
  }

  // Verify against stored user
  try {
    const logged = JSON.parse(localStorage.getItem('af_logged') || '{}');
    const users  = JSON.parse(localStorage.getItem('af_users')  || '[]');
    const user   = users.find(u => u.email === logged.email);
    if (user && user.password !== current) {
      msg.textContent = 'Senha atual incorreta.';
      msg.classList.add('error');
      return;
    }
    if (user) {
      user.password = newPwd;
      localStorage.setItem('af_users', JSON.stringify(users));
    }
  } catch {}

  $('currentPwd').value = '';
  $('newPwd').value     = '';
  $('confirmPwd').value = '';
  $('strengthFill').style.width = '0%';
  $('strengthLabel').textContent = '';
  msg.textContent = '✓ Senha atualizada com sucesso.';
  toast('✓ Senha alterada');
});

/* ── LOGOUT ── */
$('logoutBtn').addEventListener('click', () => {
  if (!confirm('Sair da conta?')) return;
  localStorage.removeItem('af_logged');
  window.location.href = '../../HomePage/assets/login/index.html';
});

/* ── LIVE UPDATE: name reflects in sidebar ── */
$('fullName').addEventListener('input', function () {
  updateInitials(this.value);
  $('avatarName').textContent = this.value || 'Seu Nome';
});

$('occupation').addEventListener('input', function () {
  $('avatarRole').textContent = this.value || '—';
});