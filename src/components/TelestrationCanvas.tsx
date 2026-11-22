import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  CanvasZeichnung,
  NormPunkt,
  ZeichenWerkzeug,
  ZeichnungsTyp,
} from '../types.ts';

interface TelestrationCanvasProps {
  zeichnungen: CanvasZeichnung[];
  aktivesWerkzeug: ZeichenWerkzeug | null;
  aktiveFarbe: string;
  bearbeitbar: boolean;
  ausgewaehlteId: string | null;
  onAuswaehlen: (id: string | null) => void;
  onZeichnungHinzufuegen: (
    zeichnung: Omit<CanvasZeichnung, 'id' | 'angle' | 'timestamp_ms' | 'status'>
  ) => void;
  onZeichnungAktualisieren: (id: string, punkte: NormPunkt[]) => void;
  textPlaceholder?: string;
}

const VB_BREITE = 1000;
const VB_HOEHE = 562.5;

type DragModus =
  | { typ: 'neu'; werkzeug: ZeichnungsTyp; punkte: NormPunkt[] }
  | { typ: 'punkt'; id: string; punktIndex: number; original: NormPunkt[] }
  | { typ: 'verschieben'; id: string; startMaus: NormPunkt; original: NormPunkt[] };

function klemme01(v: number): number {
  return Number(Math.max(0, Math.min(1, v)).toFixed(4));
}

function zuSvgX(normX: number): number {
  return Math.round(normX * VB_BREITE * 10) / 10;
}

function zuSvgY(normY: number): number {
  return Math.round(normY * VB_HOEHE * 10) / 10;
}

function berechneRadius(punkte: NormPunkt[]): number {
  if (punkte.length < 2) return 48;
  const dx = (punkte[1].x - punkte[0].x) * VB_BREITE;
  const dy = (punkte[1].y - punkte[0].y) * VB_HOEHE;
  return Math.max(24, Math.min(200, Math.hypot(dx, dy)));
}

export function TelestrationCanvas({
  zeichnungen,
  aktivesWerkzeug,
  aktiveFarbe,
  bearbeitbar,
  ausgewaehlteId,
  onAuswaehlen,
  onZeichnungHinzufuegen,
  onZeichnungAktualisieren,
  textPlaceholder = 'Text...',
}: TelestrationCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragModus | null>(null);
  const [textPosition, setTextPosition] = useState<NormPunkt | null>(null);
  const [textEingabe, setTextEingabe] = useState('');

  const leseNormPunkt = (e: ReactPointerEvent<SVGElement>): NormPunkt | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: klemme01((e.clientX - rect.left) / rect.width),
      y: klemme01((e.clientY - rect.top) / rect.height),
    };
  };

  const handleSvgPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!bearbeitbar) return;

    // Klick auf freien Hintergrund hebt Auswahl auf
    if (aktivesWerkzeug === 'select' || !aktivesWerkzeug) {
      onAuswaehlen(null);
      return;
    }

    const punkt = leseNormPunkt(e);
    if (!punkt) return;

    onAuswaehlen(null);

    if (aktivesWerkzeug === 'text') {
      setTextPosition(punkt);
      setTextEingabe('');
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ typ: 'neu', werkzeug: aktivesWerkzeug, punkte: [punkt] });
  };

  const starteObjektVerschieben = (
    e: ReactPointerEvent<SVGElement>,
    zeichnung: CanvasZeichnung
  ) => {
    if (!bearbeitbar || aktivesWerkzeug !== 'select') return;
    // Freihand-Zeichnungen bleiben bewusst unveränderbar
    if (zeichnung.werkzeug === 'pen') return;

    e.stopPropagation();
    const punkt = leseNormPunkt(e);
    if (!punkt) return;
    onAuswaehlen(zeichnung.id);
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      typ: 'verschieben',
      id: zeichnung.id,
      startMaus: punkt,
      original: zeichnung.punkte.map((p) => ({ ...p })),
    });
  };

  const startePunktZiehen = (
    e: ReactPointerEvent<SVGElement>,
    zeichnung: CanvasZeichnung,
    punktIndex: number
  ) => {
    if (!bearbeitbar || aktivesWerkzeug !== 'select') return;
    if (zeichnung.werkzeug === 'pen') return;

    e.stopPropagation();
    onAuswaehlen(zeichnung.id);
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      typ: 'punkt',
      id: zeichnung.id,
      punktIndex,
      original: zeichnung.punkte.map((p) => ({ ...p })),
    });
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const punkt = leseNormPunkt(e);
    if (!punkt) return;

    if (drag.typ === 'neu') {
      if (drag.werkzeug === 'pen') {
        const letzter = drag.punkte[drag.punkte.length - 1];
        if (Math.hypot(punkt.x - letzter.x, punkt.y - letzter.y) > 0.004) {
          setDrag({ ...drag, punkte: [...drag.punkte, punkt] });
        }
      } else {
        setDrag({ ...drag, punkte: [drag.punkte[0], punkt] });
      }
      return;
    }

    if (drag.typ === 'verschieben') {
      const dx = punkt.x - drag.startMaus.x;
      const dy = punkt.y - drag.startMaus.y;
      const verschoben = drag.original.map((p) => ({
        x: klemme01(p.x + dx),
        y: klemme01(p.y + dy),
      }));
      onZeichnungAktualisieren(drag.id, verschoben);
      return;
    }

    if (drag.typ === 'punkt') {
      const neu = drag.original.map((p, idx) => (idx === drag.punktIndex ? punkt : { ...p }));
      onZeichnungAktualisieren(drag.id, neu);
    }
  };

  const handlePointerUp = () => {
    if (!drag) return;

    if (drag.typ === 'neu') {
      const hatBewegung =
        drag.punkte.length >= 2 &&
        Math.hypot(
          drag.punkte[drag.punkte.length - 1].x - drag.punkte[0].x,
          drag.punkte[drag.punkte.length - 1].y - drag.punkte[0].y
        ) > 0.01;

      if (hatBewegung || drag.werkzeug === 'spotlight') {
        const finalePunkte =
          drag.punkte.length === 1
            ? [
                drag.punkte[0],
                { x: klemme01(drag.punkte[0].x + 0.055), y: drag.punkte[0].y },
              ]
            : drag.punkte;
        onZeichnungHinzufuegen({
          werkzeug: drag.werkzeug,
          farbe: aktiveFarbe,
          punkte: finalePunkte,
        });
      }
    }

    setDrag(null);
  };

  const handleTextBestaetigen = () => {
    if (textPosition && textEingabe.trim()) {
      onZeichnungHinzufuegen({
        werkzeug: 'text',
        farbe: aktiveFarbe,
        punkte: [textPosition],
        text: textEingabe.trim(),
      });
    }
    setTextPosition(null);
    setTextEingabe('');
  };

  const vorschauObjekt =
    drag?.typ === 'neu'
      ? {
          id: 'preview-stroke',
          angle: '',
          timestamp_ms: 0,
          status: 'DRAFT' as const,
          werkzeug: drag.werkzeug,
          farbe: aktiveFarbe,
          punkte: drag.punkte,
        }
      : null;

  const alleObjekte: CanvasZeichnung[] = vorschauObjekt
    ? [...zeichnungen, vorschauObjekt]
    : zeichnungen;

  const spotlights = alleObjekte.filter((z) => z.werkzeug === 'spotlight' && z.punkte.length >= 1);
  const istAuswahlModus = bearbeitbar && aktivesWerkzeug === 'select';

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_BREITE} ${VB_HOEHE}`}
        preserveAspectRatio="none"
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`h-full w-full touch-none ${
          bearbeitbar && aktivesWerkzeug
            ? aktivesWerkzeug === 'select'
              ? 'pointer-events-auto cursor-default'
              : 'pointer-events-auto cursor-crosshair'
            : 'pointer-events-none'
        }`}
      >
        <defs>
          {Array.from(new Set(alleObjekte.map((z) => z.farbe))).map((farbe) => {
            const markerId = `arrow-${farbe.replace('#', '')}`;
            return (
              <marker
                key={markerId}
                id={markerId}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill={farbe} />
              </marker>
            );
          })}

          {spotlights.length > 0 && (
            <mask id="sideline-spotlight-mask">
              <rect x="0" y="0" width={VB_BREITE} height={VB_HOEHE} fill="white" />
              {spotlights.map((spot) => (
                <circle
                  key={`mask-${spot.id}`}
                  cx={zuSvgX(spot.punkte[0].x)}
                  cy={zuSvgY(spot.punkte[0].y)}
                  r={berechneRadius(spot.punkte)}
                  fill="black"
                />
              ))}
            </mask>
          )}
        </defs>

        {spotlights.length > 0 && (
          <rect
            x="0"
            y="0"
            width={VB_BREITE}
            height={VB_HOEHE}
            fill="rgba(0, 0, 0, 0.56)"
            mask="url(#sideline-spotlight-mask)"
            className="pointer-events-none"
          />
        )}

        {alleObjekte.map((z) => {
          const selektiert = z.id === ausgewaehlteId && istAuswahlModus;

          if (z.werkzeug === 'spotlight' && z.punkte.length >= 1) {
            const cx = zuSvgX(z.punkte[0].x);
            const cy = zuSvgY(z.punkte[0].y);
            const r = berechneRadius(z.punkte);
            const randPunkt =
              z.punkte.length >= 2
                ? { x: zuSvgX(z.punkte[1].x), y: zuSvgY(z.punkte[1].y) }
                : { x: cx + r, y: cy };

            return (
              <g key={z.id}>
                {/* Unsichtbare Greiffläche im Inneren zum Verschieben */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="transparent"
                  stroke={z.farbe}
                  strokeWidth={selektiert ? '4.5' : '3.5'}
                  strokeDasharray="8 4"
                  onPointerDown={(e) => starteObjektVerschieben(e, z)}
                  className={istAuswahlModus ? 'cursor-move' : ''}
                />
                {selektiert && (
                  <>
                    {/* Mittelpunkt-Handle (Verschieben) */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="7"
                      fill="#0B0E11"
                      stroke="#F59E0B"
                      strokeWidth="2.5"
                      onPointerDown={(e) => starteObjektVerschieben(e, z)}
                      className="cursor-move"
                    />
                    {/* Radius-Handle (Größe ändern) */}
                    <circle
                      cx={randPunkt.x}
                      cy={randPunkt.y}
                      r="7"
                      fill="#F59E0B"
                      stroke="#0B0E11"
                      strokeWidth="2"
                      onPointerDown={(e) => startePunktZiehen(e, z, 1)}
                      className="cursor-ew-resize"
                    />
                  </>
                )}
              </g>
            );
          }

          if (z.werkzeug === 'pen' && z.punkte.length >= 2) {
            const pointsAttr = z.punkte.map((p) => `${zuSvgX(p.x)},${zuSvgY(p.y)}`).join(' ');
            return (
              <polyline
                key={z.id}
                points={pointsAttr}
                fill="none"
                stroke={z.farbe}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none"
              />
            );
          }

          if (z.werkzeug === 'arrow' && z.punkte.length >= 2) {
            const start = z.punkte[0];
            const ende = z.punkte[z.punkte.length - 1];
            const markerId = `arrow-${z.farbe.replace('#', '')}`;
            return (
              <g key={z.id}>
                {/* Breite Trefferzone auf dem Pfeilschaft zum Gesamt-Verschieben */}
                <line
                  x1={zuSvgX(start.x)}
                  y1={zuSvgY(start.y)}
                  x2={zuSvgX(ende.x)}
                  y2={zuSvgY(ende.y)}
                  stroke="transparent"
                  strokeWidth="20"
                  onPointerDown={(e) => starteObjektVerschieben(e, z)}
                  className={istAuswahlModus ? 'cursor-move' : ''}
                />
                <line
                  x1={zuSvgX(start.x)}
                  y1={zuSvgY(start.y)}
                  x2={zuSvgX(ende.x)}
                  y2={zuSvgY(ende.y)}
                  stroke={z.farbe}
                  strokeWidth={selektiert ? '5.5' : '4.5'}
                  strokeLinecap="round"
                  markerEnd={`url(#${markerId})`}
                  className="pointer-events-none"
                />
                {selektiert && (
                  <>
                    <circle
                      cx={zuSvgX(start.x)}
                      cy={zuSvgY(start.y)}
                      r="7.5"
                      fill="#0B0E11"
                      stroke="#F59E0B"
                      strokeWidth="2.5"
                      onPointerDown={(e) => startePunktZiehen(e, z, 0)}
                      className="cursor-grab"
                    />
                    <circle
                      cx={zuSvgX(ende.x)}
                      cy={zuSvgY(ende.y)}
                      r="7.5"
                      fill="#F59E0B"
                      stroke="#0B0E11"
                      strokeWidth="2"
                      onPointerDown={(e) => startePunktZiehen(e, z, z.punkte.length - 1)}
                      className="cursor-grab"
                    />
                  </>
                )}
              </g>
            );
          }

          if (z.werkzeug === 'text' && z.punkte.length >= 1 && z.text) {
            const x = zuSvgX(z.punkte[0].x);
            const y = zuSvgY(z.punkte[0].y);
            const breite = Math.max(84, z.text.length * 10.5 + 22);
            return (
              <g
                key={z.id}
                transform={`translate(${x}, ${y})`}
                onPointerDown={(e) => starteObjektVerschieben(e, z)}
                className={istAuswahlModus ? 'cursor-move' : ''}
              >
                <rect
                  x="-6"
                  y="-22"
                  width={breite}
                  height="30"
                  rx="4"
                  fill="rgba(11, 14, 17, 0.9)"
                  stroke={selektiert ? '#F59E0B' : z.farbe}
                  strokeWidth={selektiert ? '2.5' : '1.5'}
                />
                <text
                  x="6"
                  y="-2"
                  fill="#FFFFFF"
                  fontSize="16"
                  fontWeight="600"
                  fontFamily="DM Sans, sans-serif"
                  className="select-none"
                >
                  {z.text}
                </text>
              </g>
            );
          }

          return null;
        })}
      </svg>

      {textPosition && bearbeitbar && (
        <div
          style={{
            left: `${Math.min(72, Math.max(4, textPosition.x * 100))}%`,
            top: `${Math.min(82, Math.max(6, textPosition.y * 100))}%`,
          }}
          className="pointer-events-auto absolute z-20 flex items-center gap-1.5 rounded-md border border-[#F59E0B] bg-[#0B0E11]/95 p-1.5 shadow-lg"
        >
          <input
            type="text"
            autoFocus
            value={textEingabe}
            onChange={(e) => setTextEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextBestaetigen();
              if (e.key === 'Escape') setTextPosition(null);
            }}
            placeholder={textPlaceholder}
            className="w-40 bg-transparent px-1.5 py-0.5 text-xs text-white placeholder-[#6E7681] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleTextBestaetigen}
            className="rounded bg-[#F59E0B] px-2 py-0.5 text-[11px] font-semibold text-[#0B0E11]"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
