# Step 03 — Appuntamenti online, senza dipendenza dalle email

## Scelta concordata

Il recupero password è rimandato. Il login non mostra il collegamento di recupero; la vecchia URL mostra un messaggio senza inviare email. L'azione di invio del recupero è stata rimossa, e i callback di recupero non creano sessioni. La modifica della password resta disponibile agli utenti già autenticati.

Finché SMTP non è configurato, anche la registrazione pubblica è sospesa: non vogliamo creare account che attendono un'email impossibile da ricevere. Per le prove si usano utenti creati dal proprietario nel pannello Supabase. Non disattivare globalmente la conferma delle email per aggirare il problema. Il flag server `AUTH_EMAIL_SIGNUP_ENABLED` è disabilitato di default; si potrà attivare quando la configurazione email sarà completata. I template della guida precedente sono quindi rimandati.

## Configurazione guidata

1. Supabase → progetto `cura-sanitaria` → SQL Editor → nuova query.
2. Incollare tutto il file `supabase/migrations/202611150002_appointments.sql` e premere Run. Eseguirlo una volta: contiene una transazione e non cancella i profili già creati.
3. Supabase → Authentication → Users → Add user → Create user. Creare un account di prova con email e password scelte personalmente; se presente, selezionare l'opzione di conferma automatica di quell'utente. Usare Create user, non Send invitation (richiederebbe le email). Non condividere la password nella chat.
4. Dopo il deploy, aprire `https://sanitaria-web-84gz.vercel.app/login` e accedere con l'account creato.
5. Aggiungere una visita inventata, ricaricare la pagina e controllare che resti nell'agenda. Aprire lo stesso account da iPhone: la visita deve essere visibile. Il pulsante Aggiorna agenda e il ritorno alla finestra ricaricano i dati dal server.
6. Ripetere con un secondo account e verificare l'isolamento, con le prove della guida `SUPABASE.md` e lo script `scripts/verify-isolation.mjs`.

## Funzioni implementate

- Creazione, lettura, modifica, eliminazione e completamento appuntamenti tramite Server Actions e Supabase.
- Sessione verificata sul server a ogni operazione; identificativo utente dalla sessione, non dal modulo. Query filtrate per proprietario e Row Level Security per SELECT/INSERT/UPDATE/DELETE.
- Validazione lato server di date reali, orari, lunghezze, campi obbligatori e promemoria precedente alla visita; vincoli corrispondenti nel database.
- Versione del record per impedire che una modifica obsoleta da un altro dispositivo sovrascriva l'ultima versione. In caso di conflitto, aggiornare l'agenda prima di riprovare.
- Interfaccia collegata a calendario, ricerca, stato, report e promemoria dell'account. Il profilo si apre dall'icona accanto al proprio nome; uscita dalla barra superiore.
- Nessun appuntamento personale nel localStorage. I dati dimostrativi rimangono solo nella demo separata `/demo`.

## Limiti e verifiche

Eseguiti: build di produzione e controllo TypeScript, sei test sulla validazione delle visite e sette test HTTP su login, pagine protette e recupero disattivato. Verificate nel browser la schermata di accesso aggiornata e l'apertura del modulo della demo. Il salvataggio remoto e l'isolamento tra due utenti non sono ancora verificati: attendono migrazione e account di prova.

- Mostrati al massimo i 500 appuntamenti con data più recente; un avviso segnala quando i risultati e il report sono limitati. Paginazione estesa da aggiungere prima di superare questo limite.
- Orari dell'agenda riferiti a Europe/Rome. Non vengono inviate notifiche automatiche. L'esportazione calendario eredita il fuso del dispositivo: per ora effettuare le prove con dispositivo impostato sull'ora italiana.
- Archivio documenti personale ancora da implementare: i controlli di upload sono disabilitati nell'area privata. La demo mantiene la selezione temporanea dei file.
- Prima del test reale sono necessari migrazione e due account. Compilazione e test locali non dimostrano, da soli, l'isolamento sul progetto Supabase remoto.
- Lo script di isolamento crea visite fittizie nei due account dedicati e tenta la loro eliminazione nel blocco finale; modifica inoltre il nome dei profili di prova. Non usare account personali con dati reali per questo test.

## Test locali

```sh
node --test scripts/appointments.test.mjs
pnpm build
```

Con l'anteprima locale avviata sulla porta 3001 e nessuna sessione nel client di test:

```sh
node --test scripts/auth-preview.test.mjs
```

Riferimento: [Row Level Security di Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
