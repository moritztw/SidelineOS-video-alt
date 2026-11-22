# AI Handoff – SidelineOS-Core Videoanalyse-Plugin (`video-analysis`)

Dieses Verzeichnis ist bewusst **vollständig in sich gekapselt**, damit es ohne Altlasten in ein eigenes GitHub-Repository (z. B. `sidelineos-plugin-video`) ausgelagert und über den SidelineOS-Core Plugin Store installiert werden kann.

---

## 1. Woran wir bislang gearbeitet haben (Status quo)

Alle Funktionen von **Paket 1**, **Paket 2a** und **Paket 2b** der Videoanalyse sind hier als UI- und Logik-Prototyp vollständig umgesetzt und durch Unit-Tests abgesichert:

1. **Videobibliothek & Upload (`components/DashboardView.tsx`, `components/UploadPanel.tsx`)**
   - Filterung nach Team, Saison (`filtereNachSaison` aus `@sidelineos/plugin-sdk`), Kategorie (`Spiel`, `Training`, `Scouting`, `Self-Scout`) sowie Volltextsuche.
   - Strikte Sichtbarkeitstrennung für Spieler (`COACHES_ONLY` wird ausgeblendet; Coaches können per Dropdown auf `ALL_PLAYERS` / Unit-Freigaben umschalten).
   - Dual-Import im Upload-Panel:
     - **Einzelclips** (optionales Offset – kein manueller Sync-Zwang bei zwei manuellen Kameras)
     - **Einzeldatei (Time-Slice)**
     - **JSON-Import & -Export (`sideline-bundle.json`, Version 1.0)** via `services/bundleSchema.ts` inkl. Validierung.

2. **Team-zu-Team Austausch & öffentliche `/share/<token>`-Ansicht (`components/TeamShareModal.tsx`, `components/PublicShareView.tsx`)**
   - Granulare Auswahl pro Empfänger-Team/Scouting-Pool, *welche* Tagging-Felder (inkl. Custom-Feldern) mitgeteilt werden.
   - Öffentliche, zeitlich ablaufende Download-Links mit `/share/<token>`-Pfad inkl. wählbarer Tagging-Freigabe.
   - SDK-entkoppelte Read-Only-Empfängeransicht über `renderPublicShareView` (`404`/`410`-Prüfung, Play- & Multi-Angle-Vorschau, ausschließlich freigegebene Breakdown-Spalten, gefilterte JSON/CSV-Downloads ohne Coach-Notizen/Zeichnungen).

3. **Film Room & Exakte Frame-Telestration (`components/FilmRoomView.tsx`, `components/TelestrationCanvas.tsx`, `services/frameAndHotkeys.ts`)**
   - Multi-Angle-Wechsel (z. B. Sideline / Endzone) ohne Verlust der Play-Position.
   - Vollbildmodus direkt über dem Video inkl. eingeblendeter Zeichenleiste am unteren Rand.
   - Zeichenwerkzeuge (Freihand, Pfeil, Kreis/Zone, Spotlight, Text) mit **Editierbarkeit nach dem Zeichnen** (Auswahl-Werkzeug: Spotlight verschieben, beide Endpunkte eines Pfeils oder komplette Formen verschieben).
   - **Exakte Frame-Bindung (25 fps / 40 ms Raster)**: Zeichnungen und Coach-Notizen gehören ausschließlich zum gewählten Video-Winkel und zum exakten `frameIndex` (nicht vorzeitiges Aufblitzen vor dem Auto-Stop!). `findeNaechstenAutoStopFrame` sucht strikt im aktuellen Frame-Fenster bzw. vorwärts ohne Überschießen.
   - **Kommentar-Overlay über dem Video**: frei in eine der 4 Ecken verschiebbar, direkt im Overlay editierbar (Text-Bearbeitung & Löschen), Entwurf vs. Veröffentlicht.
   - **Frei konfigurierbare Hotkeys**: Persönliche Belegung mit Konflikt-Check (`aktualisiereBenutzerHotkey`) und Player-Defaults (Standard-Ecke, Tempo, Auto-Stop), bereitgestellt über `VideoUserSettingsPanel` im zentralen SidelineOS Einstellungs-Hub.

4. **Hudl-kompatibles Breakdown-Tagging & Wörterbuch (`components/BreakdownGrid.tsx`, `components/TaggingSchemaSettings.tsx`, `services/taggingEngine.ts`)**
   - Alle angeforderten Felder implementiert: `ODK`, `PLAY #`, `DN`, `DIST`, `YARD LN` (editierbar), `OFF FORM`, `OFF STRG` (`R/L/Middle`), `BACKFIELD`, `MOTION`, `OFF PERS`, `OFF PLAY`, `RPO`, `PLAY DIR` (`R/L/Middle`), `RESULT` (`COMPLETE`, `INCOMPLETE`, `FUMBLE`, `TD`, `INTERCEPTION`, `SACK`, `SAFETY`, `FLAG`), `GN/LS`, `DEF FRONT`, `DEF STR` (`R/L`), `DEF PERS`, `STUNT`, `BLITZ`, `EFF` + `Custom-Felder`.
   - **Automatische Gain/Loss-Berechnung**: `berechneGainLoss` & `berechneNeueFeldposition` rechnen `YARD LN` und `GN/LS` bidirektional um – **mit gezielter Ausnahme bei `RESULT === 'FLAG'`**, damit Strafen die reale Gain/Loss-Statistik nicht verfälschen.
   - **Lernendes Team-Wörterbuch**: Einmal eingegebene Formationen, Plays, Backfields, Fronts, Stunts, Blitzes bleiben im Team-Schema gespeichert; Fehleinträge kann nur der Team Admin löschen; Felder lassen sich aktivieren/deaktivieren oder als eigene Custom-Felder anlegen (`VideoTeamSettingsPanel`).

5. **Kapselung & SDK-Anbindung (`index.ts`, `manifest.ts`, `plugin.manifest.json`, `VideoAnalysisContext.tsx`, `components/VideoSettingsPanels.tsx`)**
   - Implementiert das `SidelinePlugin`-Interface aus `src/sdk/plugin.ts`.
   - Hält seinen Zustand vollständig isoliert im `VideoAnalysisProvider` (keine Video-Logik mehr im SidelineOS-Core).

---

## 2. Warum wir diese Entscheidungen getroffen haben (Design Rationale)

- **Optionaler Kamera-Offset:** Viele Amateur- und Jugendprogramme filmen mit zwei manuellen Kameras ohne Timecode-Sync. Ein erzwungener Offset würde den Import unnötig ausbremsen.
- **25fps Frame-Raster + exakte Frame-Abfrage:** Durch Rundung auf `FRAME_MS = 40` und strikten Vergleich auf `frameIndex` wird das frühere Bug-Symptom („Kommentar blitzt beim Auto-Stop kurz vorher auf“) zuverlässig verhindert.
- **Trennlinie Core vs. Plugin:** Sobald SidelineOS auch Playbook, Roster oder Scouting als eigenständige GitHub-Repos anbietet, dürfen Kernfunktionen (Auth, Teams, Saisons, S3-Broker, Store) nicht mit Video-Typen (`VideoReel`, `PlayBreakdown`) gekoppelt sein. Dieses Plugin darf daher ausschließlich über `@sidelineos/plugin-sdk` (`src/sdk/plugin.ts`) mit dem Core sprechen.
- **DSGVO / S3-Cleanup (`VideoSysadminSettingsPanel`):** Der Sysadmin sieht ausschließlich anonymisierte `s3Prefix`-Pfade und Schonfristen, niemals Team-Videos oder Coach-Notizen.

---

## 3. Was in diesem Plugin noch fehlt (Roadmap für das separate Repo)

> **Hinweis:** Im `SidelineOS-Core`-Repository wird nur noch der Core weiterentwickelt. Die folgenden Schritte werden nach der Auslagerung direkt im eigenen Repository `sidelineos-plugin-video` umgesetzt:

1. **Paket 3 – Cut & Multi-Angle Sync + Smart Playlists**
   - `VideoCutSyncPlaceholder.tsx` ersetzen durch:
     - Echten Dual-Viewport Sync-Editor (Einzelclips mit optionalem Offset, Snap-Sync, Lücken- & Fehl-Clip-Handling) und Fast-Cut-Editor (`I / O / J-K-L` für Einzeldatei-Tapes).
     - Smart Playlists (typsicheres Filter-Grid über alle aktiven & Custom-Breakdown-Spalten, speicherbare Cutups).
2. **Paket 4 – Backend-Persistenz & S3-Streaming**
   - PostgreSQL-Tabellen strikt mit Präfix `mod_video_` (siehe `dbPrefix` im Manifest).
   - Video-Upload/Playback ausschließlich über signierte S3-Presigned-URLs innerhalb von `teams/{teamId}/plugins/video-analysis/`.
   - Grundstock an Default-Definitionen für Backfield/Formationen/Fronts nach Abschluss der UI final kuratieren.
3. **Eigenes GitHub-Repo (`sidelineos-plugin-video`)**
   - Lizenz: **GNU AGPLv3** (Pflicht wegen Kopplung an SidelineOS-Core).
   - Imports von `../../../sdk/plugin.ts` auf `@sidelineos/plugin-sdk` umstellen und gegen das Build-Format `sideline-plugin-v1` bündeln (siehe `/docs/plugin-sdk.md`).
