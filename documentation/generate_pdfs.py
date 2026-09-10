import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.pdfgen import canvas

# Define Corporate Color Palette
NAVY_PRIMARY = colors.HexColor("#0F2C59")      # Bleu Marine Profond
GOLD_SECONDARY = colors.HexColor("#DAC0A3")    # Or Champagne Éclatant
GOLD_ACCENT = colors.HexColor("#C5A880")       # Darker Gold for text accents
BG_LIGHT = colors.HexColor("#F8F9FA")          # Light Cream/Off-white
TEXT_DARK = colors.HexColor("#1A1A1A")         # Dark Charcoal text
NAVY_LIGHT = colors.HexColor("#1D3E72")

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Header banner (Top)
        self.setFillColor(NAVY_PRIMARY)
        self.rect(0, A4[1] - 1.2 * cm, A4[0], 1.2 * cm, fill=True, stroke=False)
        
        # Header Gold stripe
        self.setFillColor(GOLD_SECONDARY)
        self.rect(0, A4[1] - 1.3 * cm, A4[0], 0.1 * cm, fill=True, stroke=False)
        
        # Header Text
        self.setFillColor(colors.white)
        self.setFont("Helvetica-Bold", 9)
        self.drawString(1.5 * cm, A4[1] - 0.8 * cm, "LE BADIL CONCIERGERIE DAKAR")
        self.setFont("Helvetica", 8)
        self.drawRightString(A4[0] - 1.5 * cm, A4[1] - 0.8 * cm, "Document Officiel — L'Excellence du Service au Senegal")

        # Footer banner (Bottom)
        self.setFillColor(NAVY_PRIMARY)
        self.rect(0, 0, A4[0], 1.2 * cm, fill=True, stroke=False)
        
        # Footer Gold stripe
        self.setFillColor(GOLD_SECONDARY)
        self.rect(0, 1.2 * cm, A4[0], 0.08 * cm, fill=True, stroke=False)
        
        # Footer Text
        self.setFillColor(colors.white)
        self.setFont("Helvetica", 7)
        legal_text = "Le BADIL Conciergerie SARL • Dakar, Senegal • NINEA: 009876543 • RCCM: SN.DKR.2026.B.1234 • www.lebadilconciergerie.sn"
        self.drawString(1.5 * cm, 0.45 * cm, legal_text)
        
        page_str = f"Page {self._pageNumber} / {page_count}"
        self.drawRightString(A4[0] - 1.5 * cm, 0.45 * cm, page_str)
        
        self.restoreState()


def create_dossier_operationnel_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=NAVY_PRIMARY,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=GOLD_ACCENT,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Heading1Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=NAVY_PRIMARY,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=TEXT_DARK,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'BulletCustom',
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=10,
        textColor=colors.white,
        alignment=0
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=TEXT_DARK
    )
    
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=NAVY_PRIMARY
    )

    story = []

    # Title Block
    story.append(Paragraph("DOSSIER OPERATIONNEL LE BADIL CONCIERGERIE", title_style))
    story.append(Paragraph("DAKAR, SENEGAL — CAHIER DES CHARGES, GRILLE TARIFAIRE & D-DAY LOGISTIQUE", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD_SECONDARY, spaceAfter=10))

    # Section 1: Presentation & Brochure Maquette
    story.append(Paragraph("1. MAQUETTE EDITORIALE BROCHURE 3 VOLETS", h1_style))
    story.append(Paragraph(
        "<b>Positionnement :</b> Conciergerie haut de gamme a Dakar melee d'hospitalite Teranga et de rigueur institutionnelle. "
        "Structurée autour de deux poles : <i>Pole Etudiants</i> (Serenite & Integration) et <i>Pole Entreprises</i> (Seminaires & Events).",
        body_style
    ))
    
    brochure_data = [
        [Paragraph("Volet", table_header_style), Paragraph("Contenu & Orientations Editoriales", table_header_style)],
        [
            Paragraph("Couverture (Exterieur)", table_cell_bold),
            Paragraph("Logo Le BADIL • Accroche : 'L'excellence du service a Dakar : Facilitateur de transitions, Createur d'evenements.' • Visuel cote dakaroise & business.", table_cell_style)
        ],
        [
            Paragraph("Pole Etudiants (Interieur G.)", table_cell_bold),
            Paragraph("<b>'Etudiez a Dakar l'esprit leger !'</b> Logement deniche (Almadies, Mermoz, Fann), formalites d'installation, accueil AIBD, integration locale.", table_cell_style)
        ],
        [
            Paragraph("Pole Business (Interieur D.)", table_cell_bold),
            Paragraph("<b>'Des seminaires professionnels qui marquent les esprits.'</b> Organisation A a Z d'incentives, conseils d'administration et team buildings a Dakar et Saly.", table_cell_style)
        ],
        [
            Paragraph("Contact (Dos Exterieur)", table_cell_bold),
            Paragraph("Trois piliers : Interlocuteur unique, Gain de temps, Reseau local certifie. • Contacts : Dakar, Senegal | +221 77 XXX XX XX | contact@lebadilconciergerie.sn", table_cell_style)
        ]
    ]
    
    t_brochure = Table(brochure_data, colWidths=[4.0*cm, 13.5*cm])
    t_brochure.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_PRIMARY),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_brochure)
    story.append(Spacer(1, 8))

    # Section 2: Website Specs & Payment Modules
    story.append(Paragraph("2. CAHIER DES CHARGES SITE WEB & MODULES DE PAIEMENT", h1_style))
    story.append(Paragraph(
        "<b>Architecture technique & conversion :</b> Tunnel de reservation dynamique integrant les modes de paiement locaux "
        "et internationaux au Senegal.",
        body_style
    ))
    story.append(Paragraph("• <b>Passerelles Mobile Money :</b> Integration Wave Senegal API & Orange Money Web (via Hub2 / PayTech / TouchPay).", bullet_style))
    story.append(Paragraph("• <b>Cartes Bancaires Internationales :</b> Traitement securise Visa, Mastercard, AMEX.", bullet_style))
    story.append(Paragraph("• <b>Conversion Multi-Devises :</b> Affichage simultane du montant exact en FCFA (XOF) et contrevaleur indicative en Euros (EUR).", bullet_style))
    story.append(Spacer(1, 8))

    # Section 3: FCFA Pricing Grid
    story.append(Paragraph("3. GRILLE TARIFAIRE INDICATIVE EN FCFA (XOF)", h1_style))
    
    pricing_data = [
        [Paragraph("Pole / Offre", table_header_style), Paragraph("Services Inclus", table_header_style), Paragraph("Tarif FCFA", table_header_style), Paragraph("Tarif Indicatif (EUR)", table_header_style)],
        [Paragraph("Pack Teranga", table_cell_bold), Paragraph("Accueil AIBD + Transfert privatif + Puce 4G 20 Go + Panier Teranga", table_cell_style), Paragraph("75 000 FCFA", table_cell_bold), Paragraph("115 EUR", table_cell_style)],
        [Paragraph("Pack Logement Serein", table_cell_bold), Paragraph("Chasse immobiliere ciblee + Visites physiques/video + Negociation bail + Abonnements Senelec/Sen'Eau/Internet", table_cell_style), Paragraph("150 000 FCFA", table_cell_bold), Paragraph("230 EUR", table_cell_style)],
        [Paragraph("Pack Integration", table_cell_bold), Paragraph("Orientation BRT/TER + Guide sante & repertoires + Conciergerie Hotline 7j/7 (1 mois)", table_cell_style), Paragraph("60 000 FCFA", table_cell_bold), Paragraph("90 EUR", table_cell_style)],
        [Paragraph("Pack VIP All-Inclusive", table_cell_bold), Paragraph("Cle en main complet (Teranga + Logement + Integration) + Menage d'entree + Frigo rempli + Concierge dedie (3 mois)", table_cell_style), Paragraph("250 000 FCFA", table_cell_bold), Paragraph("380 EUR", table_cell_style)],
        [Paragraph("Journee d'Etude Business", table_cell_bold), Paragraph("Salle VIP Dakar + Pauses gourmandes + Dejeuner traiteur + Concierge regie", table_cell_style), Paragraph("35 000 FCFA / pers.", table_cell_bold), Paragraph("53 EUR", table_cell_style)],
        [Paragraph("Seminaire Residentiel Saly", table_cell_bold), Paragraph("Hotel 4-5 stars + Pension complete + Salle de conference + Activite Team Building", table_cell_style), Paragraph("95 000 FCFA / pers./j", table_cell_bold), Paragraph("145 EUR", table_cell_style)],
    ]

    t_pricing = Table(pricing_data, colWidths=[3.5*cm, 8.0*cm, 3.2*cm, 2.8*cm])
    t_pricing.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_PRIMARY),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_pricing)
    story.append(Spacer(1, 8))

    # Section 4: Jour-J Logistics Workflow AIBD
    story.append(Paragraph("4. SCENARIO LOGISTIQUE PAS A PAS DU JOUR-J (AIBD -> DAKAR)", h1_style))
    story.append(Paragraph("• <b>H-24 a H-2h :</b> Suivi en temps réel du vol AIBD, briefing chauffeur, vehicule climatise, pancarte Gold nominative.", bullet_style))
    story.append(Paragraph("• <b>H0 a H+30m :</b> Accueil personnalise sortie terminal, prise en charge bagages, insertion puce SIM locale, message rassurant parents.", bullet_style))
    story.append(Paragraph("• <b>H+30m a H+1h30 :</b> Transfert fluide via Autoroute de l'Avenir (peage inclus), remise du kit Teranga et rafraichissements.", bullet_style))
    story.append(Paragraph("• <b>H+1h30 a H+2h30 :</b> Arrivee au logement netsoye, verification eau, electricite et Wi-Fi, remise officielle des cles.", bullet_style))
    story.append(Spacer(1, 8))

    # Section 5: B2B Qualification Form
    story.append(Paragraph("5. FORMULAIRE DE QUALIFICATION SEMINAIRE COMMERCIAL", h1_style))
    story.append(Paragraph("<b>Outil de prospection Dakar :</b> Permet de qualifier en 5 minutes le besoin d'une entreprise lors des rendez-vous au Plateau ou Almadies.", body_style))
    story.append(Paragraph("1. <b>Profil Client :</b> Raison sociale, secteur d'activite, decideur, contact WhatsApp Pro.", bullet_style))
    story.append(Paragraph("2. <b>Format Evenement :</b> Seminaire executif (5-15p), Team building (15-50p), Forum d'envergure (50-200p+).", bullet_style))
    story.append(Paragraph("3. <b>Localisation & Style :</b> Dakar Plateau, Almadies beach, Petite Cote / Saly, Ile de Goree.", bullet_style))
    story.append(Paragraph("4. <b>Logistique :</b> Flotte Berline/Van VIP, traiteur gastronomique, animations RSE / nautiques.", bullet_style))
    story.append(Paragraph("5. <b>Enveloppe Budgetaire :</b> &lt;3M FCFA | 3M a 7M FCFA | 7M a 15M FCFA | &gt;15M FCFA.", bullet_style))

    doc.build(story, canvasmaker=NumberedCanvas)


def create_emails_automatiques_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=NAVY_PRIMARY,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=GOLD_ACCENT,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Heading1Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=NAVY_PRIMARY,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    box_title_style = ParagraphStyle(
        'BoxTitle',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )

    box_content_style = ParagraphStyle(
        'BoxContent',
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=TEXT_DARK
    )
    
    wa_style = ParagraphStyle(
        'WAStyle',
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=11,
        textColor=NAVY_PRIMARY
    )

    story = []

    # Header Title Block
    story.append(Paragraph("MODELES D'EMAILS & NOTIFICATIONS WHATSAPP AUTOMATISES", title_style))
    story.append(Paragraph("LE BADIL CONCIERGERIE DAKAR — SEQUENCES AUTOMATIQUES ETUDIANTS & CORPORATE", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD_SECONDARY, spaceAfter=10))

    # Section 1: Pôle Étudiants
    story.append(Paragraph("1. SEQUENCE POLE ETUDIANTS & PARENTS", h1_style))

    # Template 1.1
    t1_data = [
        [Paragraph("Email 1.1 : Confirmation de Commande & Bienvenue (Immediat apres paiement)", box_title_style)],
        [Paragraph("<b>Objet :</b> Bienvenue a Dakar ! Votre Pack Etudiant est active - Le BADIL Conciergerie<br/><br/>"
                   "Bonjour [Prenom de l'etudiant] (et chers parents),<br/>"
                   "Nous avons le plaisir de vous confirmer la validation de votre reservation pour le <b>[Nom du Pack choisi]</b>. Bienvenue au sein de la famille Le BADIL Conciergerie !<br/><br/>"
                   "Des aujourd'hui, vous n'etes plus seul pour preparer cette rentree. Notre equipe dakaroise est deja mobilisee pour faire de votre arrivee au Senegal un moment serein et meorable.<br/><br/>"
                   "<b>Prochaines etapes :</b><br/>"
                   "1. Un concierge dedie va prendre contact avec vous par WhatsApp sous 24 heures.<br/>"
                   "2. Nous allons recueillir vos details de vol (AIBD) et vos preferences geographiques (BEM, ISM, UCAD, ESP, etc.).<br/>"
                   "3. Vous recevrez votre guide d'accueil exclusif de Dakar au format numerique.<br/><br/>"
                   "<i>Dalal ak jamm (Bienvenue) !</i><br/><b>L'equipe Le BADIL Conciergerie Dakar</b>", box_content_style)],
        [Paragraph("<b>Version WhatsApp Pro Instantanee :</b><br/>"
                   "« Bonjour [Prenom] ! C'est l'equipe Le BADIL Conciergerie. Votre paiement est bien valide et votre Pack est actif. Un concierge dedie va vous contacter ici-meme sous 24h pour organiser votre arrivee a Dakar (vol, logement, etc.). Soyez tranquille, on s'occupe de tout ! A tres vite. »", wa_style)]
    ]
    t1 = Table(t1_data, colWidths=[17.5*cm])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_PRIMARY),
        ('BACKGROUND', (0,1), (-1,1), BG_LIGHT),
        ('BACKGROUND', (0,2), (-1,2), colors.HexColor("#F0F4F8")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D0D0D0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t1)
    story.append(Spacer(1, 10))

    # Template 1.2
    t2_data = [
        [Paragraph("Email 1.2 : Rappel des Pieces Justificatives (J+1 Dossier Logement)", box_title_style)],
        [Paragraph("<b>Objet :</b> Le BADIL - Pieces necessaires pour lancer votre recherche de logement a Dakar<br/><br/>"
                   "Bonjour [Prenom],<br/>"
                   "Afin que notre chasseur immobilier puisse demarcher les meilleures opportunites dans les quartiers cibles (Mermoz, Fann, Sacre-Coeur, Almadies), nous vous prions de nous transmettre :<br/>"
                   "• La copie de votre piece d'identite ou passeport.<br/>"
                   "• Votre attestation d'inscription ou pre-inscription dans votre etablissement d'accueil.<br/>"
                   "• La piece d'identite de votre garant ainsi qu'un justificatif de revenus.<br/><br/>"
                   "Des reception, nous vous transmettrons les premiers comptes-rendus video.<br/><br/>"
                   "A votre service,<br/><b>Le BADIL Conciergerie Dakar</b>", box_content_style)]
    ]
    t2 = Table(t2_data, colWidths=[17.5*cm])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_LIGHT),
        ('BACKGROUND', (0,1), (-1,1), BG_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D0D0D0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t2)
    story.append(Spacer(1, 10))

    # Section 2: Pôle Entreprises
    story.append(Paragraph("2. SEQUENCE POLE ENTREPRISES & SEMINAIRES", h1_style))

    t3_data = [
        [Paragraph("Email 2.1 : Accuse de Reception Demande Devis Seminaire (Immediat)", box_title_style)],
        [Paragraph("<b>Objet :</b> Votre projet de seminaire a Dakar / Petite Cote - Prise en charge par Le BADIL<br/><br/>"
                   "Bonjour [Nom du Contact Corporate / Titre],<br/>"
                   "Nous vous remercions pour l'interet porte a notre agence. Nous avons bien enregistre les criteres de votre projet d'evenement corporate ([Nombre] collaborateurs prevus).<br/><br/>"
                   "Notre departement Business Events etudie la faisabilite logistique ainsi que la disponibilite des receptifs hoteliers d'exception a Dakar ou Saly.<br/><br/>"
                   "Un chef de projet dedie vous recontactera par telephone sous 24 heures afin de vous presenter une premiere esquisse budgetaire.<br/><br/>"
                   "Cordialement,<br/><b>La Direction Evenementielle - Le BADIL Conciergerie Dakar</b>", box_content_style)],
        [Paragraph("<b>Version WhatsApp Pro Corporate :</b><br/>"
                   "« Bonjour M./Mme [Nom]. Nous confirmons la bonne reception de votre demande de seminaire pour [Entreprise]. Votre gestionnaire d'evenement chez Le BADIL etudie vos criteres et vous recontacte par telephone d'ici demain pour vous soumettre nos premieres propositions. Excellente journee. »", wa_style)]
    ]
    t3 = Table(t3_data, colWidths=[17.5*cm])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY_PRIMARY),
        ('BACKGROUND', (0,1), (-1,1), BG_LIGHT),
        ('BACKGROUND', (0,2), (-1,2), colors.HexColor("#F0F4F8")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D0D0D0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t3)

    doc.build(story, canvasmaker=NumberedCanvas)

if __name__ == '__main__':
    doc_dir = os.path.dirname(os.path.abspath(__file__))
    f1 = os.path.join(doc_dir, "dossier_operationnel_le_badil.pdf")
    f2 = os.path.join(doc_dir, "emails_automatiques_le_badil.pdf")
    
    print(f"Generating {f1}...")
    create_dossier_operationnel_pdf(f1)
    print(f"Generating {f2}...")
    create_emails_automatiques_pdf(f2)
    print("PDF generation complete!")
