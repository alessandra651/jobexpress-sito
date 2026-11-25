// Dati dimostrativi del tabellone. Non sono offerte né persone reali.
// Ogni riga: [etichetta, dettaglio, inizio, fine] con ore decimali (26 = 02:00).

export const INCARICHI = {
  oggi: [
    ['Banco bar', 'bar in centro', 6.5, 11],
    ['Riassetto camere', 'hotel', 9, 13.5],
    ['Inventario', 'negozio', 14, 18.5],
    ['Accoglienza', 'evento aziendale', 17, 21],
    ['Servizio in sala', 'ristorante', 18.5, 23],
    ['Lavapiatti', 'pizzeria', 19, 23],
    ['Banco bar', 'pub', 21, 26],
  ],
  domani: [
    ['Colazioni', 'hotel', 6.5, 10.5],
    ['Riordino', 'negozio', 8, 12],
    ['Aiuto cucina', 'trattoria', 10.5, 15],
    ['Servizio in sala', 'trattoria', 11.5, 15],
    ['Allestimento', 'evento', 14, 19],
    ['Runner', 'ristorante', 18.5, 22.5],
    ['Servizio in sala', 'pizzeria', 19, 24],
  ],
  weekend: [
    ['Banco bar', 'bar in centro', 7, 13],
    ['Supporto vendita', 'negozio', 9.5, 13],
    ['Servizio in sala', 'matrimonio', 11, 18],
    ['Accoglienza', 'evento', 16, 20],
    ['Servizio in sala', 'ristorante', 19, 24],
    ['Aiuto cucina', 'ristorante', 18, 23],
    ['Banco bar', 'locale', 22, 26],
  ],
}

export const PERSONE = {
  oggi: [
    ['Sara', 'banco bar', 6.5, 14],
    ['Davide', 'riassetto', 8, 17],
    ['Amina', 'sala', 12, 24],
    ['Luca', 'sala ed eventi', 17, 24],
    ['Marta', 'cucina', 18, 22],
    ['Yassin', 'lavapiatti', 18.5, 26],
    ['Elena', 'banco bar', 20, 26],
  ],
  domani: [
    ['Davide', 'colazioni', 6, 12],
    ['Elena', 'vendita', 8, 19],
    ['Marta', 'cucina', 10, 16],
    ['Luca', 'sala ed eventi', 11, 23.5],
    ['Giorgia', 'accoglienza', 14, 20],
    ['Amina', 'sala', 18, 25],
    ['Yassin', 'sala', 19, 26],
  ],
  weekend: [
    ['Sara', 'banco bar', 7, 20],
    ['Giorgia', 'vendita', 9, 19],
    ['Pietro', 'sala', 10, 24],
    ['Amina', 'sala', 17, 26],
    ['Marta', 'cucina', 17.5, 24],
    ['Luca', 'sala ed eventi', 18, 26],
    ['Elena', 'banco bar', 20, 26],
  ],
}
