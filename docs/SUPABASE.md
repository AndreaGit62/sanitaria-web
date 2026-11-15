# Step 02 — Collegamento a Supabase

## Stato

Codice predisposto per registrazione, conferma email, accesso, uscita, recupero/cambio password e nome del profilo. Il proprietario ha creato l'account e il progetto `cura-sanitaria`: resta da configurare il collegamento. Dominio pubblico: `https://sanitaria-web-84gz.vercel.app`. Senza configurazione, la home continua a mostrare la demo; `/login` mostra le schermate disabilitate. Dopo la configurazione la home richiede un account; `/demo` rimane separata e pubblica, con dati locali inventati. Appuntamenti e documenti personali remoti saranno collegati negli step 3 e 4.

## 1. Crea l'account e il progetto

1. Apri https://supabase.com/dashboard e crea il tuo account, anche tramite GitHub. Completa personalmente login, termini e conferme email.
2. Crea un progetto chiamato `cura-sanitaria`. Scegli una regione europea disponibile. Conserva la password del database nel tuo gestore password: non serve condividerla nella chat.
3. Attendi che il progetto sia pronto. Nella finestra Connect o nelle impostazioni API trova Project URL e Publishable key. Per questa app serve la chiave pubblicabile (`sb_publishable_...`), mai una secret key o `service_role`.

## 2. Crea la tabella dei profili

Nel SQL Editor esegui, una volta, il file `supabase/migrations/202611150001_profiles.sql`. La transazione crea la tabella con Row Level Security. Gli utenti autenticati possono leggere e modificare solo la propria riga. Non aggiungere policy pubbliche. Non sono necessarie chiavi amministrative nell'app.

## 3. Configura Vercel

Nel progetto Vercel, in Settings → Environment Variables, aggiungi per Production:

| Nome | Valore |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase, `https://….supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key del progetto |
| `NEXT_PUBLIC_SITE_URL` | Dominio HTTPS stabile della tua app, senza percorso |

Non impostare il dominio di una singola preview temporanea come URL permanente. Per le preview che devono provare l'auth, aggiungi le stesse variabili nell'ambiente Preview, usando l'URL esatto di quella preview e autorizzandolo in Supabase. Dopo il salvataggio delle variabili serve un nuovo deploy.

Per il PC: copia `.env.example` in `.env.local`, inserisci URL e chiave pubblicabile, e usa `http://localhost:3000` come `NEXT_PUBLIC_SITE_URL`. `.env.local` è escluso da Git.

## 4. Configura le email

In Supabase, Authentication → URL Configuration:

- Site URL: il dominio Vercel stabile, con `https://`.
- Redirect URLs: aggiungi `https://TUO-DOMINIO/auth/confirm` e, se usi il PC, `http://localhost:3000/auth/confirm`.

Mantieni la conferma email attiva. In Authentication → Email Templates configura i link in questo modo (usa `RedirectTo` per tornare all'ambiente che ha richiesto il messaggio):

**Confirm signup:**

```html
<h2>Conferma il tuo account Cura</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup">Conferma l'email</a></p>
```

**Reset password:**

```html
<h2>Scegli una nuova password per Cura</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Recupera l'accesso</a></p>
```

Questi template sono necessari: l'app verifica il token lato server; non usa link che restituiscono token nel frammento `#` della pagina. Se lasci i template di default, il flusso di conferma/recupero potrebbe non completarsi.

Il servizio email predefinito Supabase invia soltanto agli indirizzi dei membri del team del progetto. Per invii ad altri destinatari configura Custom SMTP con un servizio di posta e un mittente verificato. Le credenziali SMTP vanno nelle impostazioni Supabase, mai in Git o in variabili `NEXT_PUBLIC_*`.

## 5. Prova con due account

1. Crea due account di prova su `/login?mode=register` e conferma le rispettive email.
2. Accedi come A e salva un nome. Ripeti come B in una finestra privata o altro browser.
3. Controlla che ciascuno veda il proprio nome e la propria email.
4. Verifica la protezione del database con `scripts/verify-isolation.mjs` (istruzioni sotto).
5. Prova uscita, accesso a `/` senza sessione, recupero password da email, nuova password, vecchia password rifiutata e link email scaduto/usato.
6. Ripeti login/uscita e conferma email da Safari e dall'icona Home dell'iPhone. La conservazione della sessione tra browser e app Home va verificata sul dispositivo.

### Test isolamento reale

Usa esclusivamente due account di prova dedicati: il test crea o aggiorna il loro nome in `profiles`. Aggiungi a `.env.local` (mai in Git):

```dotenv
CURA_RUN_ISOLATION_TEST=1
SUPABASE_TEST_EMAIL_A=
SUPABASE_TEST_PASSWORD_A=
SUPABASE_TEST_EMAIL_B=
SUPABASE_TEST_PASSWORD_B=
```

Con Node.js 22+:

```sh
node --env-file=.env.local scripts/verify-isolation.mjs
```

Il test accede come A e B tramite la chiave pubblicabile, verifica l'assenza di lettura e modifica incrociata e il rifiuto delle letture anonime. Non usa `service_role`, che aggirerebbe RLS. Senza progetto/credenziali il test si arresta: un build riuscito non dimostra l'isolamento degli utenti.

## Riferimenti ufficiali

- [Sessioni SSR Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Autenticazione con password](https://supabase.com/docs/guides/auth/passwords)
- [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
