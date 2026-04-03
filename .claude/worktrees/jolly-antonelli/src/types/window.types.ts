/**
 * KONZEPT-HANDBUCH – Constraint-basiertes Fenster- und Resize-System
 * Datenmodell (Abschnitt 4 + 5)
 * Version: 1.0  |  Stand: 02.04.2026
 */

// ---------------------------------------------------------------------------
// Primitive Hilfstypen
// ---------------------------------------------------------------------------

/** Breite und Höhe in Pixel. */
export interface Size {
  width: number;
  height: number;
}

/** Position relativ zum Parent-Container in Pixel. */
export interface Position {
  x: number;
  y: number;
}

/** Vollständiger Bereich eines Fensters (Position + Größe). */
export interface Bounds extends Position, Size {}

// ---------------------------------------------------------------------------
// Enum-Typen
// ---------------------------------------------------------------------------

/**
 * Sichtbarkeits-Policy (Abschnitt 9).
 * noOverflow  – Child darf den sichtbaren Parent-Bereich nie verlassen (Default).
 * allowOverflowWithScroll – Überhang erlaubt; Parent aktiviert ScrollContainer.
 */
export type VisibilityPolicy = "noOverflow" | "allowOverflowWithScroll";

/**
 * Resize-Policy (Abschnitt 6.2).
 * fixed        – Fenstergröße ändert sich bei Parent-Resize nicht.
 * flexible     – Fenstergröße passt sich proportional an.
 * proportional – Seitenverhältnis bleibt konstant (keepAspectRatio).
 */
export type ResizePolicy = "fixed" | "flexible" | "proportional";

/**
 * Snap-Policy (Abschnitt 8).
 * enabled  – Kanten rasten in Nachbarkanten ein.
 * disabled – Freies Positionieren ohne Einrastung.
 */
export type SnapPolicy = "enabled" | "disabled";

/**
 * Kante eines Containers (Abschnitt 5.3).
 */
export type Edge = "left" | "right" | "top" | "bottom";

/**
 * Resize-Handle – welche Kante/Ecke der Nutzer zieht.
 */
export type ResizeHandle =
  | Edge
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

// ---------------------------------------------------------------------------
// Kern-Datenmodell: WindowNode (Abschnitt 4)
// ---------------------------------------------------------------------------

/**
 * Vollständiges Datenmodell eines Window-Knotens im LayoutTree.
 *
 * Pflichtattribute gemäß Abschnitt 4.1:
 *  - id, name, parentId
 *  - bounds (aktuelle Position + Größe)
 *  - minSize, maxSize, defaultSize, currentSize, adaptSize, previousSize
 *  - visibilityPolicy, resizePolicy, snapPolicy
 *  - metadata
 */
export interface WindowNode {
  /** Eindeutige, unveränderliche ID, z. B. "window.chat". */
  id: string;

  /** Lesbarer technischer Name, z. B. "ChatPanel". */
  name: string;

  /**
   * ID des übergeordneten Fensters.
   * Null nur für das AppWindow (Root-Container).
   */
  parentId: string | null;

  /**
   * Aktueller Bereich des Fensters (Position + Größe) relativ zum Parent.
   * Wird bei jedem Commit der ConstraintEngine aktualisiert.
   */
  bounds: Bounds;

  // -------------------------------------------------------------------------
  // Größenwerte (Abschnitt 4.1, Punkte 5–10)
  // -------------------------------------------------------------------------

  /**
   * Mindestgröße – darf durch keine Operation unterschritten werden.
   * (MUSS-Regel 2, Abschnitt 3.1)
   */
  minSize: Size;

  /**
   * Maximalgröße – darf durch keine Operation überschritten werden.
   * Schließt die Beschränkung durch den Parent ein (MUSS-Regel 1).
   */
  maxSize: Size;

  /**
   * Standardgröße – Startwert beim Neustart der App.
   * Dev-Modus-Farbcode: blau.
   */
  defaultSize: Size;

  /**
   * Ist-Größe – aktuelle, ggf. durch den Nutzer veränderte Größe.
   * Dev-Modus-Farbcode: weiß.
   */
  currentSize: Size;

  /**
   * Anpassgröße (adaptSize) – Sonderwert für kontextabhängige Aktionen.
   * Beispiel: Expand richtet sich an adaptSize aus, wenn
   * Parent.currentSize > Parent.defaultSize.
   * Dev-Modus-Farbcode: gelb.
   */
  adaptSize: Size;

  /**
   * Zuvor-Größe (previousSize) – Wert vor der letzten Größenänderung.
   * Wird beim Collapse/Expand zur Wiederherstellung genutzt.
   * Dev-Modus-Farbcode: orange.
   */
  previousSize: Size;

  // -------------------------------------------------------------------------
  // Policies (Abschnitt 4.1, Punkte 11–13)
  // -------------------------------------------------------------------------

  /** Regelt, ob Children den sichtbaren Bereich verlassen dürfen. */
  visibilityPolicy: VisibilityPolicy;

  /** Bestimmt, wie das Window auf Parent-Resize-Ereignisse reagiert. */
  resizePolicy: ResizePolicy;

  /** Aktiviert oder deaktiviert das Einrasten an benachbarten Kanten. */
  snapPolicy: SnapPolicy;

  // -------------------------------------------------------------------------
  // Erweiterungsfelder
  // -------------------------------------------------------------------------

  /**
   * Freie Zusatzinfos (z. B. Dev-Overlay-Einstellungen, Feature-Flags).
   * Wird nie von der ConstraintEngine ausgewertet.
   */
  metadata: WindowMetadata;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * Freie Erweiterungsdaten eines WindowNode.
 * Alle Felder sind optional; neue Felder können hinzugefügt werden,
 * ohne das Kernmodell zu ändern.
 */
export interface WindowMetadata {
  /** Zeigt das Dev-Label (Name + ID) unten rechts am Fenster an. */
  devLabelVisible?: boolean;

  /** Zusätzliche frei wählbare Schlüssel-Wert-Paare. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// LayoutTree (Abschnitt 11.1, Modul 1)
// ---------------------------------------------------------------------------

/**
 * Repräsentiert den gesamten Baum aller Window-Knoten.
 * Einstiegspunkt für ConstraintEngine und ResizeController.
 */
export interface LayoutTree {
  /** ID des Root-Knotens (AppWindow). */
  rootId: string;

  /** Flache Map aller Knoten für O(1)-Zugriff per ID. */
  nodes: Map<string, WindowNode>;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen (reine Typen-Guards)
// ---------------------------------------------------------------------------

/** Prüft, ob ein WindowNode der Root-AppWindow-Knoten ist. */
export function isRootWindow(node: WindowNode): boolean {
  return node.parentId === null;
}

/** Prüft, ob zwei Größen identisch sind. */
export function sizeEquals(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height;
}
