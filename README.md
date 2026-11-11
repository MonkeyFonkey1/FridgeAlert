# FridgeAlert

Aplicație Android pentru studenții care vor să urmărească datele de expirare ale alimentelor din frigider. Poți adăuga și edita alimente, le poți marca drept consumate sau aruncate și le poți șterge definitiv. Datele sunt păstrate local în SQLite.

## Pornire

Ai nevoie de Node.js 22.13+ (pe o ramură LTS) și npm. Din rădăcina proiectului:

```bash
npm ci
npm start
```

Pe telefonul Android, folosește Expo Go pentru SDK 58. Dacă telefonul și calculatorul sunt în aceeași rețea locală, scanează codul QR din Expo Go. [Descărcare Expo Go](https://expo.dev/go?sdkVersion=58&platform=android&device=true)

Dacă dispozitivele sunt în rețele diferite și ambele au internet, autentifică-te o singură dată în CLI cu `npx expo login`, apoi pornește proiectul cu `npm start -- --tunnel` și scanează noul cod QR. [Tunelul Expo](https://expo.dev/changelog/sdk-58#a-faster-more-reliable-expo-cli-tunnel)

Pentru testare prin cablu USB pe Linux, conectează telefonul cu depanarea USB activată și rulează comenzile de mai jos. Scanează apoi codul QR din Expo Go. [Redirecționarea portului prin ADB](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server)

```bash
adb reverse tcp:8081 tcp:8081
EXPO_OFFLINE=1 npm start -- --localhost --port 8081
```

Cu un emulator Android deja pornit, poți folosi și `npm run android`.

## Diagnostic SQLite pe Android

În modul de dezvoltare, deschide **Acasă → Setări → Diagnostic SQLite**. Secțiunea arată versiunea clientului Expo Go și a runtime-ului. **Verifică SQLite pe dispozitiv** creează o bază în memorie, testează operațiile de scriere, citire și ștergere și afișează rezultatul. Inventarul este stocat separat.

Dacă diagnosticul afișează `Cannot find native module 'ExpoSQLite'`, clientul Android care rulează codul trebuie verificat. Pentru Expo Go, verifică versiunea instalată și folosește distribuția pentru SDK 58. Păstrează datele Expo Go în timpul diagnosticării. Cu Android SDK configurat și telefonul conectat prin USB, poți verifica separat și un build local cu `npx expo run:android --device`. Buildul local folosește propriul spațiu de stocare.

`npm run verify` rulează TypeScript, lint, testele automate și exportul Android. Diagnosticul de pe telefon verifică încărcarea modulului nativ în clientul instalat.

## Navigare și fotografii

Bara inferioară are patru taburi: Acasă, Frigider, Rețete și Cumpărături. Statisticile și setările se deschid din Acasă, iar istoricul din Frigider. Formularul de adăugare revine la tabul din care l-ai deschis. După confirmarea cumpărăturilor, ecranul de succes oferă acces direct la Frigider.

Fotografiile locale și lista preparatelor pentru care se pot adăuga fotografii se găsesc în [assets/food](assets/food/README.md). Titlurile folosesc [Instrument Serif](https://github.com/google/fonts/tree/main/ofl/instrumentserif), inclus local împreună cu [licența SIL Open Font License](assets/fonts/OFL.txt).

## Ce să verifici pe telefon

1. La prima pornire, lista este goală și contoarele sunt la zero.
2. Deschide „Adaugă aliment”. Cantitatea pornește de la 1, iar minusul este dezactivat la această valoare. Încearcă plus și minus, apoi încearcă să salvezi cu valoarea 0. Formularul trebuie să afișeze o eroare.
3. Adaugă patru înregistrări cu datele ieri, azi, peste 3 zile și peste 4 zile și cantitățile 1, 6, 2 și 3. Frigiderul arată 4 produse active și 12 bucăți sau ambalaje. Acasă și în Statistici apar 2 produse care expiră în maximum 3 zile. „Consumă prioritar” începe cu produsul de azi.
4. Deschide alimentul care expiră peste 4 zile și apasă „Editează”. Schimbă numele, categoria, data la peste 5 zile și cantitatea la 2. Verifică noile valori în detalii și în listă. Totalul trebuie să scadă la 11 bucăți sau ambalaje.
5. La alimentul de azi, apasă „Am consumat produsul”, alege 2 buc. și confirmă. Verifică dacă mai sunt 4 buc. în inventar și dacă 2 buc. apar în istoric. Marchează apoi alimentul de ieri ca fiind aruncat și confirmă cantitatea de 1 buc. Frigiderul trebuie să arate 3 înregistrări și 8 bucăți sau ambalaje. În Statistici, 2 produse expiră în maximum 3 zile.
6. Deschide produsul aruncat din istoric. La „Șterge definitiv”, alege mai întâi „Anulează” și verifică dacă produsul rămâne. Repetă și alege „Șterge”. Produsul trebuie să dispară din istoric. Poți testa aceleași două opțiuni pe un produs activ.
7. Închide aplicația din lista de aplicații recente și redeschide proiectul din Expo Go. Verifică inventarul și istoricul, inclusiv faptul că produsele șterse nu reapar.
8. Caută după nume și deschide „Filtre și sortare”. Încearcă o categorie împreună cu „În max. 3 zile”, apoi sortează descrescător. Verifică lista, numărul de rezultate și butonul de resetare. Acasă afișează cel mult trei produse prioritare și o recomandare de rețetă.

Un produs rămâne activ și după expirare; „activ” este starea de inventar, iar expirarea se calculează separat. Datele de expirare reprezintă zile calendaristice locale, în format `YYYY-MM-DD`. Un aliment care expiră azi intră în contor până la sfârșitul zilei locale.

Alimentele salvate înainte de introducerea cantității primesc automat 1 buc. la deschiderea aplicației. La consum sau aruncare, alegi câte bucăți trec în istoric, iar restul rămâne în inventar. Când alegi toată cantitatea disponibilă, lotul trece integral în istoric. Pentru loturi cu date diferite, adaugă o înregistrare separată pentru fiecare.

## Notificări pe un telefon Android real

1. Pornește proiectul în modul de dezvoltare și deschide-l în Expo Go SDK 58. Din dashboard apasă rotița, activează „Notificări de expirare” și acceptă permisiunea Android. Dacă ai refuzat anterior, poți folosi butonul din ecranul de setări ca să o acorzi din nou.
2. Apasă „Testează acum” și verifică sertarul de notificări. Dacă testul nu apare, verifică notificările aplicației Expo Go și canalul „Alerte de expirare” în setările Android. Apasă apoi „Testează peste 10 secunde” cu telefonul deblocat. Dacă testul imediat apare și cel programat întârzie, afișarea funcționează, iar alarma poate fi amânată de Android.
3. Lasă „Cu 1 zi înainte” selectat. Adaugă un produs cu 3 bucăți care expiră mâine dacă încă nu este 09:00, sau poimâine dacă ora a trecut. În Setări verifică dacă numărul mementourilor programate crește cu 1. Așteaptă următoarea oră 09:00 pentru a vedea mementoul real.
4. Înainte să se livreze mementoul, consumă o bucată. Numărul mementourilor rămâne același, iar mesajul livrat va indica 2 bucăți. Pentru a verifica anularea, repetă cu un produs separat și șterge-l sau consumă-l complet înainte de ora programată. Numărul mementourilor scade cu 1.
5. Schimbă intervalul la 2 sau 3 zile și redeschide Setări. Sunt programate doar mementourile a căror oră calculată este încă în viitor. Dezactivarea comutatorului anulează mementourile de expirare.

Android poate amâna livrarea în funcție de permisiunea pentru alarme exacte și de economisirea bateriei. În Expo Go, setările Android de notificare se aplică aplicației Expo Go, inclusiv canalului „Alerte de expirare”. [Documentația Expo pentru notificări locale](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/)

## Rețete și cumpărături pe telefon

1. Într-un inventar gol, verifică mesajul din „Ce poți găti astăzi?”. Deschide „Rețete” din bara de jos și verifică dacă poți consulta și detaliile unei idei.
2. Adaugă ouă și telemea cu date viitoare. „Omletă cu brânză” trebuie să apară în „Poți găti acum”. În detalii, verifică bifele verzi și etichetele care spun că ingredientele au fost găsite după denumire. Cantitățile din rețetă sunt orientative.
3. Adaugă castravete, salată verde și roșii care expiră mâine. „Salată de legume” trebuie să apară înaintea omletei dacă ouăle și telemeaua expiră peste mai mult de 3 zile. Schimbă data roșiilor la ieri și verifică dacă sunt marcate ca lipsă. „Sos de roșii” nu înlocuiește roșiile proaspete la salată.
4. În detaliile omletei schimbă numărul de porții de la 1 la 4. Cantitățile trebuie să devină 8 ouă și 200 g de brânză. Adaugă toate ingredientele obligatorii în coș. Repetă pentru 2 porții și verifică dacă aceleași intrări afișează acum 4 ouă și 100 g de brânză, fără duplicate.
5. Bifează produsele cumpărate și apasă o singură dată „Confirmă cumpărăturile”. În ecranul comun verifică numărul real de bucăți sau ambalaje și alege datele de expirare. Dacă datele coincid, poți selecta una pentru toate produsele.
6. Apasă „Adaugă în frigider”. Verifică dacă produsele au apărut în inventar și au dispărut din coș. O intrare nebifată trebuie să rămână în coș. Închide și redeschide aplicația și verifică inventarul.

## Statistici și jurnal pe telefon

1. Adaugă un lot nou cu 5 bucăți. Consumă 3 și verifică dacă în inventar rămân 2. Aruncă apoi cele 2 bucăți și deschide „Statistici” din dashboard.
2. În „Activitate recentă” trebuie să vezi adăugarea, consumul și aruncarea, cu data, ora și cantitățile respective. În „Cantități înregistrate” totalurile cresc cu 3 bucăți consumate și 2 aruncate. În „Loturi finalizate” apare un lot aruncat, deoarece aceasta a fost ultima acțiune asupra lotului.
3. Confirmă două produse din coș într-o singură operație. Verifică dacă jurnalul afișează câte un eveniment „Ai cumpărat” pentru fiecare. Numărul loturilor consumate și cantitatea consumată trebuie să rămână la fel.
4. Comută între perioadele de 7 zile, 30 de zile și „Tot timpul”. Contoarele din „Inventar acum” rămân aceleași la schimbarea perioadei. Redeschide aplicația și verifică păstrarea activității. Dacă aveai produse înainte de actualizare, verifică și datele vechi în „Istoric”.

## Cod și verificări

- `src/app/` — navigare, inventar, istoric, notificări, rețete și lista de cumpărături.
- `src/components/` — cardul de aliment, formularul comun, butoanele și etichetele de stare.
- `src/models/` — modelul alimentului și categoriile.
- `src/services/` — schema SQLite, interogările și sincronizarea notificărilor.
- `src/data/` — catalogul local de rețete și dicționarul de ingrediente.
- `src/utils/recipeRecommendations.ts` — potrivirea și ordonarea recomandărilor.
- `tests/` — teste unitare pentru cantități, date, filtre și recomandări. Testele cu `node:test` și `test-renderer` simulează API-urile native și verifică ecranele, navigarea și programarea notificărilor. Testele de integrare folosesc fișiere SQLite temporare pentru a verifica migrările, persistența și tranzacțiile.

```bash
npm run typecheck
npm run lint
npm test
```

Pentru a rula doar testele ecranelor, folosește `node tests/screens.test.mjs`. Pe telefon verifică aspectul ecranelor, calendarul Android și livrarea efectivă a notificărilor.
