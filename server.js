require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const session = require('express-session');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8080;

// Root directory: on Vercel, __dirname is api/ so APP_ROOT is set by api/index.js
const ROOT_DIR = process.env.APP_ROOT || __dirname;

// Data file paths
const SCHOOLS_FILE = path.join(ROOT_DIR, 'data', 'schools.json');
const RESERVATIONS_FILE = path.join(ROOT_DIR, 'data', 'reservations.json');
const USERS_FILE = path.join(ROOT_DIR, 'data', 'users.json');
const SETTINGS_FILE = path.join(ROOT_DIR, 'data', 'settings.json');
const LEADS_FILE = path.join(ROOT_DIR, 'data', 'corporate_leads.json');
const VISITS_FILE = path.join(ROOT_DIR, 'data', 'visits.json');

// Helper: Get merged settings
function getSettings() {
  const defaultSettings = {
    general: {
      whatsapp: "221710923333",
      whatsappDisplay: "+221 71 092 33 33",
      email: "contact@lebadilconciergerie.com",
      companyName: "LE BADIL",
      address: "Hann Maristes 1/E, Villa n° 116, Hann, Dakar",
      website: "www.lebadilconciergerie.com",
      ninea: "008964365",
      rccm: "SN.DKR.2021.A.36293"
    },
    banking: {
      beneficiary: "LE BADIL CONCIERGERIE SUARL",
      bankName: "CBAO Groupe Attijariwafa Bank",
      bankBranch: "Dakar Almadies / Plateau",
      bankCode: "SN012",
      branchCode: "01234",
      accountNumber: "012345678901",
      ribKey: "45",
      iban: "SN12 SN01 2012 3412 3456 7890 145",
      swift: "CBAOSNDA"
    },
    pricing: {
      teranga: 75000,
      logement: 150000,
      integration: 60000,
      vip: 250000,
      journee: 35000,
      saly: 95000,
      goree: 40000,
      saloum: 95000
    },
    gateways: {
      paytechEnv: "",
      paytechApiKey: "",
      paytechApiSecret: ""
    }
  };
  const data = readData(SETTINGS_FILE);
  return {
    general: { ...defaultSettings.general, ...(data.general || {}) },
    banking: { ...defaultSettings.banking, ...(data.banking || {}) },
    pricing: { ...defaultSettings.pricing, ...(data.pricing || {}) },
    gateways: { ...defaultSettings.gateways, ...(data.gateways || {}) }
  };
}

function formatLegalIds(settings) {
  const g = (settings || getSettings()).general || {};
  const parts = [];
  if (g.ninea) parts.push(`NINEA: ${g.ninea}`);
  if (g.rccm) parts.push(`RCCM: ${g.rccm}`);
  return parts.join(' · ');
}

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
    } catch { }
  }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS, images, etc.) using ROOT_DIR (Vercel-compatible)
app.use(express.static(ROOT_DIR, {
  index: false, // index.html served by explicit routes below
  extensions: ['css', 'js', 'png', 'jpg', 'svg', 'ico', 'woff', 'woff2', 'html', 'webp']
}));

// Session middleware (for admin auth)
app.use(session({
  secret: process.env.ADMIN_SESSION_SECRET || 'badil_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 heures
}));

// Middleware: vérifier l'authentification admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Non authentifié.' });
  return res.redirect('/admin');
}

// Middleware: vérifier le rôle de l'utilisateur (admin, gerante, staff)
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.isAdmin) {
      if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Non authentifié.' });
      return res.redirect('/admin');
    }
    const userRoleCode = req.session.user?.roleCode || 'staff';
    if (allowedRoles.includes(userRoleCode)) {
      return next();
    }
    return res.status(403).json({ error: 'Action non autorisée pour votre profil utilisateur.' });
  };
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
    const roleCode = foundUser.roleCode || (
      foundUser.login === 'admin' ? 'admin' :
        (foundUser.role && (foundUser.role.toLowerCase().includes('gérant') || foundUser.role.toLowerCase().includes('direct')) ? 'gerante' : 'staff')
    );
    req.session.user = {
      id: foundUser.id,
      name: foundUser.name,
      login: foundUser.login,
      role: foundUser.role,
      roleCode: roleCode,
      phone: foundUser.phone || ''
    };
    return res.json({ success: true, redirect: '/admin/dashboard', user: req.session.user });
  }

  // 2. Fallback .env pour le superadmin de secours
  const validLogin = process.env.ADMIN_LOGIN || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'LeBadil2026!';
  if (login.trim() === validLogin && password === validPassword) {
    req.session.isAdmin = true;
    req.session.user = {
      id: 'usr-root',
      name: 'Développeur & Admin',
      login: validLogin,
      role: 'Développeur (Super Admin)',
      roleCode: 'admin',
      phone: '+221 71 092 33 33'
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
    user: req.session.user || { name: 'Administrateur', role: 'Superviseur', roleCode: 'admin' }
  });
});

// Visites de la page d'accueil — statistiques agrégées sans données personnelles
app.get('/api/admin/visits', requireAdmin, (req, res) => {
  const data = readData(VISITS_FILE);
  const days = Number.parseInt(req.query.days, 10);
  const range = Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 14;
  const byDay = data.byDay || {};
  const today = new Date();
  const visitsByDay = Array.from({ length: range }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (range - index - 1));
    const key = date.toISOString().slice(0, 10);
    return { date: key, visits: Number(byDay[key]) || 0 };
  });

  res.json({
    total: Number(data.total) || 0,
    visitsByDay
  });
});

// =========================================================================
// API — GESTION DE L'ÉQUIPE (Membres & Rôles)
// =========================================================================
app.get('/api/admin/users', requireRole(['admin', 'gerante']), (req, res) => {
  const usersData = readData(USERS_FILE);
  const users = (usersData.users || []).map(u => ({
    id: u.id,
    name: u.name,
    login: u.login,
    role: u.role,
    roleCode: u.roleCode || (u.login === 'admin' ? 'admin' : (u.role && (u.role.toLowerCase().includes('gérant') || u.role.toLowerCase().includes('direct')) ? 'gerante' : 'staff')),
    phone: u.phone || '',
    status: u.status || 'active',
    createdAt: u.createdAt
  }));
  res.json(users);
});

app.post('/api/admin/users', requireRole(['admin', 'gerante']), (req, res) => {
  const { name, login, password, role, phone } = req.body;
  if (!name || !login || !password) {
    return res.status(400).json({ error: 'Le nom, l\'identifiant et le mot de passe sont obligatoires.' });
  }

  const usersData = readData(USERS_FILE);
  usersData.users = usersData.users || [];

  if (usersData.users.some(u => u.login.toLowerCase() === login.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Cet identifiant de connexion est déjà utilisé par un autre collaborateur.' });
  }

  const isSuperAdmin = req.session.user?.roleCode === 'admin';
  let targetRoleCode = 'staff';
  if (isSuperAdmin) {
    if (role && (role.toLowerCase().includes('admin') || role.toLowerCase().includes('développeur'))) {
      targetRoleCode = 'admin';
    } else if (role && (role.toLowerCase().includes('gérant') || role.toLowerCase().includes('direct'))) {
      targetRoleCode = 'gerante';
    }
  }

  const newUser = {
    id: `usr-${Date.now()}`,
    name: name.trim(),
    login: login.trim().toLowerCase(),
    password: password.trim(),
    role: role || 'Collaborateur Conciergerie',
    roleCode: targetRoleCode,
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
      roleCode: newUser.roleCode,
      phone: newUser.phone,
      status: newUser.status,
      createdAt: newUser.createdAt
    }
  });
});

app.delete('/api/admin/users/:id', requireRole(['admin', 'gerante']), (req, res) => {
  const usersData = readData(USERS_FILE);
  usersData.users = usersData.users || [];

  if (req.session.user && req.session.user.id === req.params.id) {
    return res.status(400).json({ error: 'Action refusée : Vous ne pouvez pas supprimer votre propre compte connecté.' });
  }

  const targetUser = usersData.users.find(u => u.id === req.params.id);
  if (!targetUser) {
    return res.status(404).json({ error: 'Membre non trouvé.' });
  }

  const isSuperAdmin = req.session.user?.roleCode === 'admin';
  if (targetUser.roleCode === 'admin' && !isSuperAdmin) {
    return res.status(403).json({ error: 'Action refusée : Seul le Développeur (Super Admin) peut modifier un compte administrateur.' });
  }

  usersData.users = usersData.users.filter(u => u.id !== req.params.id);
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

// Admin : ajouter un établissement (réservé au développeur / super admin)
app.post('/api/admin/schools', requireRole(['admin']), (req, res) => {
  const { name, city } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom de l\'établissement est requis.' });

  const data = readData(SCHOOLS_FILE);
  const newSchool = {
    id: `school-${Date.now()}`,
    name: name.trim(),
    city: (city || 'Dakar').trim()
  };
  data.schools = data.schools || [];
  data.schools.push(newSchool);
  writeData(SCHOOLS_FILE, data);
  res.json({ success: true, school: newSchool });
});

// Admin : supprimer un établissement (réservé au développeur / super admin)
app.delete('/api/admin/schools/:id', requireRole(['admin']), (req, res) => {
  const data = readData(SCHOOLS_FILE);
  const before = (data.schools || []).length;
  data.schools = (data.schools || []).filter(s => s.id !== req.params.id);
  if (data.schools.length === before) return res.status(404).json({ error: 'Établissement non trouvé.' });
  writeData(SCHOOLS_FILE, data);
  res.json({ success: true });
});

// =========================================================================
// API — RÉSERVATIONS (admin & gérante & staff)
// =========================================================================
app.get('/api/admin/reservations', requireAdmin, (req, res) => {
  const data = readData(RESERVATIONS_FILE);
  const reservations = (data.reservations || []).slice().reverse(); // plus récentes en premier
  res.json(reservations);
});

// =========================================================================
// API — PARAMÈTRES & CONFIGURATION DYNAMIQUE (réservé Développeur / Admin)
// =========================================================================

// Public settings (accessible par le frontend public)
app.get('/api/settings', (req, res) => {
  const s = getSettings();
  res.json({
    general: s.general,
    banking: s.banking,
    pricing: s.pricing
  });
});

// Admin settings (protégé, inclut les clés d'API, réservé Dev)
app.get('/api/admin/settings', requireRole(['admin']), (req, res) => {
  res.json(getSettings());
});

// Mise à jour des settings admin (réservé Dev)
app.post('/api/admin/settings', requireRole(['admin']), (req, res) => {
  try {
    const current = getSettings();
    const updated = {
      general: { ...current.general, ...(req.body.general || {}) },
      banking: { ...current.banking, ...(req.body.banking || {}) },
      pricing: { ...current.pricing, ...(req.body.pricing || {}) },
      gateways: { ...current.gateways, ...(req.body.gateways || {}) }
    };
    writeData(SETTINGS_FILE, updated);
    console.log('⚙️ [Settings] Paramètres mis à jour avec succès par l\'administrateur');
    res.json({ success: true, message: 'Paramètres enregistrés avec succès !', settings: updated });
  } catch (err) {
    console.error('❌ [Settings Error]', err);
    res.status(500).json({ success: false, message: 'Impossible d\'enregistrer les paramètres.' });
  }
});

// Validation manuelle d'un virement bancaire (admin & gérante)
app.post('/api/admin/reservations/:ref/confirm-virement', requireRole(['admin', 'gerante']), async (req, res) => {
  const { ref } = req.params;
  try {
    const resData = readData(RESERVATIONS_FILE);
    resData.reservations = resData.reservations || [];
    const idx = resData.reservations.findIndex(r => r.ref === ref);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Réservation introuvable.' });
    }

    const booking = resData.reservations[idx];
    booking.status = 'CONFIRMED';
    booking.confirmedAt = new Date().toISOString();
    booking.confirmedBy = (req.session.user && req.session.user.name) ? req.session.user.name : 'Administrateur';
    booking.paymentMethod = 'Virement Bancaire (Validé CBAO)';
    resData.reservations[idx] = booking;
    writeData(RESERVATIONS_FILE, resData);

    console.log(`✅ [Virement Validé] Réservation ${ref} confirmée par l'admin.`);

    // Envoi de l'email officiel de confirmation (Email 1.1) au client
    if (booking.email) {
      try {
        const confirmHtml = buildConfirmationEmail({
          studentName: booking.studentName,
          packName: booking.packName,
          school: booking.school,
          arrivalDate: booking.arrivalDate,
          refCommand: booking.ref,
          whatsappNumber: booking.whatsapp
        });
        await sendEmail({
          to: booking.email,
          toName: booking.studentName,
          subject: `✅ Paiement Validé par Virement — Bienvenue chez Le BADIL Conciergerie [Réf: ${booking.ref}]`,
          htmlContent: confirmHtml
        });
      } catch (emErr) {
        console.warn('⚠️ [SMTP OVH Warning] Email de validation virement non envoyé:', emErr.message);
      }
    }

    res.json({
      success: true,
      message: `Virement pour la réservation ${ref} validé ! Le dossier est désormais CONFIRMÉ.`,
      booking
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Serve static frontend files (après les routes admin pour ne pas intercepter)
app.use(express.static(path.join(ROOT_DIR), { index: false }));

// Route racine explicite — compte chaque chargement de la page d'accueil
app.get('/', (req, res) => {
  const data = readData(VISITS_FILE);
  const today = new Date().toISOString().slice(0, 10);
  data.total = (Number(data.total) || 0) + 1;
  data.byDay = data.byDay || {};
  data.byDay[today] = (Number(data.byDay[today]) || 0) + 1;
  writeData(VISITS_FILE, data);
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});
app.get('/mentions-legales.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'mentions-legales.html')));
app.get('/cgv.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'cgv.html')));
app.get('/confidentialite.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'confidentialite.html')));

// =========================================================================
// PACK PRICES (FCFA)
// =========================================================================
const PACK_PRICES = {
  'teranga': { name: 'Pack Teranga (Accueil AIBD & Transfert)', price: 75000 },
  'logement': { name: 'Pack Logement Serein (Chasse & Abonnements)', price: 150000 },
  'integration': { name: 'Pack Intégration (Transport & Santé)', price: 60000 },
  'vip': { name: 'Pack VIP All-Inclusive (Clé en Main)', price: 250000 },
  'escapade-dakar': { name: 'Escapade Dakar Vivant & Arty', price: 25000 },
  'escapade-goree': { name: 'Journée Île de Gorée Mémoire & Histoire', price: 40000 },
  'escapade-saly': { name: 'Journée Détente & Sports Nautiques Saly', price: 55000 },
  'escapade-saloum': { name: 'Aventure Bolongs & Pêche Saloum', price: 75000 },
  'escapade-saloum-safari': { name: 'Safari Ornithologique & Bivouac Saloum', price: 95000 }
};

// =========================================================================
// SMTP EMAIL MODULE — OVH ZIMBRA
// =========================================================================

/**
 * Envoie un email HTML via SMTP OVH Zimbra.
 * @param {object} options - { to, toName, subject, htmlContent }
 */
async function sendEmail({ to, toName, subject, htmlContent }) {
  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPassword = process.env.SMTP_PASSWORD || '';
  const smtpSecure = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';

  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.warn('⚠️ [SMTP OVH] Configuration SMTP incomplète — email non envoyé.');
    return { skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPassword
    }
  });

  const senderName = process.env.SMTP_SENDER_NAME || 'Le BADIL Conciergerie';
  const senderEmail = smtpUser;

  try {
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: toName ? `"${toName}" <${to}>` : to,
      subject,
      html: htmlContent
    });

    console.log(`✅ [SMTP OVH] Email envoyé à ${to} — Sujet: "${subject}" | ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error(`❌ [SMTP OVH] Échec envoi à ${to}:`, error.message);
    throw error;
  }
}


// =========================================================================
// TEMPLATES EMAILS HTML — CORPORATE BLEU MARINE & OR CHAMPAGNE
// =========================================================================

/**
 * Email 1.1 : Confirmation de réservation & bienvenue (envoyé immédiatement après paiement)
 */
function buildVirementEmail({ studentName, packName, school, arrivalDate, refCommand, amount, whatsappNumber }) {
  const waLink = `https://wa.me/${whatsappNumber ? whatsappNumber.replace(/[^0-9]/g, '') : '221710923333'}?text=${encodeURIComponent(
    `Bonjour Le BADIL Conciergerie, j'ai sélectionné le paiement par virement bancaire pour le ${packName} (Réf: ${refCommand}). Étudiant: ${studentName}.`
  )}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ordre de Réservation par Virement Bancaire - Le BADIL</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2C59;padding:25px 20px;text-align:center;">
    <tr><td>
      <h1 style="color:#DAC0A3;margin:0;font-size:22px;letter-spacing:2px;text-transform:uppercase;">LE BADIL CONCIERGERIE</h1>
      <p style="color:#a0b4cc;margin:6px 0 0;font-size:12px;letter-spacing:1px;">DAKAR · SÉNÉGAL</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#DAC0A3;padding:12px 20px;text-align:center;">
    <tr><td>
      <strong style="color:#0F2C59;font-size:13px;letter-spacing:1px;text-transform:uppercase;">
        📋 RÉSERVATION ENREGISTRÉE — PAIEMENT PAR VIREMENT BANCAIRE
      </strong>
    </td></tr>
  </table>
  <div style="max-width:600px;margin:25px auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #e0e0e0;box-shadow:0 4px 15px rgba(0,0,0,0.05);">
    <h2 style="color:#0F2C59;font-size:18px;margin-top:0;">Bonjour ${studentName},</h2>
    <p style="color:#444;font-size:14px;line-height:1.6;">
      Votre réservation pour le <strong>${packName}</strong> (${school || 'Établissement Dakar'}) a bien été pré-enregistrée. Votre concierge Le BADIL prendra en charge votre dossier dès réception de votre virement.
    </p>

    <div style="background:#0F2C59;color:#DAC0A3;padding:12px 20px;border-radius:6px;text-align:center;margin:20px 0;">
      <span style="font-size:11px;color:#a0b4cc;text-transform:uppercase;letter-spacing:1px;display:block;">Référence Obligatoire du Virement</span>
      <strong style="font-family:monospace;font-size:20px;letter-spacing:2px;">${refCommand}</strong>
    </div>

    <div style="background:#fdfbf7;border:1.5px solid #DAC0A3;border-radius:8px;padding:18px;margin:20px 0;">
      <h3 style="color:#0F2C59;margin:0 0 12px;font-size:15px;border-bottom:1px solid #DAC0A3;padding-bottom:6px;">Coordonnées Bancaires Officielles Le BADIL</h3>
      <table width="100%" style="font-size:13px;color:#333;">
        <tr><td style="padding:4px 0;color:#666;">Montant Total :</td><td style="font-weight:bold;color:#0F2C59;text-align:right;">${amount.toLocaleString('fr-FR')} FCFA</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Bénéficiaire :</td><td style="font-weight:bold;text-align:right;">LE BADIL CONCIERGERIE SUARL</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Établissement :</td><td style="font-weight:bold;text-align:right;">CBAO Groupe Attijariwafa Bank</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Code Banque / Guichet :</td><td style="font-family:monospace;text-align:right;">SN012 / 01234</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Numéro de Compte :</td><td style="font-family:monospace;text-align:right;">012345678901 (Clé 45)</td></tr>
        <tr><td style="padding:4px 0;color:#666;">IBAN Sénégal :</td><td style="font-family:monospace;font-weight:bold;color:#0F2C59;text-align:right;">SN12 SN01 2012 3412 3456 7890 145</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Code SWIFT / BIC :</td><td style="font-family:monospace;text-align:right;">CBAOSNDA</td></tr>
      </table>
    </div>

    <p style="color:#555;font-size:13px;line-height:1.5;">
      💡 <strong>Important :</strong> Indiquez la référence <strong>${refCommand}</strong> en motif de votre virement bancaire. Transmettez ensuite l'avis d'opéré à votre concierge sur WhatsApp :
    </p>

    <div style="text-align:center;margin:25px 0 10px;">
      <a href="${waLink}" style="background:#25D366;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;">💬 Contacter mon Concierge sur WhatsApp</a>
    </div>
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px;text-align:center;color:#888;font-size:12px;">
    <tr><td>© 2026 Le BADIL Conciergerie Dakar · Dakar, Sénégal</td></tr>
  </table>
</body>
</html>`;
}

function buildConfirmationEmail({ studentName, packName, school, arrivalDate, refCommand, whatsappNumber }) {
  const waLink = `https://wa.me/${whatsappNumber || '221710923333'}?text=${encodeURIComponent(
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
        <p style="color:#6a8099;margin:0;font-size:11px;">📞 WhatsApp Pro : ${whatsappNumber || '+221 71 092 33 33'} · ✉️ ${process.env.SMTP_USER || 'contact@lebadilconciergerie.com'}</p>
        <p style="color:#6a8099;margin:8px 0 0;font-size:10px;">${formatLegalIds() || 'Le BADIL · Dakar'}</p>
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
                    <a href="https://wa.me/221710923333?text=${encodeURIComponent(`Bonjour Le BADIL, je vous envoie mes documents pour le dossier ${refCommand}`)}"
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
        <p style="color:#6a8099;margin:0;font-size:11px;">Le BADIL Conciergerie Dakar · ${process.env.SMTP_USER || 'contact@lebadilconciergerie.com'}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Email 2.1 : Accusé de réception officiel de devis séminaire & corporate (immédiat)
 */
function buildCorporateLeadEmail({ companyName, contactName, contactTitle, email, phone, eventType, participants, days, destination, budget, services, totalEstimate, refLead, notes }) {
  const waPhone = ((getSettings().general && getSettings().general.whatsapp) || '221710923333').replace(/[^0-9]/g, '');
  const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(
    `Bonjour Le BADIL, je vous contacte au sujet de notre demande de devis séminaire corporate (${refLead}) pour l'entreprise ${companyName}.`
  )}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accusé de réception Devis Séminaire — Le BADIL Conciergerie</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2C59;">
    <tr>
      <td align="center" style="padding:32px 20px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <div style="width:54px;height:54px;background:#DAC0A3;border-radius:12px;display:inline-block;line-height:54px;text-align:center;font-size:24px;font-weight:900;color:#0F2C59;margin-bottom:12px;">B</div>
              <h1 style="color:#DAC0A3;margin:8px 0 4px;font-size:22px;letter-spacing:2px;text-transform:uppercase;">LE BADIL CONCIERGERIE</h1>
              <p style="color:#a0b4cc;margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;">DÉPARTEMENT CORPORATE & BUSINESS EVENTS · DAKAR</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#DAC0A3;">
    <tr>
      <td align="center" style="padding:10px 20px;">
        <strong style="color:#0F2C59;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">
          💼 ACCUSÉ DE RÉCEPTION — PROJET SÉMINAIRE & ÉVÉNEMENT CORPORATE
        </strong>
      </td>
    </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(15,44,89,0.08);border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="padding:36px;">
              <h2 style="color:#0F2C59;font-size:20px;margin-top:0;margin-bottom:12px;">Bonjour ${contactName}${contactTitle ? ' (' + contactTitle + ')' : ''},</h2>
              <p style="color:#475569;font-size:14px;line-height:1.6;margin-bottom:20px;">
                Nous vous remercions pour l'intérêt que vous portez à <strong>Le BADIL Conciergerie Dakar</strong>. Nous avons le plaisir de vous confirmer la bonne prise en charge de votre projet d'événement professionnel pour le compte de l'entreprise <strong>${companyName}</strong>.
              </p>
              <div style="background:#0F2C59;color:#DAC0A3;padding:14px 20px;border-radius:8px;text-align:center;margin:24px 0;">
                <span style="font-size:11px;color:#a0b4cc;text-transform:uppercase;letter-spacing:1px;display:block;">Numéro de Dossier Corporate</span>
                <strong style="font-family:monospace;font-size:20px;letter-spacing:2px;">${refLead}</strong>
              </div>
              <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:8px;padding:20px;margin:24px 0;">
                <h3 style="color:#0F2C59;margin:0 0 14px;font-size:15px;border-bottom:1px solid #E2E8F0;padding-bottom:8px;">
                  📋 Synthèse de votre Cahier des Charges
                </h3>
                <table width="100%" style="font-size:13px;color:#334155;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;color:#64748B;width:40%;">Entreprise :</td><td style="font-weight:700;color:#0F2C59;">${companyName}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748B;">Contact Décideur :</td><td>${contactName} ${contactTitle ? '— ' + contactTitle : ''}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748B;">Téléphone / WhatsApp :</td><td>${phone}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748B;">Format d'Événement :</td><td style="font-weight:600;color:#0F2C59;">${eventType}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748B;">Effectif prévu :</td><td><strong>${participants} participants</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#64748B;">Durée envisagée :</td><td><strong>${days} jour(s)</strong></td></tr>
                  <tr><td style="padding:6px 0;color:#64748B;">Cadre / Destination :</td><td>${destination || 'À affiner avec le chef de projet'}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748B;">Enveloppe Budgétaire :</td><td>${budget || 'Non spécifiée'}</td></tr>
                  ${services ? `<tr><td style="padding:6px 0;color:#64748B;">Prestations ciblées :</td><td style="color:#059669;font-weight:600;">${services}</td></tr>` : ''}
                  ${totalEstimate ? `<tr><td style="padding:6px 0;color:#64748B;">Estimation Indicative HT :</td><td style="font-weight:800;color:#D4AF37;font-size:15px;">${totalEstimate}</td></tr>` : ''}
                  ${notes ? `<tr><td style="padding:6px 0;color:#64748B;vertical-align:top;">Notes & Attentes :</td><td style="font-style:italic;">${notes}</td></tr>` : ''}
                </table>
              </div>
              <div style="background:#FFFBF0;border-left:4px solid #D4AF37;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">
                <h4 style="color:#996515;margin:0 0 6px;font-size:14px;">⏱️ Notre Engagement Sous 24 Heures :</h4>
                <p style="color:#78350F;margin:0;font-size:13px;line-height:1.5;">
                  Un chef de projet événementiel dédié chez Le BADIL étudie la disponibilité des réceptifs hôteliers (Dakar Plateau, Almadies, Saly, Gorée ou Saloum) et coordonne la régie logistique. Il prendra contact directement avec vous pour affiner le budget et vous soumettre un devis exécutif complet.
                </p>
              </div>
              <div style="text-align:center;margin:32px 0 12px;">
                <a href="${waLink}" style="background:#25D366;color:#fff;padding:13px 30px;border-radius:50px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;box-shadow:0 4px 12px rgba(37,211,102,0.3);">
                  💬 Échanger avec notre Direction Événementielle sur WhatsApp
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F2C59;">
    <tr>
      <td align="center" style="padding:22px;text-align:center;">
        <p style="color:#a0b4cc;margin:0;font-size:11px;">Le BADIL · Dakar, Sénégal${formatLegalIds() ? ' · ' + formatLegalIds() : ''}</p>
        <p style="color:#6a8099;margin:6px 0 0;font-size:11px;">Contact Corporate : ${process.env.SMTP_USER || 'contact@lebadilconciergerie.com'}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildCorporateLeadInternalNotification({ companyName, contactName, contactTitle, email, phone, eventType, participants, days, destination, budget, services, totalEstimate, refLead, notes }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:8px;padding:24px;">
      <h2 style="color:#0F2C59;border-bottom:2px solid #DAC0A3;padding-bottom:10px;margin-top:0;">🔔 Nouvelle Demande de Devis Séminaire Corporate !</h2>
      <p style="color:#333;font-size:14px;">Une entreprise vient de soumettre une demande officielle de devis via le portail en ligne :</p>
      <table width="100%" style="font-size:13px;border-collapse:collapse;margin:15px 0;">
        <tr style="background:#f4f6f9;"><td style="padding:8px;font-weight:bold;width:35%;">Réf Dossier :</td><td style="padding:8px;color:#0F2C59;font-weight:bold;">${refLead}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Entreprise :</td><td style="padding:8px;">${companyName}</td></tr>
        <tr style="background:#f4f6f9;"><td style="padding:8px;font-weight:bold;">Contact :</td><td style="padding:8px;">${contactName} (${contactTitle || 'Non renseigné'})</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Email :</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr style="background:#f4f6f9;"><td style="padding:8px;font-weight:bold;">Téléphone / WA :</td><td style="padding:8px;"><a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}">${phone}</a></td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Format :</td><td style="padding:8px;font-weight:bold;color:#0F2C59;">${eventType}</td></tr>
        <tr style="background:#f4f6f9;"><td style="padding:8px;font-weight:bold;">Participants / Durée :</td><td style="padding:8px;">${participants} pers. sur ${days} jour(s)</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Destination :</td><td style="padding:8px;">${destination}</td></tr>
        <tr style="background:#f4f6f9;"><td style="padding:8px;font-weight:bold;">Budget :</td><td style="padding:8px;">${budget}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Prestations :</td><td style="padding:8px;color:#059669;font-weight:bold;">${services}</td></tr>
        <tr style="background:#f4f6f9;"><td style="padding:8px;font-weight:bold;">Estimation HT :</td><td style="padding:8px;color:#D4AF37;font-weight:bold;">${totalEstimate}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Notes / Attentes :</td><td style="padding:8px;">${notes || 'Aucune'}</td></tr>
      </table>
      <div style="margin-top:20px;padding:12px;background:#EBF5FB;border-radius:6px;font-size:12px;color:#2E86C1;">
        ⏱️ <strong>Rappel :</strong> Contactez le client sous 24h ouvrées conformément à l'engagement qualité Le BADIL Conciergerie.
      </div>
    </div>
  `;
}

// =========================================================================
// API ENDPOINT: CREATE PAYTECH PAYMENT REQUEST
// =========================================================================
app.post('/api/create-payment', async (req, res) => {
  try {
    const { packId, addonId, studentName, email, whatsapp, school, date, paymentMethod } = req.body;

    const basePack = PACK_PRICES[packId] || PACK_PRICES['vip'];
    const addon = addonId && PACK_PRICES[addonId] && addonId !== packId ? PACK_PRICES[addonId] : null;
    const pack = addon
      ? { name: `${basePack.name} + ${addon.name}`, price: basePack.price + addon.price }
      : basePack;

    // =========================================================================
    // 1. GESTION DU PAIEMENT PAR VIREMENT BANCAIRE
    // =========================================================================
    if (paymentMethod === 'virement') {
      const refCommand = `BADIL-VIR-${Date.now()}`;
      try {
        const resData = readData(RESERVATIONS_FILE);
        resData.reservations = resData.reservations || [];
        const resRecord = {
          ref: refCommand,
          studentName: studentName || 'Étudiant',
          email: email || '',
          whatsapp: whatsapp || '',
          packName: pack.name,
          school: school || 'N/A',
          arrivalDate: date || 'À confirmer',
          amount: pack.price,
          status: 'EN_ATTENTE_VIREMENT',
          paymentMethod: 'Virement Bancaire',
          date: new Date().toISOString()
        };
        resData.reservations.push(resRecord);
        writeData(RESERVATIONS_FILE, resData);
        console.log(`🏦 [Virement] Réservation enregistrée : ${refCommand} (${studentName})`);
      } catch (err) {
        console.error('❌ [Virement Error] Erreur sauvegarde réservation:', err.message);
      }

      if (email && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        try {
          const virementHtml = buildVirementEmail({
            studentName: studentName || 'Étudiant',
            packName: pack.name,
            school,
            arrivalDate: date,
            refCommand,
            amount: pack.price,
            whatsappNumber: whatsapp
          });
          await sendEmail({
            to: email,
            toName: studentName,
            subject: `📋 Confirmation Réservation Virement Bancaire - ${pack.name} [${refCommand}]`,
            htmlContent: virementHtml
          });
        } catch (emailErr) {
          console.warn('⚠️ [Virement Email Warning] Email non envoyé:', emailErr.message);
        }
      }

      return res.json({
        success: true,
        isVirement: true,
        refCommand,
        packName: pack.name,
        amount: pack.price,
        studentName,
        bankDetails: {
          beneficiary: "LE BADIL CONCIERGERIE SUARL",
          bank: "CBAO Groupe Attijariwafa Bank (Dakar, Sénégal)",
          rib: "SN012 01234 012345678901 45",
          iban: "SN12 SN01 2012 3412 3456 7890 145",
          swift: "CBAOSNDA",
          ref: refCommand
        }
      });
    }

    // =========================================================================
    // 2. GESTION DU PAIEMENT EN LIGNE PAYTECH (WAVE / ORANGE MONEY)
    // =========================================================================
    const refCommand = `BADIL-${Date.now()}`;

    // Auto-détection URL Vercel ou locale
    const vercelHost = process.env.VERCEL_URL ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : null;
    const siteUrl = process.env.SITE_URL || vercelHost || `http://localhost:${PORT}`;
    const publicUrl = process.env.PUBLIC_URL || siteUrl;

    const settings = getSettings();
    const paytechApiKey = (settings.gateways && settings.gateways.paytechApiKey) ? settings.gateways.paytechApiKey.trim() : (process.env.PAYTECH_API_KEY || '').trim();
    const paytechApiSecret = (settings.gateways && settings.gateways.paytechApiSecret) ? settings.gateways.paytechApiSecret.trim() : (process.env.PAYTECH_API_SECRET || '').trim();
    const paytechEnv = (settings.gateways && settings.gateways.paytechEnv) ? settings.gateways.paytechEnv : (process.env.PAYTECH_ENV || 'test');

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
      item_name: cleanItemName,
      item_price: pack.price,           // integer requis par PayTech
      currency: 'xof',                // IMPORTANT: minuscules obligatoires
      ref_command: refCommand,
      command_name: cleanCommandName,
      env: paytechEnv,
      ipn_url: `${publicUrl}/api/paytech-ipn`,
      callback_url: `${publicUrl}/api/paytech-ipn`,
      success_url: `${publicUrl}/?payment=success&pack=${packId}&name=${encodeURIComponent(studentName)}&ref=${refCommand}`,
      cancel_url: `${publicUrl}/?payment=cancel&ref=${refCommand}`,
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

    console.log(`[PayTech Request] Ref: ${refCommand} | Pack: ${pack.name} | Price: ${pack.price} FCFA | Client: ${studentName} | Env: ${paytechEnv}`);

    const response = await fetch('https://paytech.sn/api/payment/request-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API_KEY': paytechApiKey,
        'API_SECRET': paytechApiSecret
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
    const expectedKeyHash = crypto.createHash('sha256').update(process.env.PAYTECH_API_KEY).digest('hex');
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
    // ENVOI EMAIL DE CONFIRMATION (Email 1.1) via SMTP OVH
    // =========================================================================
    if (email && type_event === 'sale_complete') {
      try {
        const htmlContent = buildConfirmationEmail({
          studentName: studentName || 'Étudiant',
          packName: packName || item_name,
          school: school,
          arrivalDate: arrivalDate,
          refCommand: ref_command,
          whatsappNumber: (getSettings().general && getSettings().general.whatsappDisplay) || '+221 71 092 33 33'
        });

        await sendEmail({
          to: email,
          toName: studentName || 'Étudiant',
          subject: `✅ Confirmation de réservation — ${packName || item_name} | Le BADIL Conciergerie`,
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

        await sendEmail({
          to: process.env.SMTP_USER || 'contact@lebadilconciergerie.com',
          toName: 'Équipe Le BADIL',
          subject: `🔔 Nouvelle réservation PayTech : ${studentName || 'Client'} — ${packName || item_name}`,
          htmlContent: internalHtml
        });

      } catch (emailErr) {
        // Ne pas bloquer la réponse à PayTech si l'email échoue
        console.error('❌ [SMTP OVH] Erreur lors de l\'envoi de l\'email de confirmation:', emailErr.message);
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

    await sendEmail({
      to: email,
      toName: studentName,
      subject: `📄 Documents requis pour votre dossier (Réf: ${refCommand}) — Le BADIL Conciergerie`,
      htmlContent
    });

    res.json({ success: true, message: `Email de rappel envoyé à ${email}` });

  } catch (err) {
    console.error('❌ [send-document-reminder]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// API ENDPOINT: DEMANDE DE DEVIS CORPORATE & SÉMINAIRES (Email 2.1)
// POST /api/corporate-lead
// =========================================================================
app.post('/api/corporate-lead', async (req, res) => {
  try {
    const {
      companyName,
      contactName,
      contactTitle,
      email,
      phone,
      sector,
      eventType,
      participants,
      days,
      destination,
      budget,
      services,
      totalEstimate,
      notes
    } = req.body;

    if (!companyName || !contactName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Les champs Entreprise, Nom du contact, Email et Téléphone sont obligatoires.'
      });
    }

    const refLead = `CORP-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // 1. Sauvegarder dans corporate_leads.json
    try {
      const leadsData = readData(LEADS_FILE);
      leadsData.leads = leadsData.leads || [];
      const newLead = {
        ref: refLead,
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        contactTitle: (contactTitle || '').trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        sector: sector || 'Non renseigné',
        eventType: eventType || 'Séminaire Professionnel',
        participants: parseInt(participants) || 1,
        days: parseInt(days) || 1,
        destination: destination || 'Dakar / Petite Côte',
        budget: budget || 'À définir',
        services: Array.isArray(services) ? services.join(', ') : (services || 'Coordination logistique standard'),
        totalEstimate: totalEstimate || 'Sur devis',
        notes: (notes || '').trim(),
        status: 'NOUVEAU',
        createdAt: new Date().toISOString()
      };
      leadsData.leads.unshift(newLead);
      writeData(LEADS_FILE, leadsData);
    } catch (saveErr) {
      console.warn('⚠️ [Corporate Lead] Échec écriture fichier leads:', saveErr.message);
    }

    // 2. Envoyer l'Email 2.1 à l'entreprise / décideur via SMTP OVH
    let clientEmailSent = false;
    try {
      const clientHtml = buildCorporateLeadEmail({
        companyName,
        contactName,
        contactTitle,
        email,
        phone,
        eventType,
        participants,
        days,
        destination,
        budget,
        services: Array.isArray(services) ? services.join(', ') : services,
        totalEstimate,
        refLead,
        notes
      });

      await sendEmail({
        to: email.trim(),
        toName: contactName.trim(),
        subject: `💼 Votre projet de séminaire corporate à Dakar [Réf: ${refLead}] — Le BADIL Conciergerie`,
        htmlContent: clientHtml
      });
      clientEmailSent = true;
    } catch (emailErr) {
      console.error('❌ [Corporate Lead] Erreur envoi email client:', emailErr.message);
    }

    // 3. Notifier l'équipe Le BADIL en interne
    try {
      const internalHtml = buildCorporateLeadInternalNotification({
        companyName,
        contactName,
        contactTitle,
        email,
        phone,
        eventType,
        participants,
        days,
        destination,
        budget,
        services: Array.isArray(services) ? services.join(', ') : services,
        totalEstimate,
        refLead,
        notes
      });

      const internalRecipient = process.env.SMTP_USER || 'contact@lebadilconciergerie.com';
      await sendEmail({
        to: internalRecipient,
        toName: 'Équipe Business Events Le BADIL',
        subject: `🔔 Nouveau Lead Séminaire Corporate : ${companyName} (${participants} pers.) [${refLead}]`,
        htmlContent: internalHtml
      });
    } catch (intErr) {
      console.error('❌ [Corporate Lead] Erreur notification interne:', intErr.message);
    }

    res.json({
      success: true,
      refLead,
      emailSent: clientEmailSent,
      message: 'Votre demande a été prise en compte avec succès. Un chef de projet vous recontacte sous 24h.'
    });

  } catch (err) {
    console.error('❌ [API /corporate-lead]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/corporate-leads — Consultation des demandes corporate (protégé admin)
app.get('/api/corporate-leads', requireAdmin, (req, res) => {
  const data = readData(LEADS_FILE);
  res.json({ success: true, leads: data.leads || [] });
});

// =========================================================================
// API ENDPOINT: TEST EMAIL — pour vérifier la configuration SMTP OVH
// GET /api/test-email?to=votre@email.com
// =========================================================================
app.get('/api/test-email', requireRole(['admin']), async (req, res) => {
  const to = req.query.to || process.env.SMTP_USER;

  if (!to) {
    return res.status(400).json({ error: 'Paramètre ?to=email requis.' });
  }

  try {
    const result = await sendEmail({
      to,
      toName: 'Test Le BADIL',
      subject: '🧪 Test Email — Le BADIL Conciergerie Dakar',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#0F2C59;border-radius:12px;color:#DAC0A3;text-align:center;">
          <h2 style="color:#DAC0A3;margin-bottom:8px;">✅ Configuration SMTP OVH Active !</h2>
          <p style="color:#a0b4cc;">Le module email <strong>Le BADIL Conciergerie</strong> fonctionne correctement.</p>
          <p style="color:#6a8099;font-size:12px;margin-top:20px;">Envoyé le ${new Date().toLocaleString('fr-FR')}</p>
        </div>
      `
    });

    if (result.skipped) {
      return res.json({ success: false, message: 'Configuration SMTP OVH incomplète dans .env.' });
    }

    res.json({ success: true, message: `Email de test envoyé à ${to}`, smtp: result });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/test-email', requireRole(['admin']), async (req, res) => {
  const to = req.body.email || req.query.to || process.env.SMTP_USER;

  if (!to) {
    return res.status(400).json({ success: false, message: 'Adresse email requise.' });
  }

  try {
    const result = await sendEmail({
      to,
      toName: 'Test Le BADIL',
      subject: '🧪 Test Email — Le BADIL Conciergerie Dakar',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#0F2C59;border-radius:12px;color:#DAC0A3;text-align:center;">
          <h2 style="color:#DAC0A3;margin-bottom:8px;">✅ Configuration SMTP OVH Active !</h2>
          <p style="color:#a0b4cc;">Le module email <strong>Le BADIL Conciergerie</strong> fonctionne correctement.</p>
          <p style="color:#6a8099;font-size:12px;margin-top:20px;">Envoyé le ${new Date().toLocaleString('fr-FR')}</p>
        </div>
      `
    });

    if (result.skipped) {
      return res.json({ success: false, message: 'Configuration SMTP OVH incomplète dans .env.' });
    }

    res.json({ success: true, message: `Email de test envoyé à ${to} avec succès !`, smtp: result });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// START SERVER (Local) OU EXPORT (Vercel Serverless)
// =========================================================================
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const smtpStatus = (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) ? '✅ CONFIGURÉ' : '⚠️  INCOMPLET';
    console.log(`==================================================`);
    console.log(`🚀 LE BADIL CONCIERGERIE — SERVEUR ACTIF (PORT ${PORT})`);
    console.log(`💳 PayTech  : ${process.env.PAYTECH_API_KEY ? '✅ CONFIGURÉ' : '❌ MANQUANT'}`);
    console.log(`✉️  SMTP OVH : ${smtpStatus}`);
    console.log(`🔐 Admin    : http://localhost:${PORT}/admin`);
    console.log(`🌐 Site     : http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}

module.exports = app;
