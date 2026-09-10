# GUIDE D'INTÉGRATION TECHNIQUE & OPÉRATIONNELLE
## Le BADIL Conciergerie Dakar — Paiements PayTech & Emails Automatiques Brevo

Ce guide détaille le fonctionnement et la configuration de l'envoi d'emails automatiques via **Brevo** (anciennement Sendinblue) ainsi que le paramétrage de votre passerelle de paiement **PayTech**.

---

## ✉️ 1. AUTOMATISATION DES EMAILS VIA BREVO (SENDINBLUE)

Le moteur d'envoi automatique d'emails a été **entièrement développé et intégré** dans votre serveur (`server.py`).

### A. Comment créer et récupérer votre clé API Brevo (100% Gratuit)
Brevo offre un forfait gratuit de **300 emails par jour**, ce qui est amplement suffisant pour l'activité de conciergerie.

1. Créez un compte gratuit sur [https://www.brevo.com/fr/](https://www.brevo.com/fr/).
2. Allez dans le menu : **Votre Profil (en haut à droite) ➔ Clés API & SMTP** (ou directement [https://app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)).
3. Cliquez sur **« Générer une nouvelle clé API »**.
4. Donnez-lui un nom (ex: *Le BADIL Conciergerie*), copiez la clé générée (commence par `xkeysib-...`).
5. Ouvrez votre fichier [`.env`](file:///c:/Users/user/Desktop/LeBadilConcierge/.env) et collez votre clé :
   ```env
   BREVO_API_KEY=xkeysib-votre-cle-ici...
   BREVO_SENDER_EMAIL=contact@lebadilconciergerie.sn
   BREVO_SENDER_NAME=Le BADIL Conciergerie Dakar
   ```
6. Dans Brevo, allez dans **Expéditeurs et domaines** pour valider l'adresse email d'envoi (`contact@lebadilconciergerie.sn` ou votre adresse Gmail / professionnelle de contact).

---

### B. Les Modèles d'Emails Intégrés

#### 🎓 Email 1.1 : Confirmation de Commande & Bienvenue (Automatisé)
* **Moment d'envoi** : Immédiat dès la validation de la réservation sur le site.
* **Destinataire** : Adresse email renseignée par l'étudiant / les parents.
* **Contenu** : Design corporate aux couleurs **Bleu Marine & Or Champagne** avec récapitulatif du Pack, établissement d'accueil (BEM, ISM, UCAD...), date d'arrivée AIBD, numéro de dossier et bouton WhatsApp direct.

#### 📑 Email 1.2 : Rappel des Pièces Justificatives (J+1)
* **Moment d'envoi** : 24 heures après la commande si le dossier logement n'est pas encore complet.
* **Contenu** : Rappel bienveillant demandant la copie du passeport, attestation d'inscription et pièce du garant pour lancer les visites d'appartement à Dakar.

---

## 💳 2. CONFIGURATION PAYTECH SÉNÉGAL (DASHBOARD)

Vos clés officielles sont configurées dans votre fichier `.env` :
* **Clé API** : `e5fb556881039577d34510c62716e3039cb6ac6ea0db972c9ca14f6424243d11`
* **Clé Secrète** : `5a3b2e06b7f3cc4e14fa6e1d201c2f10579f7a7003bb9aa49fad038589c5778c`

### URLs de redirection à renseigner dans https://paytech.sn/app/settings/api :

| Champ dans votre interface PayTech | URL à renseigner (En Production) | URL pour vos Tests Locaux |
| :--- | :--- | :--- |
| **URL de notification instantanée de paiement (IPN)** | `https://lebadilconciergerie.sn/api/paytech-ipn` | `https://lebadilconciergerie.sn/api/paytech-ipn` *(Obligatoirement en HTTPS)* |
| **URL de redirection en cas de succès** | `https://lebadilconciergerie.sn/?payment=success` | `http://localhost:8080/?payment=success` |
| **URL de redirection en cas d'annulation** | `https://lebadilconciergerie.sn/?payment=cancel` | `http://localhost:8080/?payment=cancel` |

---

## 📱 3. RAPPEL DU FONCTIONNEMENT WHATSAPP PRO

* **Application** : Utilisez l'application gratuite **WhatsApp Business** sur votre smartphone professionnel.
* **Réponses Rapides** : Configurez le raccourci `/bienvenue` pour envoyer instantanément le message d'accueil et d'organisation dès qu'un client réserve.
