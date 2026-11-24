# Funktionale und Technische Spezifikation: Videoanalyse- und Film-Room-System (American Football)

Dieses Dokument beschreibt den vollständigen fachlichen Funktionsumfang, das Datenmodell, die Geschäftslogik, die Berechtigungsregeln und die technischen Randbedingungen einer modularen Videoanalyse-Anwendung für American Football. Die Spezifikation ist bewusst **plattform-, hersteller- und architekturunabhängig** formuliert, sodass das System als Webanwendung, Desktop-Applikation, mobiles Endgerät oder eingebettetes Modul mit beliebigen Speicher-, Backend- und Oberflächen-Technologien neu entworfen werden kann.

---

## 1. Systemzweck & Zielgruppen

Das System ermöglicht Sportteams die Verwaltung, den Zuschnitt, die Synchronisation mehrerer Kamerawinkel, die taktische Aufschlüsselung (Breakdown), die bildgenaue Einzeichnung (Telestration), die dynamische Zusammenstellung von Schnittlisten (Smart Playlists) sowie den datenschutzkonformen Austausch von Spiel- und Trainingsvideos.

### Primäre Nutzergruppen
- **Trainerstab (Coaches):** Sichten Filmmaterial, schneiden Rohaufnahmen, synchronisieren Kamerawinkel, erfassen statistische Spielzugdaten, erstellen Zeichnungen und Notizen, verwalten Entwürfe und geben Ergebnisse gezielt für Spieler oder andere Teams frei.
- **Team-Administratoren:** Konfigurieren zusätzlich das teamweite Tagging-Schema (Spalten, Datentypen, benutzerdefinierte Felder) sowie das gemeinsame Wörterbuch.
- **Spieler (Players):** Konsumieren ausschließlich für sie oder ihre Mannschaftseinheit freigegebene Videos, veröffentlichte Trainer-Notizen und Zeichnungen; dürfen eigene, persönliche Lernnotizen anlegen, aber keine Team-Daten verändern.
- **System-Administratoren:** Überwachen Speicherbereinigung und Aufbewahrungsfristen verwaister Mediendateien ohne Einsicht in fachliche Inhalte oder Teamnamen.
- **Externe Empfänger (Gäste / gegnerische Teams):** Erhalten über zeitlich begrenzte, widerrufbare Links reinen Lese- und Exportzugriff auf explizit freigegebene Videodaten und ausgewählte Statistikspalten.

---

## 2. Mandanten-, Saison-, Rollen- und Sichtbarkeitsmodell

### 2.1 Mandanten- und Saison-Isolation
- Sämtliche Videos, Tagging-Schemata, Wörterbücher, Smart Playlists und Einstellungen sind strikt nach **Mandant (Team-ID)** getrennt.
- Videos und Smart Playlists sind jeweils einer **Saison** (z. B. Jahreszahl wie `"2026"`; Standardwert abgeleitet aus dem Veranstaltungsdatum) zugeordnet.
- Die Oberfläche unterscheidet zwischen:
  - **Aktiver Saison** (Standardansicht für den laufenden Betrieb),
  - **Historischen / archivierten Saisons** (mit explizitem Hinweis, dass Archivmaterial angezeigt wird),
  - **Gesamtansicht** über alle Saisons hinweg.

### 2.2 Rollenmodell
| Rolle | Berechtigungen (kumulativ bzw. abgegrenzt) |
| :--- | :--- |
| **Spieler (`PLAYER`)** | Lesezugriff auf freigegebene Videos und Playlists; sieht ausschließlich veröffentlichte (`PUBLISHED`) Coach-Notizen und -Zeichnungen sowie eigene Spieler-Notizen (`PLAYER`); darf eigene Notizen anlegen, bearbeiten und löschen; darf persönliche Playback- und eingeschränkte Hotkey-Einstellungen anpassen; kein Schreibzugriff auf Tags, Schnitte, Sync, Freigaben oder Schema. |
| **Trainer (`COACH`)** | Vollzugriff auf Upload/Import, Cut & Sync, Film Room, Telestration, Breakdown-Tagging, Entwurfs-Verwaltung (`DRAFT` -> `PUBLISHED`), Smart Playlists, Team-Freigaben und öffentliche Share-Links sowie persönliche Hotkey-/Player-Einstellungen. |
| **Team-Admin (`TEAM_ADMIN`)** | Alle Trainer-Rechte plus Aktivierung/Deaktivierung von Standardfeldern, Erstellung und Löschung benutzerdefinierter Tag-Felder sowie Pflege/Löschung von Wörterbuch-Einträgen. |
| **System-Admin (`SYSADMIN`)** | Zugriff auf systemweite Speicherbereinigung (Cleanup-Warteschlange und Schonfrist-Konfiguration). Sieht aus Datenschutzgründen **nur** anonymisierte Speicherpfade, Dateigrößen, Löschfristen und Status — niemals Teamnamen, Videotitel oder Inhalte. |

### 2.3 Sichtbarkeitsstufen (Freigabe innerhalb des Mandanten)
Jedes Video-Paket (`VideoTape`) und jede `SmartPlaylist` besitzt genau eine Sichtbarkeitsstufe:
- `COACHES_ONLY`: Nur für Trainer und Team-Admins sichtbar.
- `ALL_PLAYERS`: Für alle Spieler des Mandanten sichtbar.
- `UNIT_OFFENSE`: Für Trainer sowie Spieler der Offense-Einheit sichtbar.
- `UNIT_DEFENSE`: Für Trainer sowie Spieler der Defense-Einheit sichtbar.
- `UNIT_SPECIAL_TEAMS`: Für Trainer sowie Spieler der Special-Teams-Einheit sichtbar.

> Hinweis: Eine optionale Unit-Zuordnung am Benutzerprofil filtert bei `PLAYER`-Rollen zusätzlich zwischen Offense, Defense und Special Teams.

---

## 3. Fachliches Datenmodell & Invarianten

### 3.1 Kernentitäten

#### `VideoTape` (Videopaket / Reel)
- `id`: Eindeutiger Bezeichner
- `teamId`: Mandanten-ID
- `season`: Saison-Kennung (String, z. B. `"2026"`)
- `title`: Titel (Pflichtfeld, nicht leer)
- `category`: `GAME` | `PRACTICE` | `SCOUTING` | `SELF_SCOUT` | `CUSTOM`
- `eventDate`: ISO-Datum (`YYYY-MM-DD`)
- `thumbnailRef`: Referenz auf Vorschaubild
- `angles`: Geordnete Liste von Kamerawinkeln (Großbuchstaben normalisiert, z. B. `["SIDELINE", "ENDZONE"]`, mindestens 1 Winkel)
- `sourceMode`: `CLIP_FILE` (Einzeldateien pro Spielzug/Winkel) | `TIME_SLICE` (zusammenhängende Rohdatei mit Zeitintervallen)
- `visibility`: Sichtbarkeitsstufe (Abschnitt 2.3)
- `plays`: Liste von `Spielzug`-Objekten
- `teamShares`: Liste von `TeamShareEntry` (interne/mandantenübergreifende Team-Freigaben)
- `shareLinks`: Liste von `ShareDownloadLink` (externe Token-Links)
- `receivedFromTeam`: Optionaler Herkunftshinweis bei empfangenem Fremd-Material
- Abgeleitete Kennzahlen: `playCount`, `taggedCount` (Anzahl Spielzüge mit mindestens einem ausgefüllten Breakdown-Feld), `draftNoteCount` (Anzahl Entwürfe über Notizen und Zeichnungen)

#### `Spielzug` (Play)
- `play_number`: Positive fortlaufende Ganzzahl (`1..N`)
- `sources`: Abbildung `Winkel -> PlayQuelle | null`
  - **`null` bedeutet bewusste Winkellücke** (z. B. fehlender Clip in der Endzone); der Spielzug bleibt vollständig erhalten und darf nicht verworfen werden.
- `breakdown`: Objekt mit Standardfeldern und `custom`-Wörterbuch (`Record<string, string | number | undefined>`)
- `notes`: Liste zeitstempelbasierter Notizen
- `drawings`: Liste frame- und winkelgebundener Vektor-Zeichnungen

#### `PlayQuelle` (Medienquelle pro Winkel)
- `file`: Dateireferenz / Schlüssel im Objektspeicher
- `source_mode`: Optional `CLIP_FILE` | `TIME_SLICE`
- `start_ms`: Startzeitpunkt in Millisekunden (`>= 0`)
- `end_ms`: Endzeitpunkt in Millisekunden (`end_ms > start_ms`)
- `offset_ms`: **Optionaler** Synchronisationsversatz in Millisekunden relativ zum Master-Winkel (Standard: nicht gesetzt / `undefined` bzw. `0`). Darf bei Upload oder Import niemals erzwungen werden.

#### `Notiz` (Note)
- `id`: Eindeutiger Bezeichner
- `timestamp_ms`: Frame-quantisierter Zeitstempel innerhalb des Spielzugs (`>= 0`)
- `text`: Notizinhalt
- `status`: `DRAFT` | `PUBLISHED`
- `authorRole`: `COACH` | `PLAYER`

#### `TelestrationZeichnung` (Drawing)
- `id`: Eindeutiger Bezeichner
- `angle`: **Strikte Bindung an genau einen Kamerawinkel** (Großbuchstaben)
- `timestamp_ms`: **Exakter Frame-Zeitstempel** (auf Frame-Raster quantisiert)
- `tool`: `pen` | `arrow` | `spotlight` | `text`
- `color`: Farbwert
- `points`: Liste normierter Punkte `{ x: number, y: number }` mit Werten im Intervall `[0, 1]` (auf 4 Nachkommastellen gerundet)
- `text`: Optionaler Beschriftungstext (bei Werkzeug `text`)
- `status`: `DRAFT` | `PUBLISHED`

#### `TagFeldKonfig` (Tagging-Schema-Feld)
- `key`: Eindeutiger technischer Schlüssel
- `label`: Anzeigename (lokalisiert)
- `shortLabel`: Kompakte Spaltenüberschrift (z. B. `YD LN`, `GN/LS`)
- `group`: `SITUATION` | `OFFENSE` | `RESULT` | `DEFENSE` | `CUSTOM`
- `type`: `select` | `combobox` | `number` | `text`
- `active`: Boolean (steuert Sichtbarkeit in Grid, Quick-Tags und Standard-Export)
- `isCustom`: Boolean (`true` für benutzerdefinierte Team-Felder)
- `definitions`: Optionale Liste erlaubter bzw. gelernter Auswahlwerte

#### `SmartPlaylist`
- `id`, `teamId`, `season`, `name`, `description`
- `combinator`: `AND` | `OR`
- `rules`: Liste von `PlaylistRegel` (`{ id, fieldKey, operator, value?, values? }`)
- `reelIds`: Optionale Einschränkung auf ausgewählte Videopakete (leer/nicht gesetzt = alle im Team/Saison-Kontext verfügbaren Videopakete)
- `visibility`: Sichtbarkeitsstufe
- `createdAt`: Zeitstempel

#### `TeamShareEntry` & `ShareDownloadLink`
- `TeamShareEntry`: `{ teamName, sharedFields: FieldKey[], sharedAt }`
- `ShareDownloadLink`: `{ id, token, path, label, createdAt, expiresAt, sharedFields: FieldKey[], active }`

---

## 4. Medien-Workflows: Bibliothek, Upload & Austauschformat

### 4.1 Videobibliothek (Dashboard)
- Filterung nach:
  - Saison (inkl. Archiv-Banner bei vergangenen Saisons),
  - Kategorie (`ALL` oder spezifische Kategorie),
  - Volltextsuche über Videotitel und empfangene Teamnamen.
- Darstellung je Videopaket:
  - Vorschaubild, Titel, Kategorie, lokalisiertes Datum, Kamerawinkel, Quellmodus (`Einzelclips` vs. `Rohmaterial / Zeitschnitt`),
  - Spielzug-Anzahl und Tagging-Fortschritt in Prozent (`taggedCount / playCount`),
  - Indikatoren für Team-Freigaben, Anzahl aktiver externer Links (nur für Trainer) und Herkunftshinweis (`receivedFromTeam`),
  - Direkte Änderung der Sichtbarkeitsstufe (nur Trainer; für Spieler schreibgeschütztes Badge),
  - Aktionen: Öffnen im Film Room, Direkt-Sprung in Cut & Sync (Trainer), Teilen-Dialog (Trainer), JSON-Export (Trainer).

### 4.2 Upload- und Import-Modi
1. **Einzelclips / Rohmaterial-Upload:**
   - Auswahl des Quellmodus: `CLIP_FILE` (vorab geschnittene Einzelclips) oder `TIME_SLICE` (ungeschnittenes Gesamtvideomaterial).
   - Angabe von Titel, Kategorie, Veranstaltungsdatum und Kamerawinkeln (mindestens 1, Normalisierung auf Großbuchstaben; fehlende Standardwinkel ergänzbar).
   - Im Modus `CLIP_FILE` können mehrere Dateien je Winkel zugeordnet werden; fehlende Clips in einem Nebenwinkel erzeugen `null`-Quellen.
   - Im Modus `TIME_SLICE` wird pro Winkel eine Rohdatei verknüpft; daraus entsteht zunächst eine Initialstruktur für den anschließenden Zuschnitt im Cut-Editor (oder ein initialer Gesamt-Slice).
   - Upload erfolgt idealerweise direkt gegen einen Objektspeicher mittels vorab autorisierter, zeitlich begrenzter Upload-URLs (ohne Medienströme durch den Anwendungsserver zu schleusen).
2. **Austausch-Paket-Import (JSON v1.0):**
   - Struktur eines portablen JSON-Austauschformats:
     - `schema_version`: muss exakt `"1.0"` sein.
     - `reel`: `{ title, category, event_date (YYYY-MM-DD), visibility? }`
     - `angles`: Nicht-leeres Array von Winkelnamen (werden in Großbuchstaben ohne Leerzeichen normalisiert und dedupliziert).
     - `plays`: Nicht-leeres Array von Spielzügen mit positiver `play_number` (`>= 1`), `sources` pro deklariertem Winkel (oder `null`), optionalem `breakdown`, `notes`, `drawings`.
   - **Strikte Validierungsregeln beim Import:**
     - `end_ms` muss strikt größer als `start_ms` sein (`start_ms >= 0`).
     - Fehlt ein in `angles` deklarierter Winkel im `sources`-Objekt eines Spielzugs, wird er automatisch mit `null` aufgefüllt und ein entsprechender Hinweis ausgegeben.
     - Ein fehlendes `offset_ms` ist vollständig valide und löst **keine** Warnung und keinen Zwangs-Default aus; falls gesetzt, muss es numerisch sein.
     - Bei ungültiger Schema-Version, fehlendem Titel, ungültigem Datum, unbekannter Kategorie oder Sichtbarkeit schlägt die Validierung mit präzisen, lokalisierten Fehlermeldungen fehl.
     - Hinweise melden z. B. Winkellücken oder fehlende/unbekannte Winkelnamen.

### 4.3 Exportformate
- **JSON-Export:** Serialisiert das Videopaket im Schema v1.0. Beim Export für Team-Freigaben oder öffentliche Links werden zwingend Bereinigungsfilter angewendet (siehe Abschnitt 8).
- **CSV-Export:**
  - Spaltenkopf startet mit `PLAY #`, gefolgt von den kurzen Bezeichnungen der ausgewählten (aktiven bzw. freigegebenen) Breakdown-Felder.
  - Werte werden RFC-4180-konform escaped (Anführungszeichen verdoppeln, Felder mit Komma/Semikolon/Zeilenumbruch/Anführungszeichen in doppelte Anführungszeichen einschließen).
  - Leere Werte werden als leere Strings exportiert.

---

## 5. Film Room, Frame-Mathematik & Telestration

### 5.1 Deterministisches Frame-Raster
- Basis-Bildrate: **25 Bilder pro Sekunde** (`FRAME_MS = 40 ms` pro Frame).
- Umrechnungsfunktionen:
  - `zeitZuFrame(ms) = max(0, round(ms / 40))`
  - `frameZuZeit(frameIndex) = max(0, round(frameIndex)) * 40`
  - `istGleicherFrame(aMs, bMs) = zeitZuFrame(aMs) === zeitZuFrame(bMs)`
- **Invarianten:**
  - Jeder manuelle Scrub, jedes Einzelschritt-Vor/Zurück (`±1 Frame`) und jedes manuelle Pausieren rastet exakt auf einem Vielfachen von `40 ms` ein.
  - Neue Zeichnungen und Notizen erhalten immer den auf das Frame-Raster quantisierten Zeitstempel.

### 5.2 Exakte Winkel- und Frame-Bindung & Auto-Stop
- Zeichnungen sind **strikt** an `(angle, frameIndex)` gebunden.
  - Beim Wechsel des Kamerawinkels werden nur Zeichnungen des gewählten Winkels angezeigt.
  - Zeichnungen werden ausschließlich auf ihrem exakten Ziel-Frame sichtbar (kein vorzeitiges Aufblitzen vor Erreichen des Frames).
- **Rollenfilterung:**
  - Trainer sehen sowohl `DRAFT`- als auch `PUBLISHED`-Zeichnungen und -Notizen.
  - Spieler sehen ausschließlich `PUBLISHED`-Zeichnungen und `PUBLISHED`-Notizen sowie eigene Notizen (`authorRole === 'PLAYER'`).
- **Auto-Stop-Algorithmus (während Playback):**
  - Gegeben das Zeitintervall `(altMs, neuMs]` zwischen zwei Playback-Ticks:
    - Alle Zeichnungen des aktiven Winkels (und gemäß Rolle sichtbar) werden in Frame-Indizes umgerechnet und aufsteigend sortiert.
    - Bereits in diesem Durchlauf angefahrene Frame-Indizes (gespeichert in einer `gestoppteFrames`-Menge) werden übersprungen.
    - Liegt der Ziel-Frame im Bereich `zeitZuFrame(zielMs) > zeitZuFrame(altMs)` und `zielMs <= neuMs` (bzw. bei Frame-Überschreitung innerhalb `(altMs, neuMs]`), stoppt das Playback **sofort exakt auf `frameZuZeit(zielFrame)`** ohne Nachlauf-Tick, markiert den Frame in `gestoppteFrames` und zeigt eine Statusmeldung mit Frame-Nummer und Zeitstempel an.
    - Beim erneuten Starten (`Play`) ab genau diesem Frame verhindert die `gestoppteFrames`-Menge eine Endlos-Pause auf demselben Frame.
    - Bei manuellem Seek/Scrub oder Wechsel des Spielzugs wird `gestoppteFrames` zurückgesetzt.

### 5.3 Telestrations-Werkzeuge (Vektor-Overlay)
Koordinaten werden unabhängig von der Video-Auflösung im normierten Bereich `[0, 1]` gespeichert (gerundet auf 4 Nachkommastellen). Als logische Zeichenfläche dient ein 16:9-Bezugssystem (z. B. `1000 × 562.5`).
- **Werkzeuge:**
  - `select` (Auswählen / Verschieben / Anpassen):
    - Pfeile (`arrow`): Gesamten Pfeil verschieben oder Start-/Endpunkt über Anfasser neu positionieren.
    - Spotlights (`spotlight`): Mittelpunkt verschieben oder Radius über Griffpunkt skalieren.
    - Text (`text`): Textposition verschieben.
    - Freihand (`pen`): Bewusst **unveränderlich** nach dem Zeichnen (kann nur ausgewählt und gelöscht werden).
  - `pen` (Freihand): Erfasst Punktfolge während der Zeigerbewegung; verwirft zu kurze Striche (`< 2` Punkte oder zu geringe Distanz).
  - `arrow` (Pfeil): Start- und Endpunkt mit Pfeilspitze.
  - `spotlight` (Fokus-Kreis): Mittelpunkt und Radius-Referenzpunkt; dunkelt die restliche Spielfläche über eine Maske ab (Radius geklemmt auf sinnvollen Minimal-/Maximalbereich, z. B. `24..200` Einheiten im 1000er-Raster).
  - `text` (Beschriftung): Klick auf Position öffnet Inline-Texteingabe; Bestätigung per `Enter` oder Fokusverlust erzeugt Objekt, `Escape` bricht ab.
- **Farbpalette:** 5 vordefinierte kontrastreiche Signalfarben (z. B. Amber/Akzent, Offense-Blau, Defense-Rot, Route-Grün, Weiß).
- **Bearbeitungsaktionen:**
  - Markiertes Objekt löschen (`Entf` / `Backspace` oder Button),
  - Letzte Zeichnung im aktiven Winkel rückgängig machen (`Undo`),
  - Alle Zeichnungen im aktiven Winkel dieses Spielzugs leeren.

### 5.4 Notizen, Kommentar-Overlay & Entwurf-/Veröffentlichungs-Workflow
- **Entwurfs-Prinzip für Trainer:** Neue Zeichnungen und Trainer-Notizen starten im Status `DRAFT`. Ein Zähler zeigt offene Entwürfe über das gesamte Videopaket hinweg an. Über die Aktion **"Session veröffentlichen"** werden alle `DRAFT`-Notizen und `DRAFT`-Zeichnungen des Videopakets atomar auf `PUBLISHED` umgestellt.
- **Spieler-Notizen:** Werden direkt als eigene Notiz (`authorRole: 'PLAYER'`) angelegt und sind für den jeweiligen Spieler sichtbar und bearbeitbar/löschbar.
- **Zeitnahes Kommentar-Overlay auf dem Video:**
  - Blendet Notizen ein, die zeitlich nahe am aktuellen Frame liegen (z. B. innerhalb `±2200 ms`, Fallback auf die ersten 2 Notizen des Spielzugs).
  - Über 4 Ecken-Schaltflächen (`↖`, `↗`, `↙`, `↘`) direkt in die gewünschte Video-Ecke verschiebbar.
  - Unterstützt Inline-Bearbeitung direkt im Overlay sowie in der Seitenleiste (inkl. Sprung zum Notiz-Zeitstempel per Klick).

### 5.5 Transportsteuerung, Vollbild & Konfigurierbare Hotkeys
- **Wiedergabe-Steuerung:** Play/Pause, Vorheriger/Nächster Spielzug, `-1 Frame` / `+1 Frame`, Scrub-Timeline mit anklickbaren Markern pro Zeichnung im aktiven Winkel (Klick auf Marker springt exakt zum jeweiligen Frame), Geschwindigkeiten `0.5x`, `1.0x`, `1.5x`, Multi-Angle-Umschalter (nicht vorhandene Winkel sind deaktiviert und visuell gekennzeichnet), Anzeige eines gesetzten `offset_ms` (falls `!= 0`).
- **Vollbildmodus:** Player inkl. Zeichen-Overlay, schwebender Werkzeugleiste und Kommentar-Overlay funktioniert vollständig im Vollbild (`Esc` oder Hotkey beendet Vollbild).
- **Feste Transport-Tasten (global, solange kein Eingabefeld fokussiert ist):**
  - `Leertaste`: Play / Pause
  - `Pfeil Links` / `Pfeil Rechts`: `-1 Frame` / `+1 Frame`
  - `Pfeil Hoch` / `Pfeil Runter`: Vorheriger / Nächster Spielzug
  - `Entf` / `Backspace`: Ausgewählte Zeichnung löschen (nur Trainer)
  - `Esc`: Vollbild verlassen
- **Konfigurierbare Benutzer-Hotkeys (genau 1 alphanumerisches Zeichen `[a-z0-9]`):**
  - Aktionen & Standardbelegung:
    - `select`: `v`
    - `pen`: `p`
    - `arrow`: `a`
    - `spotlight`: `s`
    - `text`: `t`
    - `undo`: `z`
    - `toggleDrawBar`: `d`
    - `toggleFullscreen`: `f`
    - `switchAngle`: `c`
  - **Validierung & Konfliktprüfung:** Ungültige Tasten (nicht `[a-z0-9]`, reservierte Sondertasten) sowie Doppelbelegungen werden abgelehnt und blockieren die Übernahme mit klarem Fehlerhinweis. Zurücksetzen auf Standardwerte möglich.

---

## 6. Breakdown Tagging-Engine, Feld-Mathematik & Lernendes Wörterbuch

### 6.1 Standard-Schema (22 Felder in 4 Gruppen)
Jedes Feld hat Schlüssel, Anzeigename, Kurzbezeichnung, Gruppe, Typ und Aktiv-Flag:

| Gruppe | Schlüssel | Kurz | Typ | Werte / Semantik |
| :--- | :--- | :--- | :--- | :--- |
| **SITUATION** | `odk` | `ODK` | `select` | `O` (Offense), `D` (Defense), `K` (Kicking/Special Teams) |
| **SITUATION** | `down` | `DN` | `select` | `1`, `2`, `3`, `4` |
| **SITUATION** | `distance` | `DIST` | `number` | Yards bis First Down / Goal |
| **SITUATION** | `yard_line` | `YD LN` | `number` | `-50..-1` (eigene Hälfte), `0` (= `50`), `+1..+49` (gegnerische Hälfte) |
| **SITUATION** | `hash` | `HASH` | `select` | `L`, `M`, `R` |
| **SITUATION** | `play_type` | `PLAY TYPE` | `select` | `RUN`, `PASS`, `SPECIAL`, `PENALTY` |
| **OFFENSE** | `off_pers` | `PERS` | `combobox` | z. B. `10`, `11`, `12`, `20`, `21`, `22` |
| **OFFENSE** | `off_form` | `OFF FORM` | `combobox` | z. B. `Trips Right`, `Doubles`, `I-Form`, `Empty`, `Ace` |
| **OFFENSE** | `off_strg` | `STRG` | `select` | `L`, `R`, `M` |
| **OFFENSE** | `backfield` | `BACKFIELD` | `combobox` | z. B. `Gun Split`, `Pistol`, `Singleback`, `Under Center` |
| **OFFENSE** | `motion` | `MOTION` | `combobox` | z. B. `Jet`, `Orbit`, `Zip`, `Short`, `Shift` |
| **OFFENSE** | `off_play` | `OFF PLAY` | `combobox` | z. B. `Inside Zone`, `Power`, `Counter`, `Mesh`, `Four Verts`, `RPO Bubble` |
| **OFFENSE** | `rpo` | `RPO` | `combobox` | z. B. `None`, `Bubble`, `Glance`, `Slant`, `Stick` |
| **OFFENSE** | `play_dir` | `DIR` | `select` | `L`, `R`, `M` |
| **RESULT** | `result` | `RESULT` | `combobox` | z. B. `GAIN`, `LOSS`, `COMPLETE`, `INCOMPLETE`, `TD`, `FIRST DOWN`, `SACK`, `INT`, `FUMBLE`, `FLAG` |
| **RESULT** | `gn_ls` | `GN/LS` | `number` | Raumgewinn/-verlust in Yards |
| **DEFENSE** | `def_str` | `DEF STR` | `select` | `L`, `R` |
| **DEFENSE** | `def_front` | `DEF FRONT` | `combobox` | z. B. `Even`, `Odd`, `Over`, `Under`, `Bear`, `Stack` |
| **DEFENSE** | `def_pers` | `DEF PERS` | `combobox` | z. B. `4-3`, `3-4`, `Nickel`, `Dime`, `Goal Line` |
| **DEFENSE** | `coverage` | `COVERAGE` | `combobox` | z. B. `Cover 0`, `Cover 1`, `Cover 2`, `Cover 3`, `Cover 4`, `Cover 6`, `Quarters` |
| **DEFENSE** | `stunt` | `STUNT` | `combobox` | z. B. `None`, `Twist`, `TEX`, `Pirate`, `Slant` |
| **DEFENSE** | `blitz` | `BLITZ` | `combobox` | z. B. `None`, `Mike`, `Will`, `Sam`, `Corner`, `Zone Blitz` |

### 6.2 Yard-Line-Konvention & Bidirektionale Automatik (`YD LN <-> GN/LS`)
- **Absolute Feldposition (`0..100` vom eigenen Tor zur Endzone des Gegners):**
  - `yard_line = 0` wird auf `50` (Mittellinie) normalisiert.
  - `yard_line < 0` (eigene Hälfte `-50..-1`): `absPos = min(50, abs(yard_line))` (z. B. `-25` -> `25`).
  - `yard_line > 0` (gegnerische Hälfte `+1..+49`): `absPos = 100 - min(50, yard_line)` (z. B. `+20` -> `80`).
  - Rückkonvertierung `absPos -> yard_line`:
    - `absPos === 50` -> `50`
    - `absPos < 50` -> `-absPos` (eigene Hälfte)
    - `absPos > 50` -> `100 - absPos` (gegnerische Hälfte, z. B. `80` -> `+20`)
- **Bidirektionale Synchronisation zwischen aufeinanderfolgenden Spielzügen:**
  - Zwei benachbarte Spielzüge werden nur dann verknüpft, wenn **beide dasselbe `ODK` haben** (oder mindestens beim aktuellen Spielzug gesetzt und beim Nachfolger kompatibel ist) und **keiner der beiden als `FLAG` markiert ist**.
  - **Ausnahme `FLAG` (Strafe):** Sobald `result === 'FLAG'` (case-insensitiv) gesetzt ist, wird jegliche automatische Neuberechnung von `gn_ls` oder der nächsten `yard_line` **ausgesetzt**, damit Straf-Yards nicht fälschlich als regulärer Raumgewinn verbucht werden. In der UI erscheint ein entsprechender Hinweis.
  - **Sonderregel `TD` (Touchdown):** Bei `result === 'TD'` und vorhandener `yard_line` wird `gn_ls = 100 - yardLineZuAbsolut(yard_line)` automatisch berechnet.
  - **Sonderregel `INCOMPLETE`:** Setzt `gn_ls = 0` automatisch.
  - **Vorwärtsberechnung:** Änderung von `yard_line` oder `gn_ls` berechnet beim vorhandenen Folge-Spielzug dessen `yard_line` aus `absPos + gn_ls` (geklemmt auf `[1, 99]`), sofern kein `FLAG` vorliegt und dessen `odk` übereinstimmt.
  - **Rückwärtsberechnung:** Änderung der `yard_line` des aktuellen Spielzugs berechnet beim vorherigen Spielzug (sofern gleicher `odk`, kein `FLAG` und `yard_line` bekannt) dessen `gn_ls = absPosAktuell - absPosVorher`.

### 6.3 Tagging-Oberfläche & Lernendes Wörterbuch
- **Zwei synchronisierte Eingabewege:**
  1. **Quick-Tag-Panel** neben dem Player im Film Room mit Gruppen-Reitern (`Alle`, `Situation`, `Offense`, `Defense`) zur fokussierten Eingabe während der Videosichtung.
  2. **Tabellarisches Breakdown-Data-Grid** unterhalb des Players mit allen aktiven Feldern, direkter Inline-Bearbeitung für Trainer, Hervorhebung des aktiven Spielzugs, automatischem Scroll/Fokus auf den gewählten Spielzug, Filter nach Play-Status/Suche (sofern genutzt) und **direktem CSV-Export der aktuell sichtbaren Spalten**.
- **Selbstlernendes Wörterbuch:**
  - Bei jedem `combobox`-Feld wird ein neu eingegebener, getrimmter Wert beim Verlassen des Feldes (`blur`) case-insensitiv gegen bestehende Definitionen geprüft.
  - Ist der Begriff neu, wird er automatisch dauerhaft in das Team-Wörterbuch dieses Feldes aufgenommen und steht sofort allen Trainern des Mandanten als Vorschlag zur Verfügung.
- **Schema-Verwaltung (nur `TEAM_ADMIN`):**
  - Standardfelder ein-/ausschalten (`active`),
  - Neue benutzerdefinierte Felder (`CUSTOM`) mit Bezeichnung, Kurzname, Typ (`combobox`, `text`, `number`, `select`) und optionalen Initialwerten anlegen,
  - Benutzerdefinierte Felder löschen (Standardfelder können deaktiviert, aber nicht gelöscht werden),
  - Einzelne Wörterbuch-Begriffe pro Feld hinzufügen oder entfernen.

---

## 7. Schnitt- & Multi-Angle-Sync-Editor

Der Editor unterstützt zwei klar getrennte Betriebsmodi entsprechend dem `sourceMode` des Videopakets.

### 7.1 Modus `CLIP_FILE` — Multi-Angle-Sync & Clip-Verwaltung
- **Zweck:** Abgleich einzelner Clips zwischen einem **Master-Winkel** (erster definierter Winkel) und wählbaren **Nebenwinkeln** sowie Korrektur vertauschter oder fehlender Clips.
- **Dual-Viewport-Vorschau:** Gleichzeitige Darstellung von Master-Winkel und gewähltem Nebenwinkel für den selektierten Spielzug inkl. Anzeige des aktuellen Versatzes (`offset_ms`).
- **Anomalie-Erkennung:** Automatische Analyse aller Spielzüge über alle Nebenwinkel:
  - `MISSING_CLIP`: Quelle im Nebenwinkel ist `null`.
  - `OFFSET_APPLIED`: `offset_ms != 0`.
  - `DURATION_MISMATCH`: Abweichung der Clip-Dauer zum Master-Winkel überschreitet den Schwellenwert von **`2000 ms`**.
  - Filteroption zum gezielten Durchblättern nur auffälliger Spielzüge.
- **Sync-Werkzeuge:**
  - Feinkalibrierung des `offset_ms` in Frame-Schritten (`±40 ms`), Grobschritten (`±200 ms`) oder Reset (`0` -> Feld `offset_ms` wird bereinigt/`undefined`).
  - **Kaskadierendes Anwenden:** Optionales Übertragen eines geänderten Offsets nicht nur auf den aktuellen, sondern auf alle nachfolgenden Spielzüge dieses Nebenwinkels.
  - **Lücke einfügen / Clip entfernen:** Setzt die Quelle eines Winkels auf `null` ohne den Spielzug oder andere Winkel zu löschen.
  - **Nachbar-Tausch (`-1` / `+1`):** Tauscht die Quelle eines Winkels zwischen Play `N` und `N-1` bzw. `N+1` zur schnellen Behebung von Versatzfehlern aus dem Feld-Upload.

### 7.2 Modus `TIME_SLICE` — Schnell-Zuschnitt aus Rohmaterial (Fast-Cut)
- **Zweck:** Zerlegung eines zusammenhängenden Rohvideos in nummerierte Spielzüge über Zeitintervalle `[start_ms, end_ms]`.
- **Shuttle-Steuerung (J / K / L):**
  - Geschwindigkeitsstufen: `-4x`, `-2x`, `-1x`, `0` (Stopp), `+1x`, `+2x`, `+4x`.
  - Taste `J` schaltet schrittweise rückwärts (von Vorwärts erst auf `-1x`, dann `-2x`, dann `-4x`).
  - Taste `K` stoppt sofort auf `0` und rastet auf dem nächsten Frame ein.
  - Taste `L` schaltet schrittweise vorwärts (`+1x` -> `+2x` -> `+4x`).
  - `Pfeil Links / Rechts` bewegt den Playhead um exakt `±1 Frame (40 ms)`.
- **In / Out & Schnitt-Logik:**
  - `I` setzt In-Punkt (auf Frame gerastet).
  - `O` setzt Out-Punkt (auf Frame gerastet); bei aktiviertem **"Auto-Cut bei Out"** wird sofort der neue Spielzug erzeugt.
  - **Validierung & Mindestdauer:** `end_ms - start_ms` muss mindestens **`400 ms`** betragen; ansonsten wird der Schnitt mit Hinweis abgelehnt.
  - **Chronologische Sortierung & Neunummerierung:** Jeder neu hinzugefügte oder getrimmte Spielzug wird anhand des Startzeitpunkts des Primärwinkels chronologisch einsortiert; anschließend werden alle `play_number` lückenlos von `1..N` neu vergeben.
  - Vorhandene Spielzüge können über ihre In-/Out-Werte getrimmt (Frame-quantisiert) oder gelöscht werden (mit automatischer Neunummerierung).

---

## 8. Smart Playlists & Dynamische Cutups

### 8.1 Regel-Engine
- **Kombinator:** `AND` (alle Regeln müssen zutreffen) oder `OR` (mindestens eine Regel muss zutreffen). Eine Playlist ohne Regeln liefert 0 Treffer.
- **Operatoren (8 Stück) auf beliebige Standard- und Custom-Felder:**
  1. `equals`: Exakter Vergleich (bei Zahlen numerisch, bei Texten case-insensitiv getrimmt).
  2. `not_equals`: Negierter Vergleich.
  3. `contains`: Teilstring-Suche (case-insensitiv).
  4. `gte`: Größer oder gleich (`>=`, numerisch).
  5. `lte`: Kleiner oder gleich (`<=`, numerisch).
  6. `in`: Wert ist in einer definierten Werteliste enthalten (case-insensitiv).
  7. `is_empty`: Feld nicht gesetzt oder leerer String.
  8. `is_not_empty`: Feld gesetzt und nicht leer.

### 8.2 Vorlagen (Presets), Auswertung & Aktionen
- **4 integrierte Schnellvorlagen:**
  - *3rd Down Situation* (`down = 3`)
  - *Redzone* (`yard_line >= 1` und `yard_line <= 20`)
  - *Explosive Plays (15+ Yds)* (`gn_ls >= 15`)
  - *Blitz-Situationen* (`blitz` nicht leer und `!= "None"`)
- **Live-KPI-Auswertung über die Treffermenge:**
  - Gesamtanzahl Treffer (`count`),
  - Durchschnittlicher Raumgewinn (`avgGain`),
  - Run-/Pass-Verteilung (`runCount`, `passCount`),
  - Anzahl Explosive Plays (`>= 15 Yards`),
  - Anzahl Touchdowns (`result === 'TD'`).
- **Sichtbarkeit & Filterung:** Berücksichtigt automatisch Saison-Kontext und Rolle (Spieler sehen nur Playlists und Quell-Videos, die für sie freigegeben sind).
- **Aktionen:**
  - Speichern, Bearbeiten und Löschen (für Trainer),
  - Multi-Tape-CSV-Export aller Treffer-Spielzüge inkl. Quell-Tape-Kontext,
  - Direkter Sprung aus einem Treffer in den Film Room genau zum entsprechenden Videopaket und Spielzug (`initialPlayNumber`).

---

## 9. Team-zu-Team-Austausch & Externe Read-Only-Freigaben

### 9.1 Datenschutz-Invariante (Harte Sicherheitsgrenze)
Beim Teilen eines Videopakets mit einem anderen Team **oder** über einen öffentlichen Download-Link gilt ausnahmslos:
- **Coach-Notizen (`notes`) und Telestrations-Zeichnungen (`drawings`) werden NIEMALS mitexportiert oder übertragen.** Sie werden bei jeder gefilterten Export- oder Vorschau-Erzeugung vollständig entfernt (`notes: []`, `drawings: []`).
- **Spaltenfilterung:** Im `breakdown`-Objekt jedes Spielzugs werden ausschließlich die explizit freigegebenen `sharedFields` beibehalten. Alle nicht ausgewählten Felder (inklusive nicht freigegebener `custom`-Felder) werden entfernt.

### 9.2 Granulare Feldauswahl
Beim Erstellen einer Team-Freigabe oder eines öffentlichen Links stehen Schnellpresets sowie Einzel-Checkboxen zur Verfügung:
- **Nur Video:** `0` Tag-Felder (nur Videoclips/Quellen),
- **Basis-Tags:** `odk`, `down`, `distance`, `yard_line`, `hash`, `play_type`,
- **Alle aktiven Felder:** Sämtliche im Team-Schema aktiven Felder,
- **Individuell:** Beliebige Teilmenge aller Felder des Schemas.

### 9.3 Ablaufende & widerrufbare öffentliche Links
- Jeder öffentliche Link besitzt ein kryptografisch/eindeutig generiertes `token`, eine Bezeichnung, ein Ablaufdatum (`expiresAt`, wählbare Laufzeiten z. B. 7, 14, 30, 90 Tage) und ein `active`-Flag (zum sofortigen Widerruf).
- **Öffentliche Leseansicht (`/share/<token>`):**
  - Token unbekannt -> definierter *Nicht-gefunden*-Zustand (semantisch HTTP `404`).
  - Token widerrufen (`!active`) oder abgelaufen (`now > expiresAt`) -> definierter *Abgelaufen/Widerrufen*-Zustand (semantisch HTTP `410`).
  - Gültig -> schreibgeschützte Ansicht mit Winkel-Umschaltung, Spielzug-Liste, Tabelle der **ausschließlich freigegebenen** Tag-Spalten, Datenschutzhinweis sowie Download-Buttons für gefiltertes JSON und gefiltertes CSV (CSV nur sichtbar, wenn mindestens eine Spalte freigegeben ist).

---

## 10. Einstellungen, Speicher-Cleanup & Mehrsprachigkeit

### 10.1 Benutzereinstellungen
- Konfigurierbare Hotkeys (siehe Abschnitt 5.5),
- Standard-Ecke für das Kommentar-Overlay (`top-left`, `top-right`, `bottom-left`, `bottom-right`),
- Standard-Zustand für Auto-Stop (`ein` / `aus`),
- Standard-Wiedergabegeschwindigkeit (`0.5x`, `1.0x`, `1.5x`).

### 10.2 Speicherbereinigung & Schonfrist (System-Admin)
- Wird ein Videopaket gelöscht oder ersetzt, werden die zugehörigen Mediendateien nicht sofort physisch vernichtet, sondern in eine **Cleanup-Warteschlange** mit konfigurierbarer Schonfrist (`1..90 Tage`, Standard z. B. `14 Tage`) eingereiht.
- Darstellung für `SYSADMIN`: ausschließlich anonymisierter Objektpfad, Dateigröße, Löschfrist (`deleteAfter`), aktueller Status (`PENDING` | `PROCESSING` | `DELETED` | `FAILED`) und manuelle Trigger-/Wiederholungsmöglichkeit — ohne Zuordnung zu Teamnamen oder Videometadaten.

### 10.3 Mehrsprachigkeit (i18n)
- Vollständige Unterstützung für **Deutsch (`de`)** und **Englisch (`en`)** über Übersetzungsschlüssel mit Parameter-Interpolation (inkl. lokalisierter Datumsformatierung, Rollenbezeichnungen, Kategorien, Sichtbarkeitsstufen, Validierungsfehlern und Hotkey-Beschreibungen).
- Fachliche Football-Kurzbegriffe (`ODK`, `GN/LS`, `YD LN`, `RPO`, etc.) bleiben domänenkonform erhalten.

---

## 11. Nicht-funktionale Anforderungen & Testkriterien

### 11.1 Benutzeroberfläche & Ergonomie
- **Film-Room-Optimierung:** Hoher Kontrast auf dunkler Grundfläche zur Vermeidung von Blendung beim Video-Studium; sparsame Verwendung genau einer Signalfarbe für aktive Zustände, Timeline-Position und primäre Aktionen; konsequent tabellarische Ziffern (`tabular-nums`) für Zeitstempel, Frame-Indizes, Yard-Angaben und Statistiken.
- **Tastatur-Priorität & Barrierefreiheit:** Vollständige Bedienbarkeit aller Transport-, Schnitt- und Zeichenfunktionen per Tastatur (sofern kein Eingabefeld Fokus hat); semantische ARIA-Labels für Steuerelemente und Statusmeldungen.

### 11.2 Sicherheit & Datenintegrität
- Serverseitige (bzw. vertrauenswürdige) Durchsetzung aller Rollen-, Mandanten-, Saison- und Sichtbarkeitsregeln (niemals allein durch UI-Ausblendung).
- Schutz vor Cross-Site-Scripting (keine unbereinigte HTML-Interpretation von Notizen, Tag-Werten oder Import-Daten).
- Medienzugriff ausschließlich über kurzlebige, signierte URLs nach vorheriger Berechtigungsprüfung (bzw. validiertem Share-Token).
- Strenge Validierung aller Import-Daten gegen Schema-Grenzen (Zeiten, Datumsformat, Winkelnamen, Typen).

### 11.3 Testbare Abnahmekriterien (Automatisierte Domänen-Tests)
Eine Neuimplementierung muss mindestens folgende Domänenlogik durch automatisierte Tests absichern:
1. **Bundle-/Import-Schema:** Akzeptanz gültiger Pakete ohne `offset_ms`, Auffüllen fehlender Winkel mit `null`, Ablehnung von `end_ms <= start_ms`, falscher Schema-Version und ungültigem Datum.
2. **Frame-Raster & Auto-Stop:** Korrekte 40-ms-Quantisierung, Winkel- und Frame-Isolation von Zeichnungen, exakter Stopp auf dem nächsten ungestoppten Marker in `(altMs, neuMs]`, keine Endlos-Pause bei erneutem Start ab dem gestoppten Frame, Hotkey-Konflikt- und Zeichenvalidierung.
3. **Tagging-Engine:** Yard-Line-Konvertierung (`-50..-1`, `0 -> 50`, `+1..+49`), bidirektionale `YD LN <-> GN/LS`-Automatik über die Mittellinie hinweg, Unterbrechung bei `FLAG`, `TD`- und `INCOMPLETE`-Sonderregeln, Wörterbuch-Deduplizierung (case-insensitiv).
4. **Cut & Multi-Angle-Sync:** Offset-Anpassung inkl. Bereinigung bei `0`, Kaskadierung auf Folge-Plays, Clip-Lücke (`null`), Nachbar-Tausch, Anomalie-Erkennung (`DURATION_MISMATCH > 2000 ms`, `MISSING_CLIP`, `OFFSET_APPLIED`), Shuttle `J/K/L`, Mindestdauer `400 ms`, chronologische Neusortierung und Neunummerierung.
5. **Smart Playlists:** Alle 8 Filteroperatoren auf Standard- und Custom-Feldern, `AND`/`OR`-Kombination, Rollen-/Saison-Filterung, KPI-Berechnung (`avgGain`, Run/Pass-Split, Explosive Plays, TDs).
6. **Datenschutz & Sharing:** Garantiertes Entfernen von `notes` und `drawings` bei Team- und Public-Shares, striktes Filtern auf freigegebene Spalten in JSON und RFC-4180-CSV, Ablauf-/Widerrufsprüfung (`404` vs. `410`).
