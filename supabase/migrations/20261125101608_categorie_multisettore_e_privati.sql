-- JobExpress: più categorie nei moduli di interesse e tipo "privato" per chi pubblica.
-- (Già applicata su Supabase il 25/11/2026: copia salvata qui per lo storico.)

do $$ declare c record; begin
  for c in select conrelid::regclass as t, conname from pg_constraint
    where contype='c'
      and conrelid in ('public.interesse_lavoratori'::regclass,'public.interesse_attivita'::regclass)
      and pg_get_constraintdef(oid) like '%mansioni <@%'
  loop execute format('alter table %s drop constraint %I', c.t, c.conname); end loop;
end $$;

alter table public.interesse_lavoratori add constraint interesse_lavoratori_mansioni_check
  check (cardinality(mansioni) between 1 and 12 and mansioni <@ array['sala','cucina','bar','hotel','commercio','eventi',
  'babysitting','pet_sitting','pulizie','giardinaggio','ripetizioni','traslochi','fotografia','servizi_digitali']);
alter table public.interesse_attivita add constraint interesse_attivita_mansioni_check
  check (cardinality(mansioni) between 1 and 12 and mansioni <@ array['sala','cucina','bar','hotel','commercio','eventi',
  'babysitting','pet_sitting','pulizie','giardinaggio','ripetizioni','traslochi','fotografia','servizi_digitali']);

do $$ declare c record; begin
  for c in select conname from pg_constraint
    where contype='c' and conrelid='public.interesse_attivita'::regclass and pg_get_constraintdef(oid) like '%pizzeria%'
  loop execute format('alter table public.interesse_attivita drop constraint %I', c.conname); end loop;
end $$;
alter table public.interesse_attivita add constraint interesse_attivita_tipo_check
  check (tipo in ('ristorante','pizzeria','bar','pub','hotel','catering','negozio','eventi','privato','altro'));

comment on column public.interesse_attivita.opinione_commissione is 'Parere sull''abbonamento facoltativo (prima: commissione)';
