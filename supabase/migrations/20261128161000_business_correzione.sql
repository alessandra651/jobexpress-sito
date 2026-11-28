-- Fase 4 · correzione: annullato_da contiene il ruolo (committente/lavoratore), non l'id della persona
create or replace function public.panoramica_business(p_dal date, p_al date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); da timestamptz; a_ timestamptz;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if p_al < p_dal or p_al - p_dal > 400 then raise exception 'Periodo non valido'; end if;
  da := (p_dal::timestamp at time zone 'Europe/Rome'); a_ := ((p_al + 1)::timestamp at time zone 'Europe/Rome');
  return (
    with ann as (select a.* from public.annunci a where a.autore_id = u and exists (select 1 from public.turni t where t.annuncio_id = a.id and t.inizio < a_ and t.fine > da)),
    inc as (select i.*, (select sum(extract(epoch from t.fine - t.inizio)) / 3600 from public.turni t where t.annuncio_id = i.annuncio_id) ore,
                   (select compenso_ora from public.annunci where id = i.annuncio_id) comp
            from public.incarichi i where i.annuncio_id in (select id from ann))
    select jsonb_build_object(
      'periodo', jsonb_build_object('dal', p_dal, 'al', p_al),
      'annunci', (select count(*) from ann),
      'annunci_aperti', (select count(*) from ann where stato = 'pubblicato'),
      'posti_richiesti', (select coalesce(sum(posti), 0) from ann where stato <> 'annullato'),
      'posti_coperti', (select count(*) from inc where stato in ('programmato', 'completato', 'contestato')),
      'completati', (select count(*) from inc where stato = 'completato'),
      'annullati_da_te', (select count(*) from inc where stato = 'annullato' and annullato_da = 'committente'),
      'annullati_da_persone', (select count(*) from inc where stato = 'annullato' and annullato_da = 'lavoratore'),
      'ore', (select round(coalesce(sum(ore), 0), 1) from inc where stato in ('programmato', 'completato', 'contestato')),
      'compensi_stimati', (select round(coalesce(sum(ore * comp + coalesce(bonus_urgenza, 0)), 0), 2) from inc where stato in ('programmato', 'completato', 'contestato')),
      'rescue_attive', (select count(*) from public.rescue_richieste r where r.annuncio_id in (select id from ann) and r.stato = 'attiva'),
      'da_fare', jsonb_build_object(
        'candidature_da_valutare', (select count(*) from public.candidature c join public.annunci a on a.id = c.annuncio_id where a.autore_id = u and a.stato = 'pubblicato' and c.stato in ('inviata', 'in_valutazione')),
        'proposte_in_attesa', (select count(*) from public.proposte p join public.candidature c on c.id = p.candidatura_id join public.annunci a on a.id = c.annuncio_id where a.autore_id = u and p.stato = 'attesa' and p.scade_il > now()),
        'adempimenti_da_dichiarare', (select count(*) from public.incarichi i where i.committente_id = u and i.stato = 'programmato' and i.adempimenti_dichiarati_il is null
                                        and exists (select 1 from public.turni t where t.annuncio_id = i.annuncio_id and t.inizio > now())),
        'da_segnare_completati', (select count(*) from public.incarichi i where i.committente_id = u and i.stato = 'programmato'
                                    and not exists (select 1 from public.turni t where t.annuncio_id = i.annuncio_id and t.fine > now())),
        'recensioni_da_scrivere', (select count(*) from public.periodi_recensione pr join public.incarichi i on i.id = pr.incarico_id
                                     where i.committente_id = u and pr.stato = 'aperto' and not exists (select 1 from public.recensioni r where r.incarico_id = i.id and r.autore_id = u and r.stato <> 'bozza')),
        'date_ricorrenti_da_confermare', (select count(*) from public.occorrenze_ricorrenti o join public.ricorrenze r on r.id = o.ricorrenza_id where r.user_id = u and o.stato = 'da_confermare'))
    ));
end $$;
revoke execute on function public.panoramica_business(date, date) from public, anon;
grant execute on function public.panoramica_business(date, date) to authenticated;
