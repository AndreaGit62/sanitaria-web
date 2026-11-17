# Avvisi VisiLab

## Dispositivi personali e PC condiviso

Gli avvisi si attivano soltanto dall'app aggiunta alla Home dell'iPhone. Sul PC resta disponibile la gestione delle visite e dei promemoria, con l'indicazione di attivare gli avvisi dal telefono personale. Il logout dal PC riguarda solo il PC e non revoca gli iPhone.

Per aggiornare un'installazione già attiva eseguire `supabase/migrations/202611170006_iphone_notifications.sql`: elimina le vecchie sottoscrizioni dei servizi push per PC/Android e conserva quelle Apple già presenti, senza modificare appuntamenti, documenti o scheduler. L'interfaccia disiscrive anche il vecchio browser quando si apre Promemoria sul PC; il worker ignora comunque gli endpoint non Apple. Non occorre rigenerare le chiavi né riabilitare gli iPhone esistenti.

Il rilevamento iPhone/standalone nell'interfaccia e dell'user-agent sul server applica la scelta di prodotto. Non è un'attestazione hardware: i servizi push Apple sono condivisi con Safari su altri dispositivi. Le vecchie autorizzazioni Apple vengono quindi conservate per evitare di cancellare quelle degli iPhone; il PC Windows condiviso usa un servizio push differente.

## Configurazione

1. Eseguire `supabase/migrations/202611160005_push_notifications.sql` e poi `supabase/migrations/202611170006_iphone_notifications.sql` nel SQL Editor di Supabase. Sono rieseguibili; conservano visite e documenti. Creano sottoscrizioni private riservate agli avvisi iPhone, registro degli invii e funzioni di invio riservate al server.
2. Eseguire localmente `node scripts/generate-push-setup.mjs`. Genera una sola coppia VAPID e il token dello scheduler; non stamparli o inviarli in chat. Non rigenerare le chiavi dopo aver abilitato i dispositivi.
3. In Vercel → progetto → Settings → Environment Variables, aggiungere in Production i tre valori di `.env.push.generated.local`: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_CRON_SECRET`. I due valori privati vanno inseriti come Secret.
4. Aggiungere `SUPABASE_SECRET_KEY` come Secret in Production. Il valore è una Secret API key del progetto Supabase (oppure la chiave legacy service_role). Va inserita direttamente in Vercel, senza condividerla in chat o in Git. Questa chiave è usata esclusivamente dal worker sul server; le azioni dell'utente continuano a usare la sessione e RLS.
5. Pubblicare o fare Redeploy con le nuove variabili: la chiave pubblica VAPID entra nel bundle durante la build.
6. Eseguire nel SQL Editor `supabase/local/activate_push.sql`, generato localmente ed escluso da Git. Contiene il token del worker e lo conserva in Vault. Non incollarlo in chat. Configura un job Supabase ogni minuto verso il dominio Vercel di produzione; per cambiare dominio aggiornare lo script generatore e rigenerare lo script senza ruotare le chiavi.
7. Aprire VisiLab → Promemoria. Quando appare “Controllo automatico attivo”, abilitare il dispositivo, consentire gli avvisi e premere “Invia prova”. Su iPhone usare l'app aggiunta alla Home, con iOS 16.4 o successivo.

Nessun cron Vercel è necessario. Il limite giornaliero del piano Hobby non è sufficiente per i promemoria a orario: usiamo [Supabase Cron e pg_net](https://supabase.com/docs/guides/functions/schedule-functions). Vercel e Supabase devono essere disponibili; un progetto Supabase sospeso non esegue gli avvisi.

## Comportamento e limiti

- Gli orari sono interpretati in Europe/Rome, anche se il telefono usa un altro fuso. Ore inesistenti o ambigue durante il cambio dell'ora vengono rifiutate.
- Si può scegliere solo un promemoria futuro nuovo. Un promemoria passato già salvato può restare quando si modificano altri dettagli, ma non viene reinviato per quella modifica.
- Uno stesso account può abilitare fino a 10 dispositivi. Abilitazione e disattivazione riguardano il dispositivo corrente. La prova è limitata a una al minuto.
- Il worker esamina fino a 20 destinatari per esecuzione, in gruppi di cinque. La selezione non si blocca sui record già inviati. La finestra di recupero è di 15 minuti e non vengono inviati avvisi dopo la visita o a dispositivi abilitati dopo l'ora del promemoria.
- Ogni coppia visita/ora promemoria/dispositivo ha un solo tentativo. Il claim è atomico e viene ricontrollato prima dell'invio. Modificare l'orario crea una nuova scadenza; annullare, completare o eliminare la visita impedisce gli invii ancora da avviare. Un invio già partito non può essere ritirato.
- Non esiste una garanzia di consegna esattamente una volta. In caso di timeout ambiguo o interruzione del worker non si ritenta automaticamente: si evita un doppio avviso, ma l'avviso potrebbe non arrivare. “sent” significa accettato dal servizio push, non visualizzato dal telefono. Il tag della notifica e il topic del provider limitano ulteriormente i duplicati visibili.
- Gli endpoint scaduti (404/410) vengono rimossi. Se si cambiano le chiavi VAPID, occorre riabilitare i dispositivi.
- Il logout revoca il dispositivo associato al browser; il cambio password revoca tutti i dispositivi dell'account. Per riattivarli serve consenso esplicito dall'app. Le notifiche non vengono richieste automaticamente.
- Il service worker gestisce solo push e clic: nessun caching offline di pagine private o documenti. Testo e titolo delle notifiche sono generici. Il clic apre la visita con verifica della sessione e del proprietario; dopo il login si torna alla visita richiesta.
- Suoni, Full immersion e consegna dipendono dal dispositivo e dalla rete. Questi avvisi non sostituiscono una sveglia locale.

## Verifica insieme

1. Inviare la prova dall'iPhone e controllare nome, icona e testo.
2. Creare una visita futura con promemoria tra almeno tre minuti. Chiudere VisiLab: l'avviso deve arrivare, e il clic deve aprire la visita corretta.
3. Modificare un promemoria futuro: controllare che non arrivi alla vecchia ora.
4. Eliminare una visita o segnarla effettuata prima della scadenza: nessun avviso.
5. Disattivare il dispositivo: nessun avviso successivo. Ripetere con due account distinti per verificare l'isolamento reale.
6. Provare una notifica con sessione scaduta: dopo l'accesso la visita deve essere riaperta, senza mostrare dati di un altro utente.

Controlli automatici: `node --test scripts/appointments.test.mjs scripts/documents.test.mjs scripts/push.test.mjs scripts/push-database.test.mjs`. I test SQL eseguono le migrazioni su PostgreSQL temporaneo (PGlite) e simulano i ruoli anon/authenticated/service_role. I test del service worker non eseguono invii reali. La consegna Apple e il job nel progetto remoto richiedono le prove sopra.

## Monitoraggio e arresto

Il pannello utente controlla che il worker abbia eseguito un giro negli ultimi cinque minuti. Un heartbeat recente non certifica la consegna al telefono. Nel database, `push_deliveries` registra stato e codice del provider senza testo clinico; il registro oltre 30 giorni viene ripulito. I segreti non sono accessibili tramite il pannello o RPC pubbliche.

Per fermare il job dal SQL Editor: `select cron.unschedule('visilab-reminders');`. Per riattivarlo eseguire lo script di attivazione. Se il worker riceve 401 controllare il token in Vercel e Vault; con 503 controllare variabili e migrazione. Non copiare chiavi o endpoint dei dispositivi nei log condivisi.
