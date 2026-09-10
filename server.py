import http.server
import socketserver
import json
import urllib.request
import urllib.error
import urllib.parse
import os
import sys
import time
import uuid

# Force unbuffered output so logs are written immediately
try:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
except Exception:
    pass

PORT = int(os.environ.get("PORT", 8080))

PAYTECH_API_KEY = os.environ.get("PAYTECH_API_KEY", "e5fb556881039577d34510c62716e3039cb6ac6ea0db972c9ca14f6424243d11")
PAYTECH_API_SECRET = os.environ.get("PAYTECH_API_SECRET", "5a3b2e06b7f3cc4e14fa6e1d201c2f10579f7a7003bb9aa49fad038589c5778c")
PAYTECH_ENV = os.environ.get("PAYTECH_ENV", "test")
SITE_URL = os.environ.get("SITE_URL", f"http://localhost:{PORT}")

def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode('ascii', 'replace').decode('ascii'))

# Brevo Configuration
BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.environ.get("BREVO_SENDER_EMAIL", "lebadilconciergerie@gmail.com")
BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME", "Le BADIL Conciergerie Dakar")

PACK_PRICES = {
    'teranga': {'name': 'Pack Teranga (Accueil AIBD & Transfert)', 'price': 75000},
    'logement': {'name': 'Pack Logement Serein (Chasse & Abonnements)', 'price': 150000},
    'integration': {'name': 'Pack Intégration (Transport & Santé)', 'price': 60000},
    'vip': {'name': 'Pack VIP All-Inclusive (Clé en Main)', 'price': 250000}
}

# =========================================================================
# BREVO EMAIL SENDER & TEMPLATES
# =========================================================================
def send_brevo_email(to_email, to_name, subject, html_content):
    if not BREVO_API_KEY:
        safe_print(f"[Brevo Notification] Simule pour {to_email} : {subject}")
        safe_print("--> Pour l'envoi reel, renseignez votre cle BREVO_API_KEY dans le fichier .env")
        return {"success": True, "simulated": True, "message": "Email simule (cle Brevo en attente dans .env)"}

    url = "https://api.brevo.com/v3/smtp/email"
    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name}],
        "replyTo": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "subject": subject,
        "htmlContent": html_content
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "accept": "application/json",
            "api-key": BREVO_API_KEY
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            print(f"[Brevo Email Envoyé avec Succès] To: {to_email} | ID: {res_data}")
            return {"success": True, "data": res_data}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"[Brevo Email Erreur {e.code}] {err_msg}")
        return {"success": False, "error": err_msg}
    except Exception as e:
        print(f"[Brevo Erreur] {e}")
        return {"success": False, "error": str(e)}

def build_welcome_email_html(student_name, pack_name, school, arrival_date, ref_command):
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 20px; color: #1F2937; }}
  .container {{ max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #E5E7EB; }}
  .header {{ background: #0F2C59; padding: 30px 25px; text-align: center; border-bottom: 3px solid #DAC0A3; }}
  .header h1 {{ color: #FFFFFF; margin: 0; font-size: 22px; letter-spacing: 1px; }}
  .header p {{ color: #DAC0A3; margin: 5px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; }}
  .content {{ padding: 30px 25px; line-height: 1.6; }}
  .highlight-box {{ background: #FAF9F6; border-left: 4px solid #C5A880; padding: 15px 20px; margin: 20px 0; border-radius: 6px; }}
  .details-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
  .details-table td {{ padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; }}
  .details-table td.label {{ color: #4B5563; font-weight: 600; width: 40%; }}
  .details-table td.val {{ color: #0F2C59; font-weight: 700; }}
  .step-item {{ margin-bottom: 12px; display: flex; align-items: flex-start; }}
  .step-num {{ background: #0F2C59; color: #DAC0A3; border-radius: 50%; width: 22px; height: 22px; display: inline-block; text-align: center; line-height: 22px; font-weight: bold; font-size: 12px; margin-right: 10px; flex-shrink: 0; }}
  .btn {{ display: inline-block; background: #0F2C59; color: #DAC0A3 !important; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: bold; font-size: 14px; margin-top: 20px; text-align: center; border: 1px solid #DAC0A3; }}
  .footer {{ background: #0A1D3C; color: #9CA3AF; padding: 20px; text-align: center; font-size: 11px; border-top: 1px solid #DAC0A3; }}
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LE BADIL CONCIERGERIE</h1>
      <p>DAKAR • SÉNÉGAL — L'EXCELLENCE DU SERVICE</p>
    </div>
    <div class="content">
      <h2 style="color: #0F2C59; margin-top: 0;">🌟 Bienvenue à Dakar, {student_name} !</h2>
      <p>Bonjour {student_name} (et chers parents),</p>
      <p>Nous avons le plaisir de vous confirmer la validation de votre réservation pour le <strong>{pack_name}</strong>. Bienvenue au sein de la famille <strong>Le BADIL Conciergerie</strong> !</p>
      
      <div class="highlight-box">
        <p style="margin: 0; font-size: 14px; color: #1E3E72;">
          <strong>Dès aujourd'hui, vous n'êtes plus seul pour préparer cette rentrée.</strong> Notre équipe dakaroise est déjà mobilisée pour faire de votre arrivée au Sénégal un moment serein et mémorable.
        </p>
      </div>

      <h3 style="color: #0F2C59; font-size: 16px; margin-bottom: 5px;">📋 Récapitulatif de votre commande</h3>
      <table class="details-table">
        <tr><td class="label">Référence Dossier :</td><td class="val">{ref_command}</td></tr>
        <tr><td class="label">Pack Sélectionné :</td><td class="val">{pack_name}</td></tr>
        <tr><td class="label">Établissement d'accueil :</td><td class="val">{school}</td></tr>
        <tr><td class="label">Arrivée Prévue AIBD :</td><td class="val">{arrival_date}</td></tr>
      </table>

      <h3 style="color: #0F2C59; font-size: 16px; margin-bottom: 10px;">🚀 Ce qui va se passer maintenant :</h3>
      <div class="step-item"><span class="step-num">1</span> <div>Un concierge dédié va prendre contact avec vous par <strong>WhatsApp sous 24 heures</strong>.</div></div>
      <div class="step-item"><span class="step-num">2</span> <div>Nous allons recueillir vos détails de vol (AIBD) et vos préférences géographiques (Mermoz, Fann, Sacré-Cœur, Almadies).</div></div>
      <div class="step-item"><span class="step-num">3</span> <div>Vous recevrez votre guide d'accueil exclusif de Dakar au format numérique.</div></div>

      <p style="margin-top: 25px; text-align: center;">
        <a href="https://wa.me/221770000000" class="btn">📱 Joindre notre Concierge sur WhatsApp</a>
      </p>

      <p style="margin-top: 25px; font-size: 13px; color: #6B7280;">
        <em>Dalal ak jamm (Bienvenue au Sénégal) !</em><br>
        <strong>L'équipe Le BADIL Conciergerie Dakar</strong>
      </p>
    </div>
    <div class="footer">
      Le BADIL Conciergerie SARL • Dakar, Sénégal • NINEA: 009876543 • RCCM: SN.DKR.2026.B.1234<br>
      Standard WhatsApp Pro : +221 77 000 00 00 • lebadilconciergerie@gmail.com
    </div>
  </div>
</body>
</html>"""

# =========================================================================
# HTTP REQUEST HANDLER
# =========================================================================
class BadilServerHandler(http.server.SimpleHTTPRequestHandler):

    def do_POST(self):
        print(f"[HTTP POST] Received request on path: {self.path}")

        if self.path == '/api/create-payment':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                pack_id = data.get('packId', 'vip')
                student_name = data.get('studentName', 'Client')
                email = data.get('email', '')
                whatsapp = data.get('whatsapp', '')
                school = data.get('school', '')
                arrival_date = data.get('date', '')
                payment_method = data.get('paymentMethod', 'wave')

                pack = PACK_PRICES.get(pack_id, PACK_PRICES['vip'])
                
                if payment_method == 'virement':
                    ref_vir = f"BADIL-VIR-{int(time.time())}"
                    response_payload = {
                        "success": True,
                        "isVirement": True,
                        "refCommand": ref_vir,
                        "packName": pack['name'],
                        "amount": pack['price'],
                        "studentName": student_name,
                        "bankDetails": {
                            "beneficiary": "LE BADIL CONCIERGERIE SUARL",
                            "bank": "CBAO Groupe Attijariwafa Bank (Dakar, Sénégal)",
                            "rib": "SN012 01234 012345678901 45",
                            "iban": "SN12 SN01 2012 3412 3456 7890 145",
                            "swift": "CBAOSNDA",
                            "ref": ref_vir
                        }
                    }
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(response_payload).encode('utf-8'))
                    return

                ref_command = f"BADIL-{int(time.time())}-{uuid.uuid4().hex[:6]}"

                ipn_url = f"{SITE_URL}/api/paytech-ipn" if SITE_URL.startswith("https://") else "https://lebadilconciergerie.sn/api/paytech-ipn"

                paytech_payload = {
                    "item_name": f"Le BADIL Conciergerie - {pack['name']}",
                    "item_price": pack['price'],
                    "currency": "XOF",
                    "ref_command": ref_command,
                    "command_name": f"Reservation - {student_name}",
                    "env": PAYTECH_ENV,
                    "ipn_url": ipn_url,
                    "success_url": f"{SITE_URL}/?payment=success&pack={pack_id}&name={urllib.parse.quote(student_name)}&ref={ref_command}",
                    "cancel_url": f"{SITE_URL}/?payment=cancel&ref={ref_command}",
                    "custom_field": json.dumps({
                        "studentName": student_name,
                        "email": email,
                        "whatsapp": whatsapp,
                        "school": school,
                        "arrivalDate": arrival_date,
                        "packId": pack_id,
                        "paymentMethod": payment_method
                    })
                }

                print(f"[PayTech Request] Ref: {ref_command} | Price: {pack['price']} FCFA | Env: {PAYTECH_ENV}")

                req_body = json.dumps(paytech_payload).encode('utf-8')
                req = urllib.request.Request(
                    "https://paytech.sn/api/payment/request-payment",
                    data=req_body,
                    headers={
                        "Content-Type": "application/json",
                        "API_KEY": PAYTECH_API_KEY,
                        "API_SECRET": PAYTECH_API_SECRET
                    },
                    method="POST"
                )

                try:
                    with urllib.request.urlopen(req, timeout=15) as response:
                        res_body = response.read().decode('utf-8')
                        res_json = json.loads(res_body)

                        if res_json.get("success") == 1 and (res_json.get("redirect_url") or res_json.get("redirectUrl")):
                            redirect_url = res_json.get("redirect_url") or res_json.get("redirectUrl")

                            # Send Brevo Welcome Email (Email 1.1)
                            if email:
                                email_html = build_welcome_email_html(
                                    student_name=student_name,
                                    pack_name=pack['name'],
                                    school=school,
                                    arrival_date=arrival_date or "À confirmer",
                                    ref_command=ref_command
                                )
                                send_brevo_email(
                                    to_email=email,
                                    to_name=student_name,
                                    subject="🌟 Bienvenue à Dakar ! Votre Pack Étudiant est activé – Le BADIL Conciergerie",
                                    html_content=email_html
                                )

                            self.send_response(200)
                            self.send_header('Content-Type', 'application/json')
                            self.end_headers()
                            response_data = {
                                "success": True,
                                "redirectUrl": redirect_url,
                                "token": res_json.get("token", ""),
                                "refCommand": ref_command
                            }
                            self.wfile.write(json.dumps(response_data).encode('utf-8'))
                        else:
                            self.send_response(200)
                            self.send_header('Content-Type', 'application/json')
                            self.end_headers()
                            self.wfile.write(json.dumps({
                                "success": False,
                                "message": res_json.get("message", "Erreur PayTech")
                            }).encode('utf-8'))

                except urllib.error.HTTPError as http_err:
                    err_body = http_err.read().decode('utf-8')
                    print(f"[PayTech HTTP Error {http_err.code}] {err_body}")
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": False,
                        "message": f"PayTech: {err_body}"
                    }).encode('utf-8'))

            except Exception as e:
                print(f"[Internal Server Error] {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": str(e)}).encode('utf-8'))

        elif self.path == '/api/send-test-email':
            # Endpoint to test Brevo sending directly
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                test_email = data.get('email', '')
                test_name = data.get('name', 'Client Test')
                
                html = build_welcome_email_html(
                    student_name=test_name,
                    pack_name="Pack VIP All-Inclusive",
                    school="BEM Dakar",
                    arrival_date="15 Octobre 2026",
                    ref_command="BADIL-TEST-2026"
                )
                
                result = send_brevo_email(
                    to_email=test_email,
                    to_name=test_name,
                    subject="[Test] 🌟 Bienvenue à Dakar ! Votre Pack Étudiant est activé – Le BADIL Conciergerie",
                    html_content=html
                )
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                print(f"[Test Email Error] {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))

        elif self.path == '/api/paytech-ipn':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            print(f"[PayTech IPN Received] {post_data.decode('utf-8', errors='ignore')}")
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(404)
            self.end_headers()

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == "__main__":
    with ThreadingHTTPServer(("", PORT), BadilServerHandler) as httpd:
        print("==================================================")
        print(f"LE BADIL CONCIERGERIE SERVER RUNNING ON PORT {PORT}")
        print(f"PayTech Integration ACTIVE (API Key: {PAYTECH_API_KEY[:8]}...)")
        print(f"Brevo Email Engine ACTIVE (Key: {'CONFIGURED' if BREVO_API_KEY else 'A DEFINIR DANS .ENV'})")
        print(f"Local URL: http://localhost:{PORT}")
        print("==================================================")
        httpd.serve_forever()
