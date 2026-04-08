// ─────────────────────────────────────────────────────────────
// pptxGenerator.js — Generador PPTX para Aura Core
// Usa PptxGenJS via CDN (cargado dinámicamente en el browser)
// Genera cuadro sinóptico, mapa conceptual o mapa mental
// ─────────────────────────────────────────────────────────────

// Carga PptxGenJS dinámicamente si no está disponible
const cargarPptxGen = () =>
  new Promise((resolve, reject) => {
    if (window.PptxGenJS) { resolve(window.PptxGenJS); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
    script.onload  = () => resolve(window.PptxGenJS);
    script.onerror = () => reject(new Error('No se pudo cargar PptxGenJS'));
    document.head.appendChild(script);
  });

// ─────────────────────────────────────────────────────────────
// PALETA — Midnight Executive adaptada para educación
// ─────────────────────────────────────────────────────────────
const P = {
  navy:     '0D1B3E',
  blue:     '1A56DB',
  blueLight:'3B82F6',
  cyan:     '0EA5E9',
  green:    '10B981',
  amber:    'F59E0B',
  red:      'EF4444',
  white:    'FFFFFF',
  offWhite: 'F1F5F9',
  gray:     '94A3B8',
  grayDark: '475569',
  dark:     '0F172A',
};

// ─────────────────────────────────────────────────────────────
// SLIDE PORTADA — igual para los 3 tipos
// ─────────────────────────────────────────────────────────────
const agregarPortada = (pres, { cierreData, grupo, escuela, totalAlumnos, promedioGrupo, tipoLabel }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.navy };

  // Franja superior decorativa
  slide.addShape("rect", {
    x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.blue },
  });

  // Franja de acento lateral izquierda
  slide.addShape("rect", {
    x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: P.cyan },
  });

  // Etiqueta tipo de esquema
  slide.addShape("rect", {
    x: 0.5, y: 0.4, w: 2.8, h: 0.36,
    fill: { color: P.blue }, line: { color: P.blue },
  });
  slide.addText(tipoLabel.toUpperCase(), {
    x: 0.5, y: 0.4, w: 2.8, h: 0.36,
    fontSize: 9, bold: true, color: P.white,
    align: 'center', valign: 'middle', margin: 0,
    charSpacing: 3,
  });

  // Título del tema
  slide.addText(cierreData.temaCentral, {
    x: 0.5, y: 1.0, w: 9, h: 1.6,
    fontSize: 36, bold: true, color: P.white,
    fontFace: 'Calibri', align: 'left', valign: 'middle',
  });

  // Subtítulo
  slide.addText(`Grupo ${grupo} — ${escuela}`, {
    x: 0.5, y: 2.7, w: 7, h: 0.4,
    fontSize: 14, color: P.gray, fontFace: 'Calibri', align: 'left',
  });

  // Métricas en la parte inferior
  const metricas = [
    { label: 'Alumnos', valor: String(totalAlumnos) },
    { label: 'Promedio', valor: `${promedioGrupo}/10` },
    { label: 'Sesión', valor: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) },
  ];
  metricas.forEach((m, i) => {
    const x = 0.5 + i * 3.0;
    slide.addShape("rect", {
      x, y: 4.0, w: 2.6, h: 1.0,
      fill: { color: '1E2A4A' }, line: { color: P.blue, width: 1 },
    });
    slide.addText(m.valor, {
      x, y: 4.0, w: 2.6, h: 0.55,
      fontSize: 22, bold: true, color: P.cyan,
      fontFace: 'Calibri', align: 'center', valign: 'bottom', margin: 0,
    });
    slide.addText(m.label, {
      x, y: 4.55, w: 2.6, h: 0.4,
      fontSize: 10, color: P.gray, fontFace: 'Calibri',
      align: 'center', charSpacing: 2,
    });
  });

  // Logo Aura Core
  slide.addText('AURA CORE', {
    x: 7.5, y: 4.9, w: 2.3, h: 0.35,
    fontSize: 9, color: P.blue, bold: true,
    fontFace: 'Calibri', align: 'right', charSpacing: 4,
  });
};

// ─────────────────────────────────────────────────────────────
// SLIDE CONCEPTOS CLAVE
// ─────────────────────────────────────────────────────────────
const agregarConceptos = (pres, { cierreData }) => {
  const conceptos = cierreData.conceptosClave || [];
  // Si hay resúmenes, cada concepto necesita su propia slide
  const tieneResumenes = conceptos.length > 0 && typeof conceptos[0] === 'object' && conceptos[0].resumen;

  if (tieneResumenes) {
    // Una slide por cada 2 conceptos para dar espacio al resumen
    for (let par = 0; par < Math.ceil(conceptos.length / 2); par++) {
      const slide = pres.addSlide();
      slide.background = { color: P.dark };
      slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.cyan } });
      slide.addText(par === 0 ? 'Conceptos clave de la sesión' : 'Conceptos clave (continuación)', {
        x: 0.5, y: 0.18, w: 9, h: 0.4, fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri',
      });

      const colores = [P.blue, P.cyan, P.green, P.amber, P.blueLight];
      [0, 1].forEach(idx => {
        const ci = par * 2 + idx;
        if (ci >= conceptos.length) return;
        const c = conceptos[ci];
        const nombre  = c.concepto || c;
        const resumen = c.resumen || '';
        const color   = colores[ci % colores.length];
        const y       = 0.75 + idx * 2.3;

        slide.addShape("rect", { x: 0.4, y, w: 9.2, h: 2.0, fill: { color: '1A2744' }, line: { color, width: 2 } });
        slide.addShape("rect", { x: 0.4, y, w: 0.07, h: 2.0, fill: { color } });
        slide.addText(nombre, { x: 0.6, y: y + 0.08, w: 8.8, h: 0.38, fontSize: 14, bold: true, color, fontFace: 'Calibri', align: 'left' });
        if (resumen) {
          slide.addText(resumen, { x: 0.6, y: y + 0.5, w: 8.8, h: 1.4, fontSize: 11, color: P.offWhite, fontFace: 'Calibri', align: 'left', lineSpacingMultiple: 1.3 });
        }
      });
    }
  } else {
    // Versión simple sin resúmenes
    const slide = pres.addSlide();
    slide.background = { color: P.dark };
    slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.cyan } });
    slide.addText('Conceptos clave de la sesión', { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 22, bold: true, color: P.white, fontFace: 'Calibri' });
    const colores = [P.blue, P.cyan, P.green, P.amber, P.blueLight];
    conceptos.slice(0, 5).forEach((c, i) => {
      const nombre = typeof c === 'string' ? c : c.concepto;
      const col = i < 3 ? 0 : 1; const fila = i < 3 ? i : i - 3;
      const x = 0.4 + col * 5.0; const y = 1.0 + fila * 1.3;
      const color = colores[i % colores.length];
      slide.addShape("rect", { x, y, w: 4.5, h: 1.1, fill: { color: '1A2744' }, line: { color, width: 2 } });
      slide.addShape("rect", { x, y, w: 0.07, h: 1.1, fill: { color } });
      slide.addText(nombre, { x: x + 0.15, y, w: 4.2, h: 1.1, fontSize: 14, color: P.white, fontFace: 'Calibri', align: 'left', valign: 'middle' });
    });
  }
};

// ─────────────────────────────────────────────────────────────
// SLIDE CUADRO SINÓPTICO
// ─────────────────────────────────────────────────────────────
const agregarCuadroSinoptico = (pres, { cierreData }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.blue } });

  slide.addText('Cuadro sinóptico', {
    x: 0.4, y: 0.18, w: 9, h: 0.45,
    fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri',
  });

  const { titulo, ramas = [] } = cierreData.esquemaSinoptico || {};

  // Nodo raíz
  slide.addShape("rect", {
    x: 0.3, y: 0.85, w: 2.4, h: 3.8,
    fill: { color: P.blue }, line: { color: P.blue },
  });
  slide.addText(titulo || cierreData.temaCentral, {
    x: 0.3, y: 0.85, w: 2.4, h: 3.8,
    fontSize: 13, bold: true, color: P.white, fontFace: 'Calibri',
    align: 'center', valign: 'middle',
  });

  // Conector horizontal principal
  slide.addShape("rect", {
    x: 2.7, y: 2.6, w: 0.4, h: 0.06, fill: { color: P.gray },
  });

  // Ramas
  const alturaTotal = ramas.length > 0 ? (ramas.length - 1) * 1.3 : 0;
  const yBase       = 2.6 - alturaTotal / 2;
  const coloresRama = [P.cyan, P.green, P.amber];

  ramas.slice(0, 3).forEach((rama, i) => {
    const yRama  = yBase + i * 1.3;
    const color  = coloresRama[i % coloresRama.length];

    // Línea vertical conectora
    if (i < ramas.length - 1) {
      slide.addShape("rect", {
        x: 3.1, y: yRama + 0.3, w: 0.06, h: 1.3,
        fill: { color: P.gray },
      });
    }
    // Línea horizontal
    slide.addShape("rect", {
      x: 3.1, y: yRama + 0.26, w: 0.45, h: 0.06, fill: { color: P.gray },
    });

    // Caja rama
    slide.addShape("rect", {
      x: 3.55, y: yRama, w: 2.2, h: 0.55,
      fill: { color: '1A2744' }, line: { color, width: 2 },
    });
    slide.addText(rama.titulo, {
      x: 3.55, y: yRama, w: 2.2, h: 0.55,
      fontSize: 11, bold: true, color, fontFace: 'Calibri',
      align: 'center', valign: 'middle',
    });

    // Subramas
    (rama.subramas || []).slice(0, 3).forEach((sub, j) => {
      const ySub = yRama - 0.05 + j * 0.5;
      slide.addShape("rect", {
        x: 6.1, y: ySub + 0.05, w: 3.4, h: 0.38,
        fill: { color: '0F1A2E' }, line: { color: P.grayDark, width: 1 },
      });
      slide.addText(sub, {
        x: 6.15, y: ySub + 0.05, w: 3.3, h: 0.38,
        fontSize: 10, color: P.offWhite, fontFace: 'Calibri',
        align: 'left', valign: 'middle',
      });
      // Conector subrama
      slide.addShape("rect", {
        x: 5.75, y: ySub + 0.22, w: 0.35, h: 0.04, fill: { color: P.grayDark },
      });
    });
  });
};

// ─────────────────────────────────────────────────────────────
// SLIDE MAPA CONCEPTUAL
// ─────────────────────────────────────────────────────────────
const agregarMapaConceptual = (pres, { cierreData }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.green } });

  slide.addText('Mapa conceptual', {
    x: 0.4, y: 0.18, w: 9, h: 0.45,
    fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri',
  });

  const { conceptoCentral, relaciones = [] } = cierreData.mapaConceptual || {};

  // Nodo central
  slide.addShape("rect", {
    x: 3.5, y: 1.1, w: 3.0, h: 0.7,
    fill: { color: P.green }, line: { color: P.green },
  });
  slide.addText(conceptoCentral || cierreData.temaCentral, {
    x: 3.5, y: 1.1, w: 3.0, h: 0.7,
    fontSize: 13, bold: true, color: P.white, fontFace: 'Calibri',
    align: 'center', valign: 'middle',
  });

  // Relaciones — distribuidas alrededor del nodo central
  const posiciones = [
    { x: 0.3, y: 2.2 }, { x: 6.8, y: 2.2 },
    { x: 0.3, y: 3.8 }, { x: 6.8, y: 3.8 },
    { x: 3.5, y: 4.5 },
  ];

  relaciones.slice(0, 5).forEach((rel, i) => {
    const pos   = posiciones[i];
    if (!pos) return;
    const color = [P.cyan, P.amber, P.blueLight, P.green, P.blue][i % 5];

    // Caja destino
    slide.addShape("rect", {
      x: pos.x, y: pos.y, w: 2.8, h: 0.6,
      fill: { color: '1A2744' }, line: { color, width: 2 },
    });
    slide.addText(rel.hacia, {
      x: pos.x, y: pos.y, w: 2.8, h: 0.6,
      fontSize: 11, color: P.white, fontFace: 'Calibri',
      align: 'center', valign: 'middle',
    });

    // Etiqueta conector
    slide.addText(rel.conector, {
      x: pos.x, y: pos.y - 0.28, w: 2.8, h: 0.26,
      fontSize: 9, color, fontFace: 'Calibri',
      align: 'center', italic: true,
    });
  });
};

// ─────────────────────────────────────────────────────────────
// SLIDE MAPA MENTAL
// ─────────────────────────────────────────────────────────────
const agregarMapaMental = (pres, { cierreData }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.amber } });

  slide.addText('Mapa mental', {
    x: 0.4, y: 0.18, w: 9, h: 0.45,
    fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri',
  });

  // Círculo central
  slide.addShape("ellipse", {
    x: 3.6, y: 2.0, w: 2.8, h: 1.5,
    fill: { color: P.amber }, line: { color: P.amber },
  });
  slide.addText(cierreData.temaCentral, {
    x: 3.6, y: 2.0, w: 2.8, h: 1.5,
    fontSize: 12, bold: true, color: P.dark, fontFace: 'Calibri',
    align: 'center', valign: 'middle',
  });

  const conceptos = cierreData.conceptosClave || [];
  const colores   = [P.cyan, P.green, P.blue, P.blueLight, P.red];
  const posRadial = [
    { x: 0.4,  y: 0.8  }, { x: 7.0, y: 0.8  },
    { x: 0.4,  y: 3.5  }, { x: 7.0, y: 3.5  },
    { x: 3.8,  y: 4.7  },
  ];

  conceptos.slice(0, 5).forEach((c, i) => {
    const pos   = posRadial[i];
    const color = colores[i % colores.length];

    slide.addShape("ellipse", {
      x: pos.x, y: pos.y, w: 2.4, h: 0.75,
      fill: { color: '1A2744' }, line: { color, width: 2 },
    });
    slide.addText(c, {
      x: pos.x, y: pos.y, w: 2.4, h: 0.75,
      fontSize: 11, color: P.white, fontFace: 'Calibri',
      align: 'center', valign: 'middle',
    });
  });
};

// ─────────────────────────────────────────────────────────────
// SLIDE PREGUNTAS DE REPASO
// ─────────────────────────────────────────────────────────────
const agregarPreguntas = (pres, { cierreData }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.amber } });

  slide.addText('Preguntas de repaso', {
    x: 0.4, y: 0.18, w: 9, h: 0.45,
    fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri',
  });

  const preguntas = cierreData.preguntasRepaso || [];
  const coloresDif = { 'Básica': P.green, 'Media': P.amber, 'Avanzada': P.red };

  preguntas.slice(0, 5).forEach((p, i) => {
    const y     = 0.85 + i * 0.92;
    const color = coloresDif[p.dificultad] || P.blue;

    slide.addShape("rect", {
      x: 0.4, y, w: 9.2, h: 0.78,
      fill: { color: '1A2744' }, line: { color, width: 1 },
    });
    slide.addShape("rect", {
      x: 0.4, y, w: 0.07, h: 0.78, fill: { color },
    });
    slide.addText(`${i + 1}. ${p.pregunta}`, {
      x: 0.6, y: y + 0.02, w: 7.8, h: 0.56,
      fontSize: 11, color: P.white, fontFace: 'Calibri',
      align: 'left', valign: 'middle',
    });
    slide.addText(p.dificultad, {
      x: 8.45, y: y + 0.18, w: 1.1, h: 0.35,
      fontSize: 9, color, fontFace: 'Calibri',
      align: 'center', bold: true,
    });
  });
};

// ─────────────────────────────────────────────────────────────
// SLIDE ACTIVIDAD DE CIERRE
// ─────────────────────────────────────────────────────────────
const agregarActividad = (pres, { cierreData, grupo }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.navy };

  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.green } });
  slide.addShape("rect", { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: P.green } });

  slide.addText('Actividad de cierre', {
    x: 0.5, y: 0.3, w: 9, h: 0.5,
    fontSize: 20, bold: true, color: P.white, fontFace: 'Calibri',
  });

  slide.addShape("rect", {
    x: 0.5, y: 1.0, w: 9.0, h: 3.0,
    fill: { color: '0D2218' }, line: { color: P.green, width: 2 },
  });
  slide.addText(cierreData.actividadCierre || '', {
    x: 0.7, y: 1.1, w: 8.6, h: 2.8,
    fontSize: 15, color: P.white, fontFace: 'Calibri',
    align: 'left', valign: 'middle', lineSpacingMultiple: 1.4,
  });

  slide.addText(`Grupo ${grupo}  ·  Aura Core`, {
    x: 0.5, y: 5.1, w: 9, h: 0.3,
    fontSize: 9, color: P.gray, fontFace: 'Calibri', align: 'right', charSpacing: 2,
  });
};

// Alias para las funciones existentes con nombres nuevos
const agregarSinopticoCompleto = (pres, { cierreData, esquema }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.blue } });
  slide.addText('Cuadro sinóptico', { x: 0.4, y: 0.18, w: 9, h: 0.45, fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri' });

  const titulo = esquema.titulo || cierreData.temaCentral;
  const ramas  = esquema.ramas || [];

  slide.addShape("rect", { x: 0.3, y: 0.85, w: 2.0, h: 4.2, fill: { color: P.blue }, line: { color: P.blue } });
  slide.addText(titulo, { x: 0.3, y: 0.85, w: 2.0, h: 4.2, fontSize: 11, bold: true, color: P.white, fontFace: 'Calibri', align: 'center', valign: 'middle' });

  const alturaTotal = (ramas.length - 1) * 1.35;
  const yBase = 2.95 - alturaTotal / 2;
  const coloresRama = [P.cyan, P.green, P.amber, P.blueLight, P.red];

  ramas.slice(0, 4).forEach((rama, i) => {
    const yRama = yBase + i * 1.35;
    const color = coloresRama[i % coloresRama.length];

    slide.addShape("rect", { x: 2.3, y: yRama + 0.28, w: 0.4, h: 0.06, fill: { color: P.gray } });
    slide.addShape("rect", { x: 2.7, y: yRama, w: 2.0, h: 0.65, fill: { color: '1A2744' }, line: { color, width: 2 } });
    slide.addText(rama.titulo, { x: 2.7, y: yRama, w: 2.0, h: 0.65, fontSize: 10, bold: true, color, fontFace: 'Calibri', align: 'center', valign: 'middle' });

    // Resumen de rama si existe
    if (rama.resumen) {
      slide.addText(rama.resumen, { x: 4.8, y: yRama - 0.05, w: 5.0, h: 0.75, fontSize: 9, color: P.offWhite, fontFace: 'Calibri', align: 'left', valign: 'middle' });
    } else if (rama.subramas) {
      (rama.subramas || []).slice(0, 2).forEach((sub, j) => {
        const detalle = typeof sub === 'string' ? sub : (sub.titulo + (sub.detalle ? ': ' + sub.detalle : ''));
        slide.addShape("rect", { x: 4.8, y: yRama + j * 0.38, w: 4.9, h: 0.33, fill: { color: '0F1A2E' }, line: { color: P.grayDark, width: 1 } });
        slide.addText(detalle, { x: 4.85, y: yRama + j * 0.38, w: 4.8, h: 0.33, fontSize: 9, color: P.offWhite, fontFace: 'Calibri', align: 'left', valign: 'middle' });
      });
    }
  });
};

const agregarConceptualCompleto = (pres, { cierreData, esquema }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.green } });
  slide.addText('Mapa conceptual', { x: 0.4, y: 0.18, w: 9, h: 0.45, fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri' });

  const central = esquema.conceptoCentral || cierreData.temaCentral;
  const nodos   = esquema.nodos || [];

  slide.addShape("rect", { x: 3.3, y: 0.85, w: 3.4, h: 0.8, fill: { color: P.green }, line: { color: P.green } });
  slide.addText(central, { x: 3.3, y: 0.85, w: 3.4, h: 0.8, fontSize: 12, bold: true, color: P.white, fontFace: 'Calibri', align: 'center', valign: 'middle' });

  const posiciones = [{ x: 0.3, y: 1.9 }, { x: 6.8, y: 1.9 }, { x: 0.3, y: 3.5 }, { x: 6.8, y: 3.5 }, { x: 3.5, y: 4.6 }];
  const colores    = [P.cyan, P.amber, P.blueLight, P.blue, P.red];

  nodos.slice(0, 5).forEach((n, i) => {
    const pos   = posiciones[i];
    const color = colores[i % colores.length];
    slide.addShape("rect", { x: pos.x, y: pos.y, w: 3.0, h: 0.55, fill: { color: '1A2744' }, line: { color, width: 2 } });
    slide.addText(n.concepto || n.hacia || '', { x: pos.x, y: pos.y, w: 3.0, h: 0.55, fontSize: 11, bold: true, color, fontFace: 'Calibri', align: 'center', valign: 'middle' });
    if (n.descripcion) {
      slide.addText(n.descripcion, { x: pos.x, y: pos.y + 0.58, w: 3.0, h: 0.7, fontSize: 9, color: P.offWhite, fontFace: 'Calibri', align: 'left', lineSpacingMultiple: 1.2 });
    }
    slide.addText(n.conector || '', { x: pos.x, y: pos.y - 0.28, w: 3.0, h: 0.25, fontSize: 8, color, fontFace: 'Calibri', align: 'center', italic: true });
  });
};

const agregarMentalCompleto = (pres, { cierreData, esquema }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.amber } });
  slide.addText('Mapa mental', { x: 0.4, y: 0.18, w: 9, h: 0.45, fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri' });

  const central = esquema.conceptoCentral || cierreData.temaCentral;
  const ramas   = esquema.ramas || [];

  slide.addShape("ellipse", { x: 3.6, y: 1.8, w: 2.8, h: 1.4, fill: { color: P.amber }, line: { color: P.amber } });
  slide.addText(central, { x: 3.6, y: 1.8, w: 2.8, h: 1.4, fontSize: 11, bold: true, color: P.dark, fontFace: 'Calibri', align: 'center', valign: 'middle' });

  const posRadial = [{ x: 0.2, y: 0.7 }, { x: 6.9, y: 0.7 }, { x: 0.2, y: 3.2 }, { x: 6.9, y: 3.2 }];
  const colores   = [P.cyan, P.green, P.blue, P.red];

  ramas.slice(0, 4).forEach((r, i) => {
    const pos   = posRadial[i];
    const color = colores[i % colores.length];
    slide.addShape("ellipse", { x: pos.x, y: pos.y, w: 2.7, h: 0.65, fill: { color: '1A2744' }, line: { color, width: 2 } });
    slide.addText(r.titulo, { x: pos.x, y: pos.y, w: 2.7, h: 0.65, fontSize: 11, bold: true, color, fontFace: 'Calibri', align: 'center', valign: 'middle' });
    if (r.detalle) {
      slide.addText(r.detalle, { x: pos.x, y: pos.y + 0.68, w: 2.7, h: 0.75, fontSize: 9, color: P.offWhite, fontFace: 'Calibri', align: 'center', lineSpacingMultiple: 1.2 });
    }
    if (r.palabrasClave?.length) {
      slide.addText(r.palabrasClave.join(' · '), { x: pos.x, y: pos.y - 0.28, w: 2.7, h: 0.25, fontSize: 8, color, fontFace: 'Calibri', align: 'center' });
    }
  });
};

const agregarCuadroIdeas = (pres, { cierreData, esquema }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.blueLight } });
  slide.addText('Cuadro de ideas principales', { x: 0.4, y: 0.18, w: 9, h: 0.45, fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri' });

  const ideas   = esquema.ideas || [];
  const colores = [P.blue, P.cyan, P.green, P.amber];

  ideas.slice(0, 4).forEach((idea, i) => {
    const y     = 0.8 + i * 1.18;
    const color = colores[i % colores.length];
    slide.addShape("rect", { x: 0.3, y, w: 9.4, h: 1.05, fill: { color: '1A2744' }, line: { color, width: 2 } });
    slide.addShape("rect", { x: 0.3, y, w: 0.07, h: 1.05, fill: { color } });
    slide.addText(idea.idea || '', { x: 0.5, y: y + 0.04, w: 3.0, h: 0.4, fontSize: 12, bold: true, color, fontFace: 'Calibri', align: 'left' });
    slide.addText(idea.explicacion || '', { x: 0.5, y: y + 0.44, w: 5.5, h: 0.55, fontSize: 9, color: P.offWhite, fontFace: 'Calibri', align: 'left' });
    if (idea.ejemplos?.length) {
      slide.addText('Ej: ' + idea.ejemplos.join(', '), { x: 6.1, y: y + 0.1, w: 3.4, h: 0.85, fontSize: 9, color: P.gray, fontFace: 'Calibri', align: 'left', italic: true });
    }
  });
};

const agregarCuadroComparativo = (pres, { cierreData, esquema }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.blueLight } });
  slide.addText('Cuadro comparativo', { x: 0.4, y: 0.18, w: 9, h: 0.45, fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri' });

  const criterios = esquema.criterios || [];
  const elementos = esquema.elementos || [];
  const conclusion = esquema.conclusion || '';

  if (criterios.length && elementos.length) {
    const tableData = [];
    // Header
    const header = [{ text: 'Elemento', options: { fill: { color: P.blue }, color: P.white, bold: true, fontSize: 10 } }];
    criterios.forEach(c => header.push({ text: c, options: { fill: { color: P.blue }, color: P.white, bold: true, fontSize: 10 } }));
    tableData.push(header);
    // Filas
    elementos.forEach((el, i) => {
      const row = [{ text: el.nombre, options: { fill: { color: '1A2744' }, color: P.cyan, bold: true, fontSize: 10 } }];
      (el.valores || []).forEach(v => row.push({ text: v, options: { fill: { color: i % 2 === 0 ? '0F1A2E' : '1A2744' }, color: P.offWhite, fontSize: 9 } }));
      tableData.push(row);
    });
    slide.addTable(tableData, { x: 0.3, y: 0.75, w: 9.4, h: 3.8, border: { pt: 1, color: P.blue } });
  }

  if (conclusion) {
    slide.addText('Conclusión: ' + conclusion, { x: 0.3, y: 4.7, w: 9.4, h: 0.7, fontSize: 11, color: P.amber, fontFace: 'Calibri', align: 'left', italic: true });
  }
};

const agregarAranaDidactica = (pres, { cierreData, esquema }) => {
  const slide = pres.addSlide();
  slide.background = { color: P.dark };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: P.cyan } });
  slide.addText('Araña didáctica', { x: 0.4, y: 0.18, w: 9, h: 0.45, fontSize: 18, bold: true, color: P.white, fontFace: 'Calibri' });

  const central = esquema.conceptoCentral || cierreData.temaCentral;
  const patas   = esquema.patas || [];

  // Cuerpo central
  slide.addShape("ellipse", { x: 3.5, y: 1.9, w: 3.0, h: 1.6, fill: { color: P.cyan }, line: { color: P.cyan } });
  slide.addText(central, { x: 3.5, y: 1.9, w: 3.0, h: 1.6, fontSize: 11, bold: true, color: P.dark, fontFace: 'Calibri', align: 'center', valign: 'middle' });

  const posiciones = [{ x: 0.1, y: 0.7 }, { x: 7.0, y: 0.7 }, { x: 0.1, y: 3.5 }, { x: 7.0, y: 3.5 }];
  const colores    = [P.blue, P.green, P.amber, P.red];

  patas.slice(0, 4).forEach((pata, i) => {
    const pos   = posiciones[i];
    const color = colores[i % colores.length];
    slide.addShape("rect", { x: pos.x, y: pos.y, w: 2.8, h: 0.6, fill: { color: '1A2744' }, line: { color, width: 2 } });
    slide.addText(pata.tema || '', { x: pos.x, y: pos.y, w: 2.8, h: 0.6, fontSize: 11, bold: true, color, fontFace: 'Calibri', align: 'center', valign: 'middle' });
    if (pata.detalle) {
      slide.addText(pata.detalle, { x: pos.x, y: pos.y + 0.63, w: 2.8, h: 0.85, fontSize: 9, color: P.offWhite, fontFace: 'Calibri', align: 'left', lineSpacingMultiple: 1.2 });
    }
    if (pata.subdetalles?.length) {
      pata.subdetalles.slice(0, 2).forEach((sd, j) => {
        slide.addText('• ' + sd, { x: pos.x, y: pos.y + 1.5 + j * 0.28, w: 2.8, h: 0.26, fontSize: 8, color: P.gray, fontFace: 'Calibri', align: 'left' });
      });
    }
  });
};

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — GENERAR Y DESCARGAR PPTX
// ─────────────────────────────────────────────────────────────
export const generarPPTX = async ({
  tipo = 'sinoptico',
  cierreData,
  grupo,
  escuela,
  promedioGrupo,
  totalAlumnos,
  lecturasSession,
}) => {
  const PptxGenJS = await cargarPptxGen();
  const pres      = new PptxGenJS();
  pres.layout     = 'LAYOUT_16x9';
  pres.author     = 'Aura Core';
  pres.title      = `${cierreData.temaCentral} — Grupo ${grupo}`;

  const TIPOS_LABEL = {
    sinoptico:   'Cuadro sinóptico',
    conceptual:  'Mapa conceptual',
    mental:      'Mapa mental',
    ideas:       'Cuadro de ideas',
    comparativo: 'Cuadro comparativo',
    arana:       'Araña didáctica',
  };

  const esquema = cierreData.esquema || {};
  const ctx = { cierreData, grupo, escuela, promedioGrupo, totalAlumnos, lecturasSession, esquema };

  // Slide 1: Portada
  agregarPortada(pres, { ...ctx, tipoLabel: TIPOS_LABEL[tipo] || tipo });

  // Slides 2+: Conceptos con resúmenes
  agregarConceptos(pres, ctx);

  // Slide esquema principal
  if      (tipo === 'sinoptico')   agregarSinopticoCompleto(pres, ctx);
  else if (tipo === 'conceptual')  agregarConceptualCompleto(pres, ctx);
  else if (tipo === 'mental')      agregarMentalCompleto(pres, ctx);
  else if (tipo === 'ideas')       agregarCuadroIdeas(pres, ctx);
  else if (tipo === 'comparativo') agregarCuadroComparativo(pres, ctx);
  else if (tipo === 'arana')       agregarAranaDidactica(pres, ctx);

  // Preguntas de repaso
  agregarPreguntas(pres, ctx);

  // Actividad de cierre
  agregarActividad(pres, ctx);

  const fecha    = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-');
  const fileName = `AuraCore_${grupo}_${(TIPOS_LABEL[tipo] || tipo).replace(/\s/g, '_')}_${fecha}.pptx`;
  await pres.writeFile({ fileName });
  return fileName;
};