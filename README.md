# VisiLab · Agenda sanitaria

## Identità VisiLab

Nome aggiornato nell’interfaccia, nei metadati e nel manifest di installazione. Favicon multirisoluzione e icona iPhone a 180 px, con icone app a 192 e 512 px. Sorgente vettoriale: `public/brand/visilab.svg`; rigenerazione con `node scripts/generate-brand-icons.mjs`. Per aggiornare un collegamento Home già installato su iPhone, rimuoverlo e aggiungerlo nuovamente da Safari dopo il deploy. Le visite e gli allegati restano nell’account Supabase.

## Aggiornamento — Visite da prenotare

Nuovo elenco per le prestazioni ancora da organizzare, con note e allegati. Completando data e struttura, la visita passa automaticamente tra le confermate e nel calendario. Ora facoltativa e modulo adattato per evitare lo scorrimento laterale su iPhone. Richiede la migrazione `202611150004_pending_appointments.sql`; procedura e prove in **[docs/PRENOTAZIONI.md](docs/PRENOTAZIONI.md)**.

## Aggiornamento — Step 04

Archivio privato PDF/JPG con upload diretto a Supabase (fino a 10 MB), verifica del file, apertura e download con link temporanei, ricerca, collegamento alle visite ed eliminazione. Richiede la nuova migrazione dello storage e dei documenti. Guida e prove: **[docs/STEP04.md](docs/STEP04.md)**.

Le funzioni di recupero password ed email restano rimandate. Il test con due account su documenti e storage deve essere completato prima di considerare verificato l'isolamento remoto.

## Aggiornamento — Step 03

Recupero password rimandato su richiesta. Accesso con account di prova creati dal proprietario in Supabase, senza SMTP. Agenda collegata a visite private online: calendario, ricerca, modifica, stato e report usano i dati dell'account. Documenti personali e notifiche automatiche restano ai prossimi step.

È necessaria la nuova migrazione SQL degli appuntamenti. Istruzioni e limiti aggiornati: **[docs/STEP03.md](docs/STEP03.md)**. Le indicazioni email della sezione Step 02 sottostante sono conservate come riferimento futuro e non sono richieste per queste prove.

## Step 02 — Accesso personale (predisposto)

Nuove schermate in `/login` per registrazione, accesso e recupero password, conferma email lato server e profilo privato. Collegamento con Supabase Auth tramite cookie SSR e tabella `profiles` protetta da RLS. Configurazione e verifica con due account: **[docs/SUPABASE.md](docs/SUPABASE.md)**.

Il proprietario ha creato il progetto Supabase `cura-sanitaria`: il collegamento è da configurare, e registrazione, email e isolamento reale restano da verificare. Finché mancano le variabili d'ambiente, la home resta in modalità demo e i moduli di accesso sono disabilitati. Una volta configurata, la home richiede login; la demo resta disponibile separatamente in `/demo`. Appuntamenti e documenti remoti arriveranno negli step successivi.

Controllo TypeScript e build dello step 02 riusciti; schermate di login, registrazione e recupero verificate nel browser su layout mobile e desktop. Passati sei test HTTP locali sui moduli disattivati, sulla protezione del cambio password e sul rifiuto dei link email non validi. Il test reale con due utenti richiede la configurazione Supabase descritta nella guida.

Step 01: prototipo interattivo responsive in italiano, costruito con Next.js, React e TypeScript e predisposto per Vercel. La precedente applicazione `../WebAppSanitaria` non viene modificata.

## Direzione del progetto: PWA

L'app sarà sviluppata come Progressive Web App per PC e iPhone. Sono presenti interfaccia responsive, manifest e icone per l’installazione. Service worker e notifiche push restano da implementare nei prossimi step. L'eventuale funzionamento offline sarà definito insieme; i documenti sanitari non saranno memorizzati automaticamente nelle cache offline.

Repository del progetto: [AndreaGit62/sanitaria-web](https://github.com/AndreaGit62/sanitaria-web). La radice locale corretta è la cartella che contiene questo README, `package.json` e `app/`. Le sottocartelle `sanitaria-web/`, `Sanitaria/` e `test/` sono repository di prova separati e sono escluse dal caricamento.

## Stato della verifica

Dipendenze installate con pnpm; controllo TypeScript e build di produzione completati con esito positivo. Demo avviata su http://localhost:3000 e verificata nel browser. Controllati dashboard, navigazione delle sei sezioni, creazione e modifica di una visita dimostrativa, persistenza dopo ricaricamento, ricerca, cambio mese e validazione dell'orario del promemoria.

Verificati anche dashboard, menu, calendario e modulo appuntamenti a una larghezza di 390 px. Si tratta di una verifica responsive in Chromium: la prova su Safari di un iPhone reale resta da fare insieme. Screenshot nella cartella `verifiche`. Nel browser di prova rimane l'appuntamento inventato “Prova step 1” del 2 dicembre 2026.

La verifica di questo step non copre ancora caricamento/anteprima dei file, download CSV/ICS e notifiche. Account, dati remoti e invii automatici appartengono ai prossimi step.

## Avvio

Su questo PC puoi fare doppio clic su **Avvia VisiLab.cmd**: trova anche il runtime Node incluso in Codex. Il server già aperto su porta 3000 deve essere fermato prima di avviarne un altro. Il file mantiene aperta la console durante l'uso.

Per un'installazione su un altro PC: Node.js 22 LTS o successivo e pnpm. Il lockfile `pnpm-lock.yaml` registra le versioni installate.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Aprire http://localhost:3000. Per un iPhone sulla stessa rete Wi-Fi: aprire `http://IP-DEL-PC:3000` e consentire l'accesso nella rete privata se Windows Firewall lo richiede. Il server deve restare acceso. La versione pubblicata userà un indirizzo HTTPS accessibile anche fuori casa.

```sh
pnpm typecheck
pnpm build
pnpm start
```

## Verifica insieme: step 01

- Dashboard con riepilogo e prossime visite.
- Creazione, modifica, eliminazione e completamento di appuntamenti.
- Calendario mensile navigabile e selezione del giorno; su telefono i punti indicano gli eventi, i dettagli appaiono sotto il calendario.
- Ricerca per visita, struttura e medico, filtri per stato.
- Scelta del giorno e dell'ora del promemoria (precedente alla visita).
- Esportazione ICS dell'evento con avviso, da importare in Calendario: controllare l'avviso dopo l'importazione.
- Selezione di file PDF/JPG fino a 10 MB, anteprima e rimozione durante la sessione.
- Report riepilogativo ed esportazione CSV compatibile con Excel.

Gli appuntamenti dimostrativi si conservano nel localStorage del singolo browser. Gli allegati sono oggetti File in memoria e scompaiono al refresh: non vengono caricati su un server. Il profilo Andrea è una dimostrazione, senza autenticazione. Non c'è sincronizzazione fra dispositivi, né invio di notifiche automatiche. Usare solo dati inventati.

## Roadmap e punti di verifica

1. **Interfaccia e flussi — implementato.** Verificare stile, leggibilità, navigazione e campi appuntamento su PC e iPhone.
2. **Accesso multiutente.** Collegare Supabase Auth, recupero password e sessioni. Ogni utente accede soltanto ai propri dati tramite policy Row Level Security. Definire insieme se servono familiari/delegati e quali permessi.
3. **Dati e documenti persistenti.** Database Postgres, storage privato PDF/JPG, verifica file lato server, collegamento documenti/visite e URL temporanei. Nessun dato sanitario in bucket pubblici; prima del caricamento reale verificare isolamento tra utenti, backup e ripristino.
4. **Promemoria.** Confermare canale: email, push su iPhone oppure entrambi. Introdurre fuso Europe/Rome, coda persistente, pianificazione, retry e prevenzione invii duplicati. Verificare consegna anche ad app chiusa. I dettagli delle push su iPhone saranno verificati durante questo step.
5. **Report definitivi, iPhone e Vercel.** Report per periodo, installazione dalla schermata Home, test reali su Safari, pubblicazione preview HTTPS e verifica condivisa. Successivamente produzione.

## Pubblicazione su Vercel

Importare questa cartella come progetto Next.js (root directory `sanitaria-web` se si pubblica la cartella contenitrice). Build `pnpm build`, output gestito automaticamente da Next.js. Lo step 01 non richiede variabili d'ambiente. Non sono stati creati account o deploy remoti.

Per i prossimi step: Vercel ospiterà l'app; Supabase fornirà database, autenticazione e storage privato. Non si useranno SQLite o cartelle locali del server per la persistenza in Vercel.

Riferimenti ufficiali: [Next.js su Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Supabase con Next.js](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).
