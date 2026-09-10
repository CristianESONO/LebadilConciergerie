/* ==========================================================================
   LE BADIL CONCIERGERIE DAKAR - INTERACTIVE APPLICATION LOGIC & PAYTECH API
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  const WHATSAPP_NUMBER = '221770000000'; // Standard WhatsApp Pro Le BADIL
  const FCFA_PER_EUR = 655.957;

  function formatFCFA(amount) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
  }

  function formatEUR(fcfaAmount) {
    const eur = Math.round(fcfaAmount / FCFA_PER_EUR);
    return `~ ${eur} € TTC`;
  }

  // ==========================================
  // 1. OPTION C: DIRECT WHATSAPP LINK GENERATOR
  // ==========================================
  function generateWhatsAppUrl(messageText) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(messageText)}`;
  }

  // ==========================================
  // 2. CHECK PAYMENT RETURN STATUS (SUCCESS / CANCEL)
  // ==========================================
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const packNameParam = urlParams.get('pack') || 'VIP';
  const studentNameParam = urlParams.get('name') || 'Client';
  const refParam = urlParams.get('ref') || '';

  if (paymentStatus === 'success') {
    const successMsg = `🌟 CONFIRMATION DE PAIEMENT PAYTECH !\n\nMerci ${studentNameParam} !\nVotre paiement pour le Pack ${packNameParam.toUpperCase()} (Réf: ${refParam}) a été validé avec succès sur PayTech Sénégal (Wave / Orange Money / CB).\n\nCliquez ci-dessous pour contacter votre concierge Le BADIL sur WhatsApp et valider votre arrivée à Dakar.`;
    
    alert(successMsg);

    // Prompt user to open direct WhatsApp link
    const waText = `Bonjour Le BADIL Conciergerie, je viens de valider mon paiement PayTech en ligne pour le Pack ${packNameParam.toUpperCase()} (Étudiant: ${studentNameParam}, Réf: ${refParam}). Merci de prendre en charge mon dossier d'arrivée à Dakar !`;
    window.open(generateWhatsAppUrl(waText), '_blank');

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (paymentStatus === 'cancel') {
    alert("⚠️ Le paiement PayTech a été annulé ou interrompu.\n\nVous pouvez réessayer la réservation à tout moment ou nous contacter directement sur WhatsApp.");
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // ==========================================
  // 3. TAB NAVIGATION SYSTEM
  // ==========================================
  const navBtns = document.querySelectorAll('.nav-tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');

      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === targetTabId) {
          content.classList.add('active');
        }
      });
    });
  });

  // ==========================================
  // 4. JOUR-J LOGISTICS TIMELINE SIMULATOR
  // ==========================================
  const stepItems = document.querySelectorAll('.timeline-step-item');
  const stepTitle = document.getElementById('step-title');
  const stepDesc = document.getElementById('step-desc');
  const stepList = document.getElementById('step-list');
  const stepIcon = document.getElementById('step-icon');
  const stepBadge = document.getElementById('step-badge');
  const stepLoc = document.getElementById('step-loc');

  const stepData = {
    '1': {
      title: 'Étape 1 : Préparation & Suivi du Vol (H-24h à H-2h)',
      desc: 'Avant l\'atterrissage du vol client à l\'AIBD, notre système centralisé suit la trajectoire en temps réel pour ajuster le positionnement du chauffeur et du concierge.',
      list: [
        'Vérification en temps réel du numéro de vol & statut AIBD',
        'Briefing du chauffeur privé & inspection du véhicule climatisé',
        'Positionnement zone arrivées avec pancarte Gold Le BADIL',
        'Préparation puce SIM 4G locale & kit d\'accueil Teranga'
      ],
      icon: '🛫',
      badge: 'Statut : Prêt & Planifié',
      loc: 'Localisation : Aéroport Blaise Diagne (Diass)'
    },
    '2': {
      title: 'Étape 2 : Accueil AIBD & Remise SIM (H0 à H+30 min)',
      desc: 'Dès la sortie du terminal après les douanes, l\'étudiant est immédiatement pris en charge en toute sécurité avec ses bagages.',
      list: [
        'Jonction nominative avec la pancarte Le BADIL',
        'Assistance immédiate pour la prise en charge des valises',
        'Insertion de la puce SIM locale & activation du forfait 20 Go',
        'Message vocal de confirmation envoyé instantanément aux parents'
      ],
      icon: '🤝',
      badge: 'Statut : Prise en charge effectuée',
      loc: 'Localisation : Terminal Arrivées AIBD'
    },
    '3': {
      title: 'Étape 3 : Trajet Autoroute de l\'Avenir (H+30m à H+1h30)',
      desc: 'Transfert direct et sécurisé vers Dakar via l\'Autoroute à péage (frais de péage 100% pris en charge par Le BADIL).',
      list: [
        'Trajet fluide à bord d\'une berline/suv climatisé',
        'Remise du panier Teranga (rafraîchissements, encas locaux)',
        'Remise de la pochette d\'accueil (guide des transports, contacts santé)',
        'Premier échange d\'orientation sur la vie dakaroise'
      ],
      icon: '🚗',
      badge: 'Statut : En cours de transfert',
      loc: 'Localisation : Autoroute AIBD ➔ Dakar'
    },
    '4': {
      title: 'Étape 4 : Installation & Remise des Clés (H+1h30 à H+2h30)',
      desc: 'Arrivée au logement préalablement inspecté et nettoyé (Mermoz, Fann, Almadies, Sacré-Cœur). Remise officielle des clés.',
      list: [
        'Présentation de l\'appartement & installation des valises',
        'Test des équipements : Eau (Sen\'Eau), Électricité (Senelec) & Box Wi-Fi',
        'Livraison des premières courses dans le réfrigérateur (Pack VIP)',
        'Signature du PV de remise des clés & Hotline assistance activée'
      ],
      icon: '🔑',
      badge: 'Statut : Installation Réussie !',
      loc: 'Localisation : Logement Étudiant à Dakar'
    }
  };

  stepItems.forEach(item => {
    item.addEventListener('click', () => {
      const stepNum = item.getAttribute('data-step');
      
      stepItems.forEach(s => s.classList.remove('active'));
      item.classList.add('active');

      const data = stepData[stepNum];
      if (data) {
        stepTitle.textContent = data.title;
        stepDesc.textContent = data.desc;
        stepIcon.textContent = data.icon;
        stepBadge.textContent = data.badge;
        stepLoc.textContent = data.loc;

        stepList.innerHTML = '';
        data.list.forEach(liText => {
          const li = document.createElement('li');
          li.textContent = liText;
          stepList.appendChild(li);
        });
      }
    });
  });

  // ==========================================
  // 5. SEMINAR COST ESTIMATOR LOGIC
  // ==========================================
  const simEventType = document.getElementById('sim-event-type');
  const simParticipants = document.getElementById('sim-participants');
  const simDays = document.getElementById('sim-days');
  const simTotalFcfa = document.getElementById('sim-total-fcfa');
  const simTotalEur = document.getElementById('sim-total-eur');
  const btnRequestProposal = document.getElementById('btn-request-seminar-proposal');

  function calculateSeminarEstimate() {
    const eventType = simEventType.value;
    const participants = parseInt(simParticipants.value) || 1;
    const days = parseInt(simDays.value) || 1;

    let baseRate = 35000;
    if (eventType === 'saly') baseRate = 95000;
    if (eventType === 'goree') baseRate = 40000;

    const subtotal = baseRate * participants * days;
    const coordFee = subtotal * 0.15;
    const totalFcfa = subtotal + coordFee;

    simTotalFcfa.textContent = formatFCFA(totalFcfa);
    simTotalEur.textContent = formatEUR(totalFcfa) + ' (Frais de régie 15% inclus)';
  }

  if (simEventType && simParticipants && simDays) {
    simEventType.addEventListener('change', calculateSeminarEstimate);
    simParticipants.addEventListener('input', calculateSeminarEstimate);
    simDays.addEventListener('input', calculateSeminarEstimate);
  }

  if (btnRequestProposal) {
    btnRequestProposal.addEventListener('click', () => {
      const eventTypeText = simEventType.options[simEventType.selectedIndex].text;
      const participants = simParticipants.value;
      const days = simDays.value;
      const total = simTotalFcfa.textContent;

      const waText = `Bonjour Le BADIL Conciergerie Dakar, je souhaite obtenir un devis officiel pour notre séminaire d'entreprise :\n- Format : ${eventTypeText}\n- Participants : ${participants} personnes\n- Durée : ${days} jour(s)\n- Estimation : ${total}\nMerci de me transmettre votre proposition sous 24h.`;

      // Option C: Direct WhatsApp Link
      window.open(generateWhatsAppUrl(waText), '_blank');
    });
  }

  // ==========================================
  // 6. BOOKING ENGINE & PAYTECH API MODAL
  // ==========================================
  const bookingModal = document.getElementById('booking-modal');
  const closeBookingModalBtn = document.getElementById('close-booking-modal');
  const checkoutPackSelect = document.getElementById('checkout-pack-select');
  const checkoutTotalFcfa = document.getElementById('checkout-total-fcfa');
  const checkoutTotalEur = document.getElementById('checkout-total-eur');
  const checkoutForm = document.getElementById('checkout-form');
  const paymentCards = document.querySelectorAll('.payment-radio-card');
  let currentPaymentMethod = 'wave';

  const packPrices = {
    'teranga': 75000,
    'logement': 150000,
    'integration': 60000,
    'vip': 250000
  };

  function updateCheckoutPrice() {
    const selectedPack = checkoutPackSelect.value;
    const price = packPrices[selectedPack] || 250000;
    checkoutTotalFcfa.textContent = formatFCFA(price);
    checkoutTotalEur.textContent = 'Contrevaleur : ' + formatEUR(price);
  }

  if (checkoutPackSelect) {
    checkoutPackSelect.addEventListener('change', updateCheckoutPrice);
  }

  const openModalBtns = document.querySelectorAll('.select-pack-btn, #open-booking-modal-hero');
  openModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const packKey = btn.getAttribute('data-pack');
      if (packKey && packPrices[packKey]) {
        checkoutPackSelect.value = packKey;
        updateCheckoutPrice();
      }
      bookingModal.classList.add('active');
    });
  });

  const openSeminarCalcHero = document.getElementById('open-seminar-calc-hero');
  if (openSeminarCalcHero) {
    openSeminarCalcHero.addEventListener('click', () => {
      const corpTabBtn = document.querySelector('[data-tab="tab-entreprises"]');
      if (corpTabBtn) corpTabBtn.click();
    });
  }

  if (closeBookingModalBtn) {
    closeBookingModalBtn.addEventListener('click', () => {
      bookingModal.classList.remove('active');
    });
  }

  // ==========================================
  // DYNAMIC SCHOOLS LOADER FROM SERVER API
  // ==========================================
  async function populateSchools() {
    const schoolSelect = document.getElementById('checkout-school');
    if (!schoolSelect) return;
    try {
      const res = await fetch('/api/schools');
      if (res.ok) {
        const schools = await res.json();
        if (Array.isArray(schools) && schools.length > 0) {
          schoolSelect.innerHTML = '<option value="">-- Sélectionnez votre établissement d\'accueil --</option>' +
            schools.map(s => `<option value="${s.name}">${s.name} (${s.city || 'Dakar'})</option>`).join('');
        }
      }
    } catch (e) {
      console.warn('Impossible de charger les établissements dynamiquement:', e);
    }
  }
  populateSchools();

  // ONLINE PAYTECH PAYMENT SUBMISSION
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById('btn-pay-online');
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '🔄 Connexion sécurisée à PayTech Sénégal...';

      const packId = checkoutPackSelect.value;
      const studentName = document.getElementById('checkout-student-name').value;
      const email = document.getElementById('checkout-email').value;
      const whatsapp = document.getElementById('checkout-whatsapp').value;
      const school = document.getElementById('checkout-school').value;
      const date = document.getElementById('checkout-date').value;

      try {
        const response = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packId,
            studentName,
            email,
            whatsapp,
            school,
            date,
            paymentMethod: 'paytech_all'
          })
        });

        const data = await response.json();

        if (data.success && data.redirectUrl) {
          // Redirect user directly to PayTech official checkout portal
          window.location.href = data.redirectUrl;
        } else {
          alert(`⚠️ Information PayTech : ${data.message || 'Impossible d\'initialiser le paiement.'}`);
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }

      } catch (err) {
        console.error('Checkout error:', err);
        const packText = checkoutPackSelect.options[checkoutPackSelect.selectedIndex].text;
        const waFallbackText = `Bonjour Le BADIL Conciergerie, je souhaite effectuer ma réservation :\n- Pack : ${packText}\n- Étudiant : ${studentName}\n- WhatsApp : ${whatsapp}\n- Établissement : ${school}\n- Arrivée : ${date}`;

        if (confirm("Redirection vers PayTech... Si vous souhaitez contacter un concierge directement via WhatsApp (Option C), cliquez sur OK.")) {
          window.open(generateWhatsAppUrl(waFallbackText), '_blank');
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });
  }

  // ==========================================
  // 7. COMMERCIAL QUALIFICATION EXPORT TOOL
  // ==========================================
  const btnExportQualification = document.getElementById('btn-export-qualification');
  const qualifierSummaryBox = document.getElementById('qualifier-summary-box');
  const qualifierSummaryText = document.getElementById('qualifier-summary-text');

  if (btnExportQualification) {
    btnExportQualification.addEventListener('click', () => {
      const company = document.getElementById('q-company').value || "Entreprise Prospect";
      const contact = document.getElementById('q-contact').value || "Non spécifié";
      const phone = document.getElementById('q-phone').value || "Non spécifié";
      const eventType = document.getElementById('q-event-type').value;
      const location = document.getElementById('q-location').value;
      const budget = document.getElementById('q-budget').value;

      const opts = [];
      if (document.getElementById('q-opt-transports').checked) opts.push("Transferts VIP Flotte / Berlines AIBD");
      if (document.getElementById('q-opt-hebergement').checked) opts.push("Hébergement Hôtel 4-5★ / Lodge");
      if (document.getElementById('q-opt-traiteur').checked) opts.push("Pauses Gourmandes & Traiteur Gastronomique");
      if (document.getElementById('q-opt-teambuilding').checked) opts.push("Animation Team Building & Atelier RSE");

      const text = 
`==================================================
LE BADIL CONCIERGERIE DAKAR — FICHE DE QUALIFICATION
==================================================
Société Prospect : ${company}
Contact / Décideur : ${contact}
WhatsApp Pro : ${phone}

Format Événement : ${eventType}
Localisation Privilégiée : ${location}
Prestations Requises :
  - ${opts.join('\n  - ')}

Enveloppe Budgétaire Indicative : ${budget}
Statut : Devis à transmettre sous 24h par le Pôle Corporate.
==================================================`;

      qualifierSummaryText.textContent = text;
      qualifierSummaryBox.style.display = 'block';
      qualifierSummaryBox.scrollIntoView({ behavior: 'smooth' });
    });
  }

});
