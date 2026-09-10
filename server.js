require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const crypto   = require('crypto');
const fs       = require('fs');
const session  = require('express-session');

const app  = express();
const PORT = process.env.PORT || 8080;

// Root directory: on Vercel, __dirname is api/ so APP_ROOT is set by api/index.js
const ROOT_DIR = process.env.APP_ROOT || __dirname;

// Data file paths
const SCHOOLS_FILE      = path.join(ROOT_DIR, 'data', 'schools.json');
const RESERVATIONS_FILE = path.join(ROOT_DIR, 'data', 'reservations.json');
const USERS_FILE        = path.join(ROOT_DIR, 'data', 'users.json');

// Helper: read/write JSON data files (compatible Vercel Serverless & Local)
function readData(filePath) {
  const fileName = path.basename(filePath);
  const tmpPath = path.join('/tmp', fileName);
  try {
    if (fs.existsSync(tmpPath)) {
      return JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}
function writeData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Fallback environnement serverless read-only (Vercel / Lambda)
    const fileName = path.basename(filePath);
    const tmpPath = path.join('/tmp', fileName);
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    } catch {}
  }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS, images, etc.) using ROOT_DIR (Vercel-compatible)
app.use(express.static(ROOT_DIR, {
  index: false, // index.html served by explicit routes below
  extensions: ['css', 'js', 'png', 'jpg', 'svg', 'ico', 'woff', 'woff2']
}));

// Session middleware (for admin auth)
app.use(session({
  secret: process.env.ADMIN_SESSION_SECRET || 'badil_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 heures
}));

// Middleware: protéger les routes admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin');
}

// =========================================================================
// ROUTES ADMIN — Login / Logout / Dashboard
// =========================================================================

// Page de connexion admin
app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

// Dashboard admin (protégé)
app.get('/admin/dashboard', requireAdmin, (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'admin-dashboard.html'));
});

// POST /admin/login — Authentification (multi-utilisateurs équipe)
app.post('/admin/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ success: false, message: 'Identifiant et mot de passe requis.' });
  }

  // 1. Vérifier dans users.json
  const usersData = readData(USERS_FILE);
  const users = usersData.users || [];
  const foundUser = users.find(u => u.login === login.trim().toLowerCase() && u.password === password && u.status !== 'suspended');

  if (foundUser) {
    req.session.isAdmin = true;
    req.session.user = {
      id: foundUser.id,
      name: foundUser.name,
      login: foundUser.login,
      role: foundUser.role,
      phone: foundUser.phone || ''
    };
    return res.json({ success: true, redirect: '/admin/dashboard', user: req.session.user });
  }

  // 2. Fallback .env pour le superadmin de secours
  const validLogin    = process.env.ADMIN_LOGIN    || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'LeBadil2026!';
  if (login.trim() === validLogin && password === validPassword) {
    req.session.isAdmin = true;
    req.session.user = {
      id: 'usr-root',
      name: 'Direction Générale',
      login: validLogin,
      role: 'Directeur Général',
      phone: '+221 77 000 00 00'
    };
    return res.json({ success: true, redirect: '/admin/dashboard', user: req.session.user });
  }

  return res.status(401).json({ success: false, message: 'Identifiant ou mot de passe incorrect.' });
});

// GET /admin/logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

// Profil utilisateur actuellement connecté
app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({
    success: true,
    user: req.session.user || { name: 'Administrateur', role: 'Superviseur' }
  });
});

// =========================================================================
// API — GESTION DE L'ÉQUIPE (Membres & Rôles)
// =========================================================================
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const usersData = readData(USERS_FILE);
  const users = (usersData.users || []).map(u => ({
    id: u.id,
    name: u.name,
    login: u.login,
    role: u.role,
    phone: u.phone || '',
    status: u.status || 'active',
    createdAt: u.createdAt
  }));
  res.json(users);
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { name, login, password, role, phone } = req.body;
  if (!name || !login || !password) {
    return res.status(400).json({ error: 'Le nom, l\'identifiant et le mot de passe sont obligatoires.' });
  }

  const usersData = readData(USERS_FILE);
  usersData.users = usersData.users || [];

  if (usersData.users.some(u => u.login.toLowerCase() === login.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Cet identifiant de connexion est déjà utilisé par un autre collaborateur.' });
  }

  const newUser = {
    id: `usr-${Date.now()}`,
    name: name.trim(),
    login: login.trim().toLowerCase(),
    password: password.trim(),
    role: role || 'Collaborateur Conciergerie',
    phone: (phone || '').trim(),
    status: 'active',
    createdAt: new Date().toISOString()
  };

  usersData.users.push(newUser);
  writeData(USERS_FILE, usersData);

  res.json({
    success: true,
    user: {
      id: newUser.id,
      name: newUser.name,
      login: newUser.login,
      role: newUser.role,
      phone: newUser.phone,
      status: newUser.status,
      createdAt: newUser.createdAt
    }
  });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const usersData = readData(USERS_FILE);
  usersData.users = usersData.users || [];

  if (req.session.user && req.session.user.id === req.params.id) {
    return res.status(400).json({ error: 'Action refusée : Vous ne pouvez pas supprimer votre propre compte connecté.' });
  }

  const before = usersData.users.length;
  usersData.users = usersData.users.filter(u => u.id !== req.params.id);

  if (usersData.users.length === before) {
    return res.status(404).json({ error: 'Membre non trouvé.' });
  }

  writeData(USERS_FILE, usersData);
  res.json({ success: true });
});

// =========================================================================
// API — ÉTABLISSEMENTS (protégée admin + publique en lecture)
// =========================================================================

// Publique : liste des écoles pour le formulaire de réservation
app.get('/api/schools', (req, res) => {
  const data = readData(SCHOOLS_FILE);
  res.json(data.schools || []);
});

// Admin : liste complète
app.get('/api/admin/schools', requireAdmin, (req, res) => {
  const data = readData(SCHOOLS_FILE);
  res.json(data.schools || []);
});

// Admin : ajouter un établissement
app.post('/api/admin/schools', requireAdmin, (req, res) => {
  const { name, city } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom de l\'établissement est requis.' });

  const data = readData(SCHOOLS_FILE);
  const newSchool = {
    id:   `school-${Date.now()}`,
    name: name.trim(),
    city: (city || 'Dakar').trim()
  };
  data.schools = data.schools || [];
  data.schools.push(newSchool);
  writeData(SCHOOLS_FILE, data);
  res.json({ success: true, school: newSchool });
});

// Admin : supprimer un établissement
app.delete('/api/admin/schools/:id', requireAdmin, (req, res) => {
  const data = readData(SCHOOLS_FILE);
  const before = (data.schools || []).length;
  data.schools = (data.schools || []).filter(s => s.id !== req.params.id);
  if (data.schools.length === before) return res.status(404).json({ error: 'Établissement non trouvé.' });
  writeData(SCHOOLS_FILE, data);
  res.json({ success: true });
});

// =========================================================================
// API — RÉSERVATIONS (admin uniquement)
// =========================================================================
app.get('/api/admin/reservations', requireAdmin, (req, res) => {
  const data = readData(RESERVATIONS_FILE);
  const reservations = (data.reservations || []).slice().reverse(); // plus récentes en premier
  res.json(reservations);
});

// Serve static frontend files (après les routes admin pour ne pas intercepter)
app.use(express.static(path.join(ROOT_DIR)));

// Route racine explicite
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// =========================================================================
// PACK PRICES (FCFA)
// =========================================================================
const PACK_PRICES = {
  'teranga':    { name: 'Pack Teranga (Accueil AIBD & Transfert)',          price: 75000  },
  'logement':   { name: 'Pack Logement Serein (Chasse & Abonnements)',      price: 150000 },
  'integration':{ name: 'Pack Intégration (Transport & Santé)',             price: 60000  },
  'vip':        { name: 'Pack VIP All-Inclusive (Clé en Main)',             price: 250000 }
};

// =========================================================================
// BREVO EMAIL MODULE
// =========================================================================

/**
 * Envoie un email HTML via l'API Brevo (Sendinblue).
 * @param {object} options - { to, toName, subject, htmlContent }
 */
async function sendBrevoEmail({ to, toName, subject, htmlContent }) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ [Brevo] BREVO_API_KEY manquant dans .env — email non envoyé.');
    return { skipped: true };
  }

  const payload = {
    sender: {
      name:  process.env.BREVO_SENDER_NAME  || 'Le BADIL Conciergerie Dakar',
      email: process.env.BREVO_SENDER_EMAIL || 'lebadilconciergerie@gmail.com'
    },
    to: [{ email: to, name: toName || to }],
    subject,
    htmlContent
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept':       'application/json',
      'api-key':      apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (response.ok) {
    console.log(`✅ [Brevo] Email envoyé à ${to} — Sujet: "${subject}" | ID: ${data.messageId}`);
  } else {
    console.error(`❌ [Brevo] Échec envoi à ${to}:`, data);
  }

  return data;
}

// =========================================================================
// TEMPLATES EMAILS HTML — CORPORATE BLEU MARINE & OR CHAMPAGNE
// =========================================================================

/**
 * Email 1.1 : Confirmation de réservation & bienvenue (envoyé immédiatement après paiement)
 */
function buildConfirmationEmail({ studentName, packName, school, arrivalDate, refCommand, whatsappNumber }) {
  const waLink = `https://wa.me/${whatsappNumber || '221770000000'}?text=${encodeURIComponent(
    `Bonjour Le BADIL Conciergerie, mon paiement pour le ${packName} a été validé (Réf: ${refCommand}). Étudiant: ${studentName}. Merci de prendre en charge mon dossier !`
  )}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation Le BADIL Conciergerie</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2C59;">
    <tr>
      <td align="center" style="padding:30px 20px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <div style="width:56px;height:56px;background:#DAC0A3;border-radius:50%;display:inline-block;line-height:56px;text-align:center;font-size:24px;font-weight:900;color:#0F2C59;margin-bottom:12px;">B</div>
              <h1 style="color:#DAC0A3;margin:8px 0 4px;font-size:22px;letter-spacing:2px;text-transform:uppercase;">LE BADIL CONCIERGERIE</h1>
              <p style="color:#a0b4cc;margin:0;font-size:13px;letter-spacing:1px;">DAKAR · SÉNÉGAL</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Gold Banner -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#DAC0A3;">
    <tr>
      <td align="center" style="padding:14px 20px;">
        <p style="margin:0;color:#0F2C59;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
          ✅ PAIEMENT CONFIRMÉ — RÉSERVATION VALIDÉE
        </p>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
    <tr>
      <td align="center" style="padding:30px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Greeting -->
          <tr>
            <td style="padding:36px 40px 20px;">
              <h2 style="color:#0F2C59;margin:0 0 16px;font-size:20px;">Bienvenue, ${studentName} ! 🎉</h2>
              <p style="color:#444;line-height:1.7;margin:0 0 16px;">
                Nous avons le plaisir de vous confirmer la validation de votre réservation pour le <strong style="color:#0F2C59;">${packName}</strong>. Bienvenue au sein de la famille <strong>Le BADIL Conciergerie</strong> !
              </p>
              <p style="color:#444;line-height:1.7;margin:0;">
                Dès aujourd'hui, vous n'êtes plus seul pour préparer votre arrivée à Dakar. Notre équipe est déjà mobilisée pour faire de votre installation au Sénégal un moment serein et mémorable.
              </p>
            </td>
          </tr>

          <!-- Recap Box -->
          <tr>
            <td style="padding:0 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5f0;border-left:4px solid #DAC0A3;border-radius:8px;padding:20px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 10px;font-size:13px;color:#0F2C59;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Récapitulatif de votre dossier</p>
                    <table width="100%" cellpadding="6" cellspacing="0">
                      <tr><td style="color:#666;font-size:14px;">📦 Pack souscrit :</td><td style="color:#0F2C59;font-weight:600;font-size:14px;">${packName}</td></tr>
                      <tr><td style="color:#666;font-size:14px;">🎓 Établissement :</td><td style="color:#0F2C59;font-weight:600;font-size:14px;">${school || 'À préciser'}</td></tr>
                      <tr><td style="color:#666;font-size:14px;">✈️ Date d'arrivée AIBD :</td><td style="color:#0F2C59;font-weight:600;font-size:14px;">${arrivalDate || 'À confirmer'}</td></tr>
                      <tr><td style="color:#666;font-size:14px;">🔖 Référence dossier :</td><td style="color:#0F2C59;font-weight:600;font-size:14px;font-family:monospace;">${refCommand}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next Steps -->
          <tr>
            <td style="padding:0 40px 28px;">
              <p style="color:#0F2C59;font-weight:700;margin:0 0 14px;font-size:15px;">📋 Vos prochaines étapes :</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #eee;">
                    <p style="margin:0;color:#444;font-size:14px;">
                      <span style="display:inline-block;width:24px;height:24px;background:#DAC0A3;border-radius:50%;text-align:center;line-height:24px;font-weight:700;color:#0F2C59;margin-right:10px;font-size:12px;">1</span>
                      Un <strong>concierge dédié</strong> vous contacte par WhatsApp sous 24h.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #eee;">
                    <p style="margin:0;color:#444;font-size:14px;">
                      <span style="display:inline-block;width:24px;height:24px;background:#DAC0A3;border-radius:50%;text-align:center;line-height:24px;font-weight:700;color:#0F2C59;margin-right:10px;font-size:12px;">2</span>
                      Nous recueillons vos <strong>détails de vol</strong> (compagnie, heure d'arrivée AIBD).
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <p style="margin:0;color:#444;font-size:14px;">
                      <span style="display:inline-block;width:24px;height:24px;background:#DAC0A3;border-radius:50%;text-align:center;line-height:24px;font-weight:700;color:#0F2C59;margin-right:10px;font-size:12px;">3</span>
                      Notre équipe prépare votre <strong>accueil Teranga</strong> et votre logement.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- WhatsApp CTA -->
          <tr>
            <td align="center" style="padding:0 40px 36px;">
              <a href="${waLink}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;letter-spacing:0.5px;">
                💬 Contacter votre Concierge sur WhatsApp
              </a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2C59;">
    <tr>
      <td align="center" style="padding:24px 20px;">
        <p style="color:#a0b4cc;margin:0 0 6px;font-size:12px;">Le BADIL Conciergerie Dakar — Excellence & Service Teranga</p>
        <p style="color:#6a8099;margin:0;font-size:11px;">📞 WhatsApp Pro : +221 77 000 00 00 · ✉️ ${process.env.BREVO_SENDER_EMAIL || 'lebadilconciergerie@gmail.com'}</p>
        <p style="color:#6a8099;margin:8px 0 0;font-size:10px;">NINEA: 009876543 · RCCM: SN.DKR.2026.B.1234</p>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/**
 * Email 1.2 : Rappel des pièces justificatives (envoyé J+1 après la réservation si dossier incomplet)
 * NOTE : Cet email peut être déclenché manuellement ou via un cron job futur.
 */
function buildDocumentReminderEmail({ studentName, packName, refCommand }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Documents requis — Le BADIL Conciergerie</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2C59;">
    <tr>
      <td align="center" style="padding:28px 20px;">
        <h1 style="color:#DAC0A3;margin:0;font-size:20px;letter-spacing:2px;">LE BADIL CONCIERGERIE</h1>
        <p style="color:#a0b4cc;margin:4px 0 0;font-size:12px;letter-spacing:1px;">DAKAR · SÉNÉGAL</p>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
    <tr>
      <td align="center" style="padding:30px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <h2 style="color:#0F2C59;margin:0 0 16px;font-size:18px;">📄 Action requise : Documents de votre dossier</h2>
              <p style="color:#444;line-height:1.7;margin:0 0 20px;">
                Bonjour <strong>${studentName}</strong>,<br><br>
                Pour finaliser la préparation de votre dossier <strong>${packName}</strong> (Réf: <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;">${refCommand}</code>), 
                nous avons besoin des documents suivants afin de lancer les visites d'appartement et les démarches administratives à Dakar.
              </p>

              <table width="100%" cellpadding="10" cellspacing="0" style="background:#f8f5f0;border-radius:8px;margin-bottom:24px;">
                <tr><td style="color:#0F2C59;font-weight:600;font-size:14px;">📋 Documents à nous transmettre :</td></tr>
                <tr><td style="padding-left:16px;">
                  <p style="color:#444;font-size:14px;margin:4px 0;">✅ Copie du <strong>passeport</strong> (pages 1 et 2)</p>
                  <p style="color:#444;font-size:14px;margin:4px 0;">✅ <strong>Attestation d'inscription</strong> ou lettre d'admission de votre école</p>
                  <p style="color:#444;font-size:14px;margin:4px 0;">✅ Pièce d'identité du <strong>garant</strong> (parent ou tuteur légal)</p>
                  <p style="color:#444;font-size:14px;margin:4px 0;">✅ Numéro de vol et heure d'arrivée à <strong>l'AIBD</strong> (si disponible)</p>
                </td></tr>
              </table>

              <p style="color:#444;line-height:1.7;margin:0 0 24px;">
                Envoyez ces documents directement via <strong>WhatsApp</strong> à votre concierge dédié ou par email en réponse à ce message. Votre dossier sera traité sous <strong>24h</strong>.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://wa.me/221770000000?text=${encodeURIComponent(`Bonjour Le BADIL, je vous envoie mes documents pour le dossier ${refCommand}`)}" 
                       style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:13px 28px;border-radius:50px;font-weight:700;font-size:14px;">
                      📎 Envoyer mes documents par WhatsApp
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2C59;">
    <tr>
      <td align="center" style="padding:20px;">
        <p style="color:#6a8099;margin:0;font-size:11px;">Le BADIL Conciergerie Dakar · ${process.env.BREVO_SENDER_EMAIL || 'lebadilconciergerie@gmail.com'}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// =========================================================================
// API ENDPOINT: CREATE PAYTECH PAYMENT REQUEST
// =========================================================================
app.post('/api/create-payment', async (req, res) => {
  try {
    const { packId, studentName, email, whatsapp, school, date, paymentMethod } = req.body;

    const pack = PACK_PRICES[packId] || PACK_PRICES['vip'];
    const refCommand = `BADIL-${Date.now()}`;

    // PUBLIC_URL = URL HTTPS publique (ngrok ou domaine production)
    // SITE_URL   = URL de redirection success/cancel (peut rester localhost)
    const siteUrl   = process.env.SITE_URL   || `http://localhost:${PORT}`;
    const publicUrl = process.env.PUBLIC_URL  || siteUrl;

    // PayTech EXIGE HTTPS pour callback_url — bloquer si encore en localhost
    if (!publicUrl.startsWith('https://')) {
      console.error(`[PayTech] ❌ callback_url doit être HTTPS. PUBLIC_URL actuel: "${publicUrl}"`);
      console.error(`[PayTech] 👉 Lancez ngrok : npx ngrok http 8080`);
      console.error(`[PayTech] 👉 Puis ajoutez dans .env : PUBLIC_URL=https://xxxx.ngrok-free.app`);
      return res.status(400).json({
        success: false,
        message: `PayTech exige une URL HTTPS pour le callback. Configurez PUBLIC_URL dans .env avec votre URL ngrok (ex: https://xxxx.ngrok-free.app) ou votre domaine de production.`,
        solution: 'Lancez : npx ngrok http 8080  —  puis ajoutez PUBLIC_URL=https://votre-url.ngrok-free.app dans le fichier .env'
      });
    }

    // Nettoyer les noms pour éviter les caractères spéciaux rejetés par PayTech
    const cleanItemName = `Le BADIL Conciergerie - ${pack.name}`.replace(/[^a-zA-Z0-9 \-_().,']/g, '');
    const cleanCommandName = `Reservation Etudiante - ${studentName} (${school || 'Ecole non precisee'})`.replace(/[^a-zA-Z0-9 \-_().,']/g, '');

    const paytechBody = {
      item_name:    cleanItemName,
      item_price:   pack.price,           // integer requis par PayTech
      currency:     'xof',                // IMPORTANT: minuscules obligatoires
      ref_command:  refCommand,
      command_name: cleanCommandName,
      env:          process.env.PAYTECH_ENV || 'test',
      ipn_url:      `${publicUrl}/api/paytech-ipn`,
      callback_url: `${publicUrl}/api/paytech-ipn`,
      success_url:  `${publicUrl}/?payment=success&pack=${packId}&name=${encodeURIComponent(studentName)}&ref=${refCommand}`,
      cancel_url:   `${publicUrl}/?payment=cancel&ref=${refCommand}`,
      custom_field: JSON.stringify({
        studentName,
        email,
        whatsapp,
        school,
        arrivalDate: date,
        packId,
        packName: pack.name,
        paymentMethod
      })
    };

    console.log(`[PayTech Request] Ref: ${refCommand} | Pack: ${pack.name} | Price: ${pack.price} FCFA | Client: ${studentName}`);

    const response = await fetch('https://paytech.sn/api/payment/request-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API_KEY':    process.env.PAYTECH_API_KEY,
        'API_SECRET': process.env.PAYTECH_API_SECRET
      },
      body: JSON.stringify(paytechBody)
    });

    const data = await response.json();
    console.log('[PayTech Response]', data);

    if (data.success === 1 && data.redirect_url) {
      return res.json({
        success: true,
        redirectUrl: data.redirect_url,
        token: data.token,
        refCommand
      });
    } else {
      return res.status(400).json({
        success: false,
        message: data.message || 'Erreur lors de la création de la session de paiement PayTech.',
        raw: data
      });
    }

  } catch (error) {
    console.error('[PayTech Error]', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors de la connexion à PayTech.',
      error: error.message
    });
  }
});

// =========================================================================
// API ENDPOINT: PAYTECH IPN — Notification Instantanée de Paiement
// =========================================================================
app.post('/api/paytech-ipn', async (req, res) => {
  try {
    const {
      type_event,
      ref_command,
      item_name,
      item_price,
      api_key_sha256,
      api_secret_sha256,
      custom_field
    } = req.body;

    console.log(`🔔 [PayTech IPN] Event: ${type_event} | Ref: ${ref_command} | Item: ${item_name} | Montant: ${item_price} FCFA`);

    // Vérification de la signature SHA256
    const expectedKeyHash    = crypto.createHash('sha256').update(process.env.PAYTECH_API_KEY).digest('hex');
    const expectedSecretHash = crypto.createHash('sha256').update(process.env.PAYTECH_API_SECRET).digest('hex');

    const signatureOk = (api_key_sha256 === expectedKeyHash && api_secret_sha256 === expectedSecretHash);

    if (!signatureOk) {
      console.warn('⚠️ [PayTech IPN] Signature non vérifiée — paiement ignoré.');
      return res.status(200).send('OK'); // Toujours répondre 200 à PayTech
    }

    console.log('✅ [PayTech IPN] Signature vérifiée — Paiement confirmé !');

    // Décoder les données custom du client
    let clientData = {};
    try {
      clientData = typeof custom_field === 'string' ? JSON.parse(custom_field) : (custom_field || {});
    } catch (e) {
      console.warn('[PayTech IPN] Impossible de parser custom_field:', custom_field);
    }

    const { studentName, email, school, arrivalDate, packName } = clientData;

    // Sauvegarder la réservation dans data/reservations.json
    try {
      const resData = readData(RESERVATIONS_FILE);
      resData.reservations = resData.reservations || [];
      // Éviter les doublons par ref_command
      const existingIdx = resData.reservations.findIndex(r => r.ref === ref_command);
      const resRecord = {
        ref: ref_command,
        studentName: studentName || 'Étudiant',
        email: email || '',
        packName: packName || item_name,
        school: school || 'N/A',
        arrivalDate: arrivalDate || 'À confirmer',
        amount: parseInt(item_price) || 0,
        status: type_event === 'sale_complete' ? 'CONFIRMED' : type_event,
        rawEvent: type_event,
        date: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        resData.reservations[existingIdx] = resRecord;
      } else {
        resData.reservations.push(resRecord);
      }
      writeData(RESERVATIONS_FILE, resData);
      console.log(`💾 [Reservations] Réservation enregistrée : ${ref_command} (${studentName || 'Client'})`);
    } catch (saveErr) {
      console.error('❌ [Reservations Error] Erreur sauvegarde réservation:', saveErr.message);
    }

    // =========================================================================
    // ENVOI EMAIL DE CONFIRMATION (Email 1.1) via Brevo
    // =========================================================================
    if (email && type_event === 'sale_complete') {
      try {
        const htmlContent = buildConfirmationEmail({
          studentName: studentName || 'Étudiant',
          packName:    packName    || item_name,
          school:      school,
          arrivalDate: arrivalDate,
          refCommand:  ref_command,
          whatsappNumber: process.env.WHATSAPP_PHONE || '221770000000'
        });

        await sendBrevoEmail({
          to:          email,
          toName:      studentName || 'Étudiant',
          subject:     `✅ Confirmation de réservation — ${packName || item_name} | Le BADIL Conciergerie`,
          htmlContent
        });

        // =========================================================================
        // COPIE EMAIL INTERNE vers Le BADIL (pour que l'équipe soit alertée)
        // =========================================================================
        const internalHtml = `
          <h3>🔔 Nouvelle réservation confirmée via PayTech</h3>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Référence</b></td><td style="padding:6px;border:1px solid #ddd;">${ref_command}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Étudiant</b></td><td style="padding:6px;border:1px solid #ddd;">${studentName || 'N/A'}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Email client</b></td><td style="padding:6px;border:1px solid #ddd;">${email}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Pack souscrit</b></td><td style="padding:6px;border:1px solid #ddd;">${packName || item_name}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>École</b></td><td style="padding:6px;border:1px solid #ddd;">${school || 'N/A'}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Date arrivée AIBD</b></td><td style="padding:6px;border:1px solid #ddd;">${arrivalDate || 'À confirmer'}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Montant payé</b></td><td style="padding:6px;border:1px solid #ddd;"><b>${parseInt(item_price).toLocaleString('fr-FR')} FCFA</b></td></tr>
          </table>
          <p style="margin-top:16px;color:#888;font-size:12px;">Notification automatique Le BADIL Conciergerie Server — ${new Date().toLocaleString('fr-FR')}</p>
        `;

        await sendBrevoEmail({
          to:          process.env.BREVO_SENDER_EMAIL || 'lebadilconciergerie@gmail.com',
          toName:      'Équipe Le BADIL',
          subject:     `🔔 Nouvelle réservation PayTech : ${studentName || 'Client'} — ${packName || item_name}`,
          htmlContent: internalHtml
        });

      } catch (emailErr) {
        // Ne pas bloquer la réponse à PayTech si l'email échoue
        console.error('❌ [Brevo] Erreur lors de l\'envoi de l\'email de confirmation:', emailErr.message);
      }
    }

    res.status(200).send('OK');

  } catch (err) {
    console.error('❌ [PayTech IPN Error]', err);
    res.status(500).send('IPN Error');
  }
});

// =========================================================================
// API ENDPOINT: ENVOI MANUEL DU RAPPEL DE DOCUMENTS (Email 1.2)
// Peut être appelé via un cron ou manuellement depuis un dashboard admin.
// POST /api/send-document-reminder { email, studentName, packName, refCommand }
// =========================================================================
app.post('/api/send-document-reminder', async (req, res) => {
  try {
    const { email, studentName, packName, refCommand } = req.body;

    if (!email || !studentName || !refCommand) {
      return res.status(400).json({ success: false, message: 'Champs email, studentName et refCommand requis.' });
    }

    const htmlContent = buildDocumentReminderEmail({ studentName, packName, refCommand });

    await sendBrevoEmail({
      to:          email,
      toName:      studentName,
      subject:     `📄 Documents requis pour votre dossier (Réf: ${refCommand}) — Le BADIL Conciergerie`,
      htmlContent
    });

    res.json({ success: true, message: `Email de rappel envoyé à ${email}` });

  } catch (err) {
    console.error('❌ [send-document-reminder]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// API ENDPOINT: TEST EMAIL — pour vérifier la config Brevo
// GET /api/test-email?to=votre@email.com
// =========================================================================
app.get('/api/test-email', async (req, res) => {
  const to = req.query.to || process.env.BREVO_SENDER_EMAIL;

  if (!to) {
    return res.status(400).json({ error: 'Paramètre ?to=email requis.' });
  }

  try {
    const result = await sendBrevoEmail({
      to,
      toName:      'Test Le BADIL',
      subject:     '🧪 Test Email — Le BADIL Conciergerie Dakar',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#0F2C59;border-radius:12px;color:#DAC0A3;text-align:center;">
          <h2 style="color:#DAC0A3;margin-bottom:8px;">✅ Configuration Brevo Active !</h2>
          <p style="color:#a0b4cc;">Le module email <strong>Le BADIL Conciergerie</strong> fonctionne correctement.</p>
          <p style="color:#6a8099;font-size:12px;margin-top:20px;">Envoyé le ${new Date().toLocaleString('fr-FR')}</p>
        </div>
      `
    });

    if (result.skipped) {
      return res.json({ success: false, message: 'BREVO_API_KEY manquant dans .env — configurez votre clé API Brevo.' });
    }

    res.json({ success: true, message: `Email de test envoyé à ${to}`, brevo: result });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// START SERVER (Local) OU EXPORT (Vercel Serverless)
// =========================================================================
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const brevoStatus = process.env.BREVO_API_KEY ? '✅ CONFIGURÉ' : '⚠️  MANQUANT (ajoutez BREVO_API_KEY dans .env)';
    console.log(`==================================================`);
    console.log(`🚀 LE BADIL CONCIERGERIE — SERVEUR ACTIF (PORT ${PORT})`);
    console.log(`💳 PayTech  : ${process.env.PAYTECH_API_KEY ? '✅ CONFIGURÉ' : '❌ MANQUANT'}`);
    console.log(`✉️  Brevo   : ${brevoStatus}`);
    console.log(`🔐 Admin    : http://localhost:${PORT}/admin`);
    console.log(`🌐 Site     : http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}

module.exports = app;
