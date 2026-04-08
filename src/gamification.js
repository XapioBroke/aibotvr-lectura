// ─────────────────────────────────────────────────────────────
// gamification.js — Motor de Gamificación de Aura Core
// Importar en ReadingAnalyzer.jsx y donde se necesite
// ─────────────────────────────────────────────────────────────
import { db } from './firebase';
import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// NIVELES — 7 rangos por XP acumulado total
// ─────────────────────────────────────────────────────────────
export const NIVELES = [
  { nivel: 1, nombre: 'Lector Novato',      icono: '📖', color: '#8e8e93', xpMin: 0    },
  { nivel: 2, nombre: 'Lector Aprendiz',    icono: '📚', color: '#0a84ff', xpMin: 50   },
  { nivel: 3, nombre: 'Lector Activo',      icono: '⚡', color: '#30d158', xpMin: 150  },
  { nivel: 4, nombre: 'Lector Experto',     icono: '🔥', color: '#ff9f0a', xpMin: 300  },
  { nivel: 5, nombre: 'Lector Avanzado',    icono: '💎', color: '#bf5af2', xpMin: 500  },
  { nivel: 6, nombre: 'Lector Élite',       icono: '👑', color: '#ffd60a', xpMin: 750  },
  { nivel: 7, nombre: 'Maestro del Lenguaje', icono: '🌟', color: '#ff453a', xpMin: 1000 },
];

export const getNivel = (xpTotal) =>
  [...NIVELES].reverse().find((n) => xpTotal >= n.xpMin) || NIVELES[0];

export const getProgresoNivel = (xpTotal) => {
  const actual   = getNivel(xpTotal);
  const siguiente = NIVELES.find((n) => n.nivel === actual.nivel + 1);
  if (!siguiente) return { porcentaje: 100, xpFaltante: 0, siguiente: null };
  const rango      = siguiente.xpMin - actual.xpMin;
  const avance     = xpTotal - actual.xpMin;
  return {
    porcentaje:  Math.min(Math.round((avance / rango) * 100), 99),
    xpFaltante:  siguiente.xpMin - xpTotal,
    siguiente,
  };
};

// ─────────────────────────────────────────────────────────────
// BADGES — logros desbloqueables
// ─────────────────────────────────────────────────────────────
export const BADGES = [
  { id: 'primera_lectura',  icono: '🎯', nombre: 'Primera Lectura',    desc: 'Completaste tu primera evaluación'          },
  { id: 'racha_3',          icono: '🔥', nombre: 'En Racha',           desc: '3 días consecutivos leyendo'                },
  { id: 'racha_7',          icono: '⚡', nombre: 'Semana Perfecta',    desc: '7 días consecutivos leyendo'                },
  { id: 'racha_30',         icono: '💎', nombre: 'Mes Imparable',      desc: '30 días consecutivos leyendo'               },
  { id: 'ppm_ideal',        icono: '🏃', nombre: 'Velocidad Ideal',    desc: 'Leíste entre 120-160 PPM'                   },
  { id: 'ppm_200',          icono: '🚀', nombre: 'Lector Veloz',       desc: 'Superaste 200 PPM'                          },
  { id: 'nota_perfecta',    icono: '🏆', nombre: 'Nota Perfecta',      desc: 'Obtuviste 10/10 en una lectura'             },
  { id: 'cinco_lecturas',   icono: '📚', nombre: 'Bibliófilo',         desc: 'Completaste 5 lecturas'                     },
  { id: 'veinte_lecturas',  icono: '🌟', nombre: 'Devora Libros',      desc: 'Completaste 20 lecturas'                    },
  { id: 'bilingue',         icono: '🌎', nombre: 'Bilingüe',           desc: 'Leíste en inglés y español'                 },
  { id: 'mejora_notable',   icono: '📈', nombre: 'En Ascenso',         desc: 'Subiste 2 puntos vs tu lectura anterior'    },
];

// ─────────────────────────────────────────────────────────────
// CALCULAR RACHA
// Recibe array de lecturas ordenadas por fecha desc
// Devuelve número de días consecutivos
// ─────────────────────────────────────────────────────────────
export const calcularRacha = (lecturas) => {
  if (!lecturas?.length) return 0;

  const fechasUnicas = [
    ...new Set(
      lecturas.map((l) =>
        new Date(l.fecha).toLocaleDateString('es-MX'),
      ),
    ),
  ];

  let racha = 0;
  const hoy = new Date();

  for (let i = 0; i < fechasUnicas.length; i++) {
    const diaEsperado = new Date(hoy);
    diaEsperado.setDate(hoy.getDate() - i);
    const diaStr = diaEsperado.toLocaleDateString('es-MX');
    if (fechasUnicas.includes(diaStr)) {
      racha++;
    } else {
      break;
    }
  }
  return racha;
};

// ─────────────────────────────────────────────────────────────
// EVALUAR BADGES GANADOS en una lectura
// Recibe datos de la lectura actual + historial previo + alumno
// Devuelve array de badges nuevos desbloqueados
// ─────────────────────────────────────────────────────────────
export const evaluarBadges = ({
  analisis,
  lecturasAnteriores,
  badgesActuales,
  racha,
  modoIdioma,
  idiomasUsados,
}) => {
  const nuevos = [];
  const tieneBadge = (id) => badgesActuales?.includes(id);
  const total = (lecturasAnteriores?.length || 0) + 1;

  if (!tieneBadge('primera_lectura') && total === 1)
    nuevos.push('primera_lectura');

  if (!tieneBadge('racha_3')  && racha >= 3)  nuevos.push('racha_3');
  if (!tieneBadge('racha_7')  && racha >= 7)  nuevos.push('racha_7');
  if (!tieneBadge('racha_30') && racha >= 30) nuevos.push('racha_30');

  const ppm = analisis.palabrasPorMinuto || 0;
  if (!tieneBadge('ppm_ideal') && ppm >= 120 && ppm <= 160) nuevos.push('ppm_ideal');
  if (!tieneBadge('ppm_200')   && ppm >= 200)               nuevos.push('ppm_200');

  if (!tieneBadge('nota_perfecta') && analisis.calificacionFinal >= 10)
    nuevos.push('nota_perfecta');

  if (!tieneBadge('cinco_lecturas')  && total >= 5)  nuevos.push('cinco_lecturas');
  if (!tieneBadge('veinte_lecturas') && total >= 20) nuevos.push('veinte_lecturas');

  // Bilingüe: si ha leído en ambos idiomas
  const idiomasNuevos = new Set([...(idiomasUsados || []), modoIdioma?.leer]);
  if (!tieneBadge('bilingue') && idiomasNuevos.has('es') && idiomasNuevos.has('en'))
    nuevos.push('bilingue');

  // Mejora notable: subió 2+ puntos vs lectura anterior
  if (!tieneBadge('mejora_notable') && lecturasAnteriores?.length > 0) {
    const anterior = lecturasAnteriores[0].calificacionFinal || 0;
    if (analisis.calificacionFinal - anterior >= 2) nuevos.push('mejora_notable');
  }

  return nuevos;
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR GAMIFICACIÓN EN FIRESTORE
// Llama esto después de guardar una lectura
// ─────────────────────────────────────────────────────────────
export const actualizarGamificacion = async ({
  alumnoId,
  analisis,
  lecturasAnteriores,
  modoIdioma,
}) => {
  try {
    const alumnoRef  = doc(db, 'alumnos', alumnoId);
    const alumnoSnap = await getDoc(alumnoRef);
    if (!alumnoSnap.exists()) return { racha: 0, badgesNuevos: [], nivelNuevo: null };

    const datos         = alumnoSnap.data();
    const badgesActuales = datos.badges        || [];
    const idiomasUsados  = datos.idiomasUsados || [];
    const xpTotal        = (datos.puntosClase  || 0) + (analisis.puntosGanados || 0);

    // Calcular racha con lecturas anteriores + hoy
    const todasLecturas = [
      { fecha: new Date().toISOString() },
      ...(lecturasAnteriores || []),
    ];
    const racha = calcularRacha(todasLecturas);

    // Evaluar badges nuevos
    const badgesNuevos = evaluarBadges({
      analisis,
      lecturasAnteriores,
      badgesActuales,
      racha,
      modoIdioma,
      idiomasUsados,
    });

    // Nivel antes y después
    const nivelAntes  = getNivel(datos.puntosClase || 0);
    const nivelAhora  = getNivel(xpTotal);
    const subiNivel   = nivelAhora.nivel > nivelAntes.nivel;

    // Actualizar Firestore
    const updates = {
      racha,
      rachaMax:      Math.max(datos.rachaMax || 0, racha),
      idiomasUsados: [...new Set([...idiomasUsados, modoIdioma?.leer])],
    };
    if (badgesNuevos.length > 0) {
      updates.badges = arrayUnion(...badgesNuevos);
    }

    await updateDoc(alumnoRef, updates);

    return {
      racha,
      badgesNuevos,
      nivelNuevo:   subiNivel ? nivelAhora  : null,
      nivelActual:  nivelAhora,
    };
  } catch (e) {
    console.error('Error actualizando gamificación:', e);
    return { racha: 0, badgesNuevos: [], nivelNuevo: null };
  }
};