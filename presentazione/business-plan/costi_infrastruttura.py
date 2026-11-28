"""JobExpress · costi dell'infrastruttura per 300 / 1.000 / 5.000 / 10.000 utenti registrati.

PREZZI: solo listini pubblici consultati il 28/11/2026 (vedi FONTI in fondo). Nessun prezzo inventato.
IPOTESI D'USO: indicate qui sotto e modificabili. Rieseguire con `python3 costi_infrastruttura.py`.
"""
import json

# ---------- listini (USD) ----------
SUPABASE_PRO = 25.0                 # $/mese per organizzazione, include 10 $ di crediti compute (= 1 istanza Micro)
SUPABASE_SMALL_EXTRA = 15.0 - 10.0  # istanza Small 15 $/mese meno 10 $ di crediti
SUPABASE_INCLUSO = {'mau': 100_000, 'disco_gb': 8, 'storage_gb': 100, 'egress_gb': 250, 'funzioni_mln': 2}
SUPABASE_EXTRA = {'mau': 0.00325, 'disco_gb': 0.125, 'storage_gb': 0.021, 'egress_gb': 0.09, 'funzioni_mln': 2.0}
RESEND_FREE = {'mese': 3000, 'giorno': 100}
RESEND_PRO = 20.0                   # $/mese, 50.000 email
CLOUDFLARE_PAGES = 0.0              # piano Free: richieste e banda statiche illimitate
HAIKU_IN, HAIKU_OUT = 0.10, 0.50    # $ per milione di token (prompt fino a 100K)
CAMBIO_USD_PER_EUR = 1.1734         # BCE 3/10/2025 (ultimo dato trovato): DA AGGIORNARE

# ---------- ipotesi d'uso (da validare) ----------
QUOTA_ATTIVI_MESE = 0.6      # registrati che accedono almeno una volta nel mese (MAU)
NUOVI_MESE = 0.10            # nuovi iscritti al mese rispetto al totale
EMAIL_PER_NUOVO = 2          # conferma email + benvenuto
EMAIL_PER_ATTIVO = 0.3       # reset password e avvisi importanti (le notifiche normali sono nell'app)
MB_FILE_PER_UTENTE = 0.6     # foto 640 px (~0,15 MB) + CV PDF per una parte degli utenti + allegati
KB_DB_PER_UTENTE = 60        # righe di profilo, candidature, incarichi, notifiche, recensioni
MB_TRAFFICO_PER_ATTIVO = 40  # dati API + immagini scaricate al mese
CONVERSIONE = 0.035          # paganti (scenario intermedio del business plan)
AI_RICHIESTE = 10            # richieste medie al mese per pagante (massimo 20)
AI_TOKEN_IN, AI_TOKEN_OUT = 1500, 500
FUNZIONI_PER_ATTIVO = 30     # chiamate alle edge function al mese (AI e altre)
DOMINIO_EMAIL_EUR = 10.0     # stima del business plan (dominio + casella), non un listino


def costi(utenti):
    mau = utenti * QUOTA_ATTIVI_MESE
    email = utenti * NUOVI_MESE * EMAIL_PER_NUOVO + mau * EMAIL_PER_ATTIVO
    email_giorno_picco = email / 30 * 3          # un giorno di picco = 3 volte la media
    storage = utenti * MB_FILE_PER_UTENTE / 1024
    disco = utenti * KB_DB_PER_UTENTE / 1024 / 1024 + 0.3   # + struttura e indici
    egress = mau * MB_TRAFFICO_PER_ATTIVO / 1024
    funzioni = mau * FUNZIONI_PER_ATTIVO / 1e6
    paganti = utenti * CONVERSIONE
    ai = paganti * AI_RICHIESTE * (AI_TOKEN_IN * HAIKU_IN + AI_TOKEN_OUT * HAIKU_OUT) / 1e6

    supa = SUPABASE_PRO
    if utenti >= 5000: supa += SUPABASE_SMALL_EXTRA           # istanza più grande per sicurezza
    supa += max(0, mau - SUPABASE_INCLUSO['mau']) * SUPABASE_EXTRA['mau']
    supa += max(0, disco - SUPABASE_INCLUSO['disco_gb']) * SUPABASE_EXTRA['disco_gb']
    supa += max(0, storage - SUPABASE_INCLUSO['storage_gb']) * SUPABASE_EXTRA['storage_gb']
    supa += max(0, egress - SUPABASE_INCLUSO['egress_gb']) * SUPABASE_EXTRA['egress_gb']
    supa += max(0, funzioni - SUPABASE_INCLUSO['funzioni_mln']) * SUPABASE_EXTRA['funzioni_mln']

    resend = 0.0 if (email <= RESEND_FREE['mese'] and email_giorno_picco <= RESEND_FREE['giorno']) else RESEND_PRO
    usd = supa + resend + CLOUDFLARE_PAGES + ai
    eur = usd / CAMBIO_USD_PER_EUR + DOMINIO_EMAIL_EUR
    return {
        'utenti': utenti, 'attivi_mese': round(mau), 'email_mese': round(email), 'storage_gb': round(storage, 1), 'database_gb': round(disco, 2),
        'traffico_gb': round(egress, 1), 'paganti': round(paganti), 'costi_usd': {'supabase': round(supa, 2), 'email_resend': resend, 'hosting': CLOUDFLARE_PAGES, 'ai_haiku': round(ai, 2)},
        'totale_usd_mese': round(usd, 2), 'totale_eur_mese': round(eur, 2), 'eur_per_utente_mese': round(eur / utenti, 4),
        'note': 'Supabase Pro + istanza Small' if utenti >= 5000 else 'Supabase Pro con istanza Micro (coperta dai crediti)',
    }


if __name__ == '__main__':
    r = {'data_listini': '2026-11-28', 'cambio': f'1 € = {CAMBIO_USD_PER_EUR} $ (BCE 3/10/2025, da aggiornare)', 'scenari': [costi(n) for n in (300, 1000, 5000, 10000)]}
    print(json.dumps(r, ensure_ascii=False, indent=1))
    json.dump(r, open('costi_infrastruttura.json', 'w'), ensure_ascii=False, indent=1)

# FONTI (consultate il 28/11/2026)
# Supabase: https://supabase.com/pricing e https://supabase.com/docs/guides/platform/billing-on-supabase
# Resend: https://resend.com/pricing
# Cloudflare Pages: https://pages.cloudflare.com/
# Claude Haiku 5.5: https://platform.claude.com/docs/en/about-claude/pricing
# Cambio: Banca d'Italia, cambi di riferimento del 3/10/2025
