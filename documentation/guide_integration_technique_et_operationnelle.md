# GUIDE D'INTÉGRATION TECHNIQUE & OPÉRATIONNELLE
## Le BADIL Conciergerie Dakar — Paiements PayTech & Emails Automatiques SMTP OVH

Ce guide détaille le fonctionnement et la configuration de l'envoi d'emails automatiques via **SMTP OVH Zimbra** ainsi que le paramétrage de votre passerelle de paiement **PayTech**.

---

## ✉️ 1. AUTOMATISATION DES EMAILS VIA SMTP OVH ZIMBRA

Le moteur d'envoi automatique d'emails a été **entièrement développé et intégré** dans votre serveur Node.js (`server.js`).



---

### A. Configuration SMTP OVH Zimbra

L'application utilise la boîte email professionnelle `contact@lebadilconciergerie.com` via le serveur SMTP OVH Zimbra.

Les paramètres utilisés en production sont :

```env
SMTP_HOST=smtp.mail.ovh.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contact@lebadilconciergerie.com
SMTP_PASSWORD=votre_mot_de_passe_de_boite_mail
```

Le mot de passe correspond au mot de passe de la boîte email OVH/Zimbra.

**Important :**
- Ne jamais publier le mot de passe SMTP dans Git.
- Le fichier `.env` reste ignoré par Git.
- Le fichier `.env.example` contient uniquement des valeurs d'exemple.
- L'adresse `contact@lebadilconciergerie.com` est utilisée comme compte SMTP pour l'envoi des emails.

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
* **Clé API** : configurée uniquement dans le fichier `.env` du serveur.
* **Clé Secrète** : configurée uniquement dans le fichier `.env` du serveur.

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
