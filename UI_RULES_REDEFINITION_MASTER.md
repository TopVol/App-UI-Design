# UI Rules Redefinition Master

**Zweck:** Diese Datei beschreibt das UI-/Layout-Vorhaben in einer einzigen, wiederverwendbaren Markdown-Spezifikation, damit eine andere App ihre UI-Regeln auf Basis der Arbeiten in diesem Repository neu definieren kann.

**Herkunft:** Abgeleitet aus der modularen v4.9-Oberfläche, der Legacy-Bridge `mvp_demo_v4.8.html`, der wiederhergestellten Legacy-Logik in `files/`, dem Constraint-Konzept aus `Layout Rules.txt` sowie der rekonstruierten TypeScript-/Compat-Schicht.

---

## 1. Kernidee

Die Anwendung wird nicht als starre Seite verstanden, sondern als **Fenster-System mit verschachtelten Bereichen**.

- Die gesamte App ist ein **Root-Fenster**.
- Innerhalb dieses Root-Fensters existieren weitere **Fenster**, **Panels**, **Overlays** und **Elemente**.
- Alle Bereiche folgen **klaren geometrischen Regeln**.
- Resize, Collapse, Expand, Snap und Sichtbarkeit sind **regelbasiert**, nicht rein dekorativ.
- Die UI ist **zustandsgetrieben**: das Layout ist Ergebnis eines State-Modells, nicht bloß DOM-CSS-Zufall.

Die UI soll sich anfühlen wie ein **dunkles, professionelles Tool-/Workspace-System** mit kontrollierbaren Panels, nicht wie eine einfache Formularseite.

---

## 2. Zielbild für die andere App

Die andere App soll ihre UI nach folgenden Prinzipien neu definieren:

1. **Modulare App-Shell** statt monolithischer Seite
2. **Fensterartige Bereiche** mit klaren Kanten, Größenlogik und Parent-Child-Verhältnissen
3. **Seitliche Panels** und **Bottom-Panels**, die kontrolliert geöffnet/geschlossen werden können
4. **Drag- und Resize-Fähigkeit** für Hauptfenster oder Teilbereiche
5. **Deterministische Layout-Regeln** statt freier, unkontrollierter Größenänderungen
6. **Developer-/Inspect-Modus**, um Werte und Regeln sichtbar zu machen
7. **Persistenter Zustand** für Layout, Panelstatus und Fensterzustände

---

## 3. Sichtbares UI-Modell

Die App soll visuell aus folgenden Schichten bestehen:

### 3.1 Oberste Ebene
- **Desktop-/Workspace-Hintergrund**
- ruhiger dunkler technischer Look
- subtile Tiefe über Schatten, Glows, Glas-/Panel-Effekte

### 3.2 HUD / Statusleiste
- kleine Status-Chips oder Infoelemente oberhalb der Arbeitsfläche
- zeigt Modus, Zustand oder wichtige Metriken
- dient als Kontextanzeige, nicht als Hauptnavigation

### 3.3 Hauptfenster
Das zentrale Arbeitsfenster soll enthalten:
- **Header / Titlebar**
- **Header-Aktionen**
- **linke Steuerkante / Rail**
- **rechte Steuerkante / Rail**
- **Main Canvas / Arbeitsbereich**
- **optionales Bottom Panel**
- **Tooltip-/Statusbar im unteren Bereich**
- **Resize-Handle**

### 3.4 Nebenschichten
- linke Sidebar
- rechte Sidebar
- Bottom-Panel
- optionales Floating Window / Overlay-Fenster

---

## 4. Visueller Stil

Die andere App soll sich stilistisch an folgenden Eigenschaften orientieren:

- dunkles modernes Tool-UI
- kühle technische Farbwelt
- Panels mit sanften Verläufen
- feine Linien statt harter Rahmen
- klare Tiefenstaffelung durch Schatten
- Header- und Button-System mit diskreter Interaktivität
- runde Ecken, aber nicht verspielt
- Statuslichter/Indikatoren mit präziser Bedeutung
- professionelle Desktop-App-Anmutung, auch wenn sie im Browser läuft

### Stilregeln
- Keine überladene Buntheit
- Keine zufälligen Abstände
- Keine inkonsistente Button-Sprache
- Panels und Fenster sollen wie Teile **eines Systems** aussehen, nicht wie zusammengesammelte Widgets

---

## 5. Funktionale Fensterlogik

Jedes Fenster oder panelartige Element soll mindestens diese Eigenschaften besitzen:

- `id`
- `name`
- `parentId`
- `bounds` (x, y, width, height)
- `minSize`
- `maxSize`
- `defaultSize`
- `currentSize`
- `adaptSize`
- `previousSize`
- `visibilityPolicy`
- `resizePolicy`
- `snapPolicy`
- optionale `metadata`

### Bedeutung der Größenwerte
- **defaultSize**: Startwert beim App-Start
- **currentSize**: aktueller Ist-Zustand
- **adaptSize**: Zielwert für situationsabhängige Anpassung, z. B. beim Expand in größerer Umgebung
- **previousSize**: letzte vorherige Größe für Rückfallverhalten, z. B. beim Collapse/Undo

---

## 6. Normative UI-Regeln

### MUSS-Regeln
1. Ein Child-Bereich darf nie größer sein als der nutzbare Innenbereich seines Parents.
2. Jede Größenänderung muss `minSize` und `maxSize` respektieren.
3. Sibling-Bereiche dürfen sich nicht überlappen, außer sie sind explizit als Overlay markiert.
4. Ohne explizite Scroll-Freigabe ist Overflow verboten.
5. Gleicher Input muss zu gleichem Layout-Ergebnis führen.
6. Persistente Layout-Aktionen müssen reproduzierbar sein.

### SOLL-Regeln
1. Fensterkanten sollen an benachbarte Kanten einrasten können.
2. Corner-Resize soll proportional möglich sein, wenn der Bereich proportional skaliert werden soll.
3. Parent-Resize soll untergeordnete Bereiche nach klarer Priorität anpassen.
4. Flexible Bereiche sollen vor starren Bereichen auf Größenänderungen reagieren.

### KANN-Regeln
1. Snap kann temporär über Modifier-Taste deaktiviert werden.
2. Einheiten im Dev-Modus können in px und Prozent dargestellt werden.
3. Expand/Collapse kann optional animiert werden.

---

## 7. Resize-Verhalten

### 7.1 Allgemeines Verhalten
- Resize wird als kontrollierter Drag-Lifecycle behandelt
- Start: Snapshot des relevanten Zustands
- Update: Delta berechnen, Zielgröße anwenden, Constraints prüfen
- Ende: Commit oder Rollback

### 7.2 Intelligentes Resize
- Wenn eine Kante beim Resize in die Nähe einer relevanten Nachbarkante kommt, soll sie einrasten
- Einrastung soll Ordnung fördern, aber nicht freie Platzierung unmöglich machen
- Corner-Resize soll nach Wunsch verhältnistreu arbeiten

### 7.3 Resize-Folgen für Nachbarn
Wenn eine Kante mit einer anderen logisch gekoppelt ist:
- benachbarte Bereiche sollen mitverschoben oder mitverkleinert werden
- Shared-Edge-Verhalten ist erlaubt und gewünscht
- Änderungen sollen nachvollziehbar und stabil sein

---

## 8. Collapse / Expand

### Expand
Beim Aufklappen eines Bereichs gilt:
- `previousSize` sichern
- Zielgröße bestimmen
- wenn Parent aktuell größer als sein Standardzustand ist, soll bevorzugt `adaptSize` oder Parent-naher Zustand genutzt werden
- danach final validieren und committen

### Collapse
Beim Einklappen gilt:
- auf sinnvollen Minimal- oder zuvor gesicherten Zustand zurückgehen
- `previousSize` soll Wiederherstellung ermöglichen
- nach dem Collapse müssen alle Constraints erneut berechnet werden

---

## 9. Snap-System

Snap soll an folgenden Referenzen möglich sein:
- Parent-Kanten
- Sibling-Kanten
- definierte Größenreferenzen

### Empfohlene Standardwerte
- `snapThreshold`: 8 px
- `adjacencyTolerance`: 1 px
- `minDragDelta`: 2 px

Snap ist keine reine Optikfunktion, sondern ein **Ordnungswerkzeug**.

---

## 10. Sichtbarkeit / Overflow / Scroll

### Default
- `noOverflow` ist Standard
- Inhalte sollen nicht einfach über ihre Container hinauslaufen

### Scroll-Ausnahme
Wenn Overflow erlaubt ist:
- muss der Parent bewusst als Scroll-Container definiert werden
- Scrollbarkeit muss bedienbar und sichtbar sein
- Overflow darf nie wie ein versehentlicher Fehler wirken

---

## 11. State-Prinzip

Die andere App soll ihr Layout **state-getrieben** verwalten.

### Grundsatz
- UI-Zustand lebt in einem zentralen StateStore
- UI-Aktionen erzeugen Zustandsänderungen
- Layout wird nicht direkt „frei im DOM“ manipuliert, sondern über State + Engine + Render

### Zu persistierende Zustände
- Fensterposition
- Fenstergröße
- Sidebar offen/geschlossen
- Bottom Panel offen/geschlossen
- Fullscreen-Status
- aktive Ansicht
- optional Floating Window

### Empfohlene Fähigkeiten des Stores
- `getState()`
- `getWindow()`
- `subscribe()`
- `commit()`
- `undo()`
- `redo()`
- `resizeWindow()`
- `moveWindow()`
- `collapseWindow()`
- `expandWindow()`
- `setSizeValue()`
- `getWindowDiagnostics()`

---

## 12. Architektur für die andere App

Empfohlene Modulstruktur:

1. **LayoutTree**
   - Parent-Child-Hierarchie
   - Traversal
   - Sibling- und Parent-Abfragen

2. **ConstraintEngine**
   - Parent-Grenzen
   - min/max-Clamp
   - Kollisionen
   - Overflow-Logik
   - Snap
   - Endvalidierung

3. **ResizeController**
   - Pointer-/Drag-Lifecycle
   - Throttling
   - Commit/Rollback

4. **StateStore**
   - Single Source of Truth
   - Undo/Redo
   - Persistenz-Anbindung

5. **Render-Schicht**
   - reine Darstellung
   - liest nur State/Metriken
   - enthält keine Geschäftslogik

6. **DevOverlay / Inspector**
   - Diagnose
   - Wertanzeige
   - Regelinspektion

---

## 13. Interaktive UI-Elemente

Die andere App soll Buttons und Controls nicht nur als Style-Elemente behandeln, sondern als regelgebundene UI-Aktionen.

### Typische Header-Aktionen
- Speichern
- Laden
- Undo
- Redo
- Fullscreen

### Typische Panel-Aktionen
- linke Sidebar toggeln
- rechte Sidebar toggeln
- Bottom Panel toggeln
- Floating Window öffnen/schließen

### Navigation
- aktive Ansicht im Main Canvas umschalten
- Sichtbarkeit soll im State abgebildet werden

---

## 14. Dev- / Inspect-Modus

Die andere App soll einen Dev-Modus unterstützen, in dem UI-Regeln sichtbar und editierbar werden.

### Mindestens wünschenswert
- Fensterlabels sichtbar machen
- Kanten und Maße hervorheben
- verschiedene Werttypen farblich unterscheiden
- Property-Panel für Werte
- Diagnoseansicht für Constraint-Verletzungen
- Prompt-/Info-Erklärung pro Attribut oder Werttyp

### Farbidee für Werttypen
- `minSize`: rot
- `maxSize`: grün
- `defaultSize`: blau
- `currentSize`: weiß
- `adaptSize`: gelb
- `previousSize`: orange

---

## 15. UX-Prinzipien

Die andere App soll sich an folgenden UX-Regeln orientieren:

1. **Kontrolliert statt chaotisch**
2. **Werkzeugcharakter statt Dekocharakter**
3. **Sichtbarer Systemzustand** statt versteckter Logik
4. **Panels und Fenster als organisierbare Arbeitsfläche**
5. **Konsistente Interaktionssprache** für Buttons, Handles, Toggles und Statusanzeigen
6. **Persistenz** als natürlicher Teil der UI
7. **Erklärbarkeit im Dev-Modus** statt Blackbox-Verhalten

---

## 16. Konkrete Übernahme in die andere App

Wenn diese Datei in einer anderen App verwendet wird, soll sie dort zu folgenden Entscheidungen führen:

### Übernehmen
- modulare Shell
- dunkler Tool-/Workspace-Look
- state-getriebener Fensterzustand
- Panels und Fenster mit Constraint-Regeln
- Drag/Resize/Collapse/Expand/Snap
- Developer-Overlay / Diagnosefähigkeit

### Nicht übernehmen
- rein zufällige freie Größenänderungen
- DOM-first ohne State-Architektur
- inkonsistente Komponentenoptik
- nicht erklärbares Resize-Verhalten
- verdeckte Überlappung/Overflow als Standard

---

## 17. Umsetzungshinweis für einen anderen Entwicklerchat oder eine andere App

Diese Datei kann direkt als Arbeitsgrundlage verwendet werden.

### Arbeitsauftrag
Nutze diese Spezifikation, um die UI einer anderen App so neu zu definieren, dass sie:
- als modulare Fenster-/Panel-Oberfläche funktioniert
- einen zentralen zustandsgetriebenen Layout-Kern besitzt
- dunkle professionelle Tool-Ästhetik verwendet
- Resize-/Snap-/Collapse-/Expand-Regeln explizit einhält
- Developer-Diagnostik und spätere Erweiterbarkeit unterstützt

### Erwartetes Ergebnis
Die andere App soll nicht bloß „ähnlich aussehen“, sondern dieselbe **Denkrichtung** übernehmen:
- **Fenster als logische Einheiten**
- **UI als regelbasiertes System**
- **State, Constraint, Render getrennt**
- **Visuelle und funktionale Ordnung**

---

## 18. Kurzfassung in einem Satz

Die UI soll als **modulares, dunkles, zustandsgetriebenes Workspace-System mit regelbasierten Fenstern, Panels, Snap-, Resize-, Collapse- und Diagnosefähigkeiten** neu definiert werden.
