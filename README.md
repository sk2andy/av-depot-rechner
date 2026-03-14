# AV-Depot-Rechner

Vergleichsrechner fuer ETF-Sparen gegen das geplante AV-Depot ab 2027.

Live: [av-depot-rechner.vercel.app](https://av-depot-rechner.vercel.app)

## Was die App abdeckt

- Vergleich zwischen manuellem Split-Szenario und "Alles in ETF"
- Familienmodell mit 1 oder 2 Partnern
- Alter je Partner
- `0`, `1` oder `2` AV-Depots je Partner
- Kinder je einzelnem Alter und Ende der Kindergeldberechtigung
- ETF-Vorabpauschale im Modell
- Optimierung der AV-Verteilung ueber beide Partner inklusive Depotanzahl
- JSON-Export und JSON-Import fuer Szenarien

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn-style UI-Komponenten
- Deployment auf Vercel

## Lokal starten

```bash
npm install
npm run dev
```

Danach unter [http://localhost:3000](http://localhost:3000) oeffnen.

## Qualitaetssicherung

```bash
npm run lint
npm run build
```

## Hinweise zum Modell

- Das AV-Depot wird als geplantes Produkt ab 2027 modelliert.
- Der Rechner ist eine Szenariohilfe und keine Steuer- oder Rechtsberatung.
- Einige Effekte sind bewusst nicht enthalten, etwa spaetere Auszahlungsbesteuerung, Kirchensteuer oder der Sparer-Pauschbetrag.

