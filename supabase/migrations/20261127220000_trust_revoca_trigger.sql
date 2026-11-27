-- Le funzioni dei trigger Trust non devono essere chiamabili direttamente via API (avviso di sicurezza Supabase).
-- I trigger continuano a funzionare.
revoke execute on function public._blocca_cognome_verificato() from public, anon, authenticated;
revoke execute on function public._blocca_nascita_verificata() from public, anon, authenticated;
revoke execute on function public._stato_foto() from public, anon, authenticated;
revoke execute on function public._trigger_trust() from public, anon, authenticated;
