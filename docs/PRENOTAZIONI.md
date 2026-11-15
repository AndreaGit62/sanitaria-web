# Visite da prenotare

Prima di pubblicare questo aggiornamento, eseguire in Supabase → SQL Editor tutto il file `supabase/migrations/202611150004_pending_appointments.sql`. Lo script è rieseguibile e non elimina appuntamenti, allegati o profili. Gli appuntamenti già presenti restano confermati. Le regole di accesso per proprietario restano attive.

## Verifica insieme

1. Aprire “Da prenotare” e creare una visita inserendo soltanto nome e specialità. Deve restare in questo elenco e non comparire nel calendario o tra i prossimi appuntamenti.
2. Ricaricare la pagina e aprire l'app su iPhone: la visita deve essere ancora presente.
3. Aggiungere una nota e un PDF con “Carica doc”. La graffetta deve mostrare l'elenco dei file.
4. Aggiungere soltanto la struttura: la visita resta da prenotare. Aggiungere anche la data e salvare: passa in “Appuntamenti”, conserva note e allegati e appare nel calendario.
5. L'ora è facoltativa. Finché manca, l'app mostra “Orario da definire” e non esporta un evento con un'ora inventata. Il promemoria, se impostato senza ora visita, deve precedere il giorno della visita.
6. Su Safari iPhone aprire la scheda, provare i campi data, ora e promemoria e scorrere con il dito: il modulo deve scorrere verticalmente senza spostarsi lateralmente. Verificare anche il pannello allegati e il ritorno alla scheda.
7. Esportare il report CSV: lo stato delle visite da prenotare deve essere distinto da quello delle confermate.

I controlli automatici coprono validazione e normalizzazione dei dati e la build di produzione; la prova tattile su Safari reale va eseguita su iPhone.
