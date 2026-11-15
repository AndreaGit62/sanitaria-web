# Step 04 — Archivio privato PDF/JPG

## Attivazione

1. In Supabase → SQL Editor eseguire `supabase/migrations/202611150003_documents.sql`. Lo script può essere rieseguito senza eliminare file o righe: verifica la struttura della tabella esistente prima di applicare le policy previste. Se trova colonne o policy diverse, si ferma e annulla la transazione.
2. Il file crea la tabella `documents`, le policy RLS e il bucket **privato** `medical-documents`, con limite di 10 MB e formati PDF/JPEG. Non creare un bucket pubblico e non aggiungere policy pubbliche. Se la query fallisce, la transazione viene annullata: comunicare l'errore prima di modificare altro.
3. Attendere il deploy Vercel, accedere a Cura e aprire Documenti. Non sono necessarie nuove variabili d'ambiente o chiavi amministrative.
4. Selezionare una visita (facoltativa), poi scegliere un PDF o JPG inventato. Attendere la dicitura “Salvato nell’archivio”.
5. Ricaricare e verificare apertura e download dal PC e da Safari/iPhone Home. Nei dettagli di una visita compare il collegamento ai suoi documenti; il collegamento può essere cambiato o rimosso dall'archivio. Eliminando una visita, i file restano nell'archivio senza collegamento.
6. Verificare con un secondo account che non possa leggere, collegare, firmare link o eliminare documenti del primo.

## Comportamento

La graffetta dell'appuntamento apre una finestra con il solo elenco dei file già caricati per quella visita, con Apri e Scarica. Il pulsante **Carica doc**, tra Annulla e Salva appuntamento, salva prima i dati validi della visita e apre una finestra dedicata all'upload: i nuovi file vengono collegati automaticamente. Aprire e richiudere l'elenco allegati conserva le modifiche non salvate nel modulo. L'archivio generale Documenti mantiene le funzioni complete di ricerca, collegamento ed eliminazione.

- File fino a 10 MB, massimo cinque alla volta, caricati in sequenza. L'app accetta PDF e JPG/JPEG, controllando metadati e firma iniziale del file; PNG/HEIC non vengono convertiti automaticamente.
- Prima dell'upload, il server verifica la sessione, l'eventuale visita proprietaria e crea una prenotazione `pending` con percorso casuale sotto l'ID dell'utente. Il nome originale non fa parte del percorso storage.
- Il server genera un'autorizzazione di upload firmata per quel percorso. Il browser invia il contenuto direttamente a Supabase: non passa nel corpo di una funzione Vercel. Non servono chiavi `service_role`.
- Il server rilegge il file e verifica dimensione effettiva, MIME e firma prima di segnare il documento `ready`. Il controllo della firma non è un antivirus né una verifica completa della struttura PDF/JPEG.
- Gli upload non completati restano visibili con “Verifica upload” o “Elimina”; nessun messaggio dichiara salvato un file non verificato. Se manca il file, rimuovere la voce e ricominciare. Non è ancora presente una pulizia automatica dei file orfani/interrotti.
- I file salvati non vengono sovrascritti. Apertura e download richiedono la sessione verificata e generano link validi per 60 secondi. Chi possiede un link firmato può usarlo fino alla scadenza: non condividerlo.
- Il bucket non è pubblico. Policy sia sulla tabella sia sullo storage limitano gli accessi al proprietario; le policy dei metadati impediscono il collegamento a visite altrui. Le autorizzazioni amministrative del proprietario del progetto Supabase restano quelle della piattaforma.
- La cancellazione rimuove prima il file, poi la scheda, mantenendo visibile l'eventuale operazione incompleta. La rimozione di un utente dal pannello Supabase richiede anche una procedura di pulizia dello storage: non è ancora implementata nell'app.
- Nessun file o link firmato viene salvato nel localStorage o in una cache offline dell'app. La demo `/demo` conserva il vecchio archivio temporaneo, separato dai file personali.
- Sono caricati i 500 documenti più recenti, con avviso se l'archivio ne contiene altri. I selettori delle visite usano gli appuntamenti caricati nell'agenda (massimo 500).

## Prove

Verifiche locali effettuate: dodici test su validazione delle visite e dei file, controllo TypeScript, anteprima grafica dell'archivio con dati fittizi su mobile e desktop, ricerca per nome e filtro per visita. Il proprietario ha eseguito con successo la migrazione su Supabase. Upload, apertura/download ed isolamento remoto con due account restano da verificare con file di prova dopo il deploy.

```sh
node --test scripts/documents.test.mjs scripts/appointments.test.mjs
pnpm typecheck
pnpm build
```

Test reale con **due account di prova dedicati**, configurando in `.env.local` i valori già descritti in `SUPABASE.md` e aggiungendo `CURA_RUN_DOCUMENT_TEST=1`:

```sh
node --env-file=.env.local scripts/verify-documents-isolation.mjs
```

Il test crea visite e file tecnici temporanei nei due account e li rimuove alla fine. Verifica upload via token firmato, accesso proprio, rifiuto dell'accesso incrociato, link a visite altrui e sovrascrittura, e indisponibilità del percorso pubblico. I test locali non sostituiscono questa verifica sul progetto remoto. Usare dati inventati fino al completamento delle prove.

Riferimenti: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [signed upload](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [limite payload Vercel](https://vercel.com/docs/functions/limitations).
