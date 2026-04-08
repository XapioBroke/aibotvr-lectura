// ─────────────────────────────────────────────────────────────
// localAnalyzer.js — Motor de análisis heurístico sin API
// Cero créditos. Funciona 100% offline en el navegador.
// Precisión estimada: ~75-80% vs análisis IA
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// UTILIDADES INTERNAS
// ─────────────────────────────────────────────────────────────

// Normaliza texto para comparación
const normalizar = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

// Distancia de Levenshtein (reutilizada del fuzzy tracker)
const levenshtein = (a, b) => {
  if (!a) return b.length;
  if (!b) return a.length;
  const m = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = b[i-1] === a[j-1]
        ? m[i-1][j-1]
        : 1 + Math.min(m[i-1][j], m[i][j-1], m[i-1][j-1]);
  return m[b.length][a.length];
};

const similitud = (a, b) => {
  const na = normalizar(a), nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
};

// Palabras funcionales (artículos, preposiciones) — no cuentan para dicción
const PALABRAS_VACIAS_ES = new Set([
  'el','la','los','las','un','una','unos','unas','de','del','al',
  'en','con','por','para','que','se','su','sus','es','son','fue',
  'era','lo','le','les','me','mi','te','tu','nos','y','o','a',
  'pero','si','no','ya','más','muy','bien','así','como','cuando',
]);
const PALABRAS_VACIAS_EN = new Set([
  'the','a','an','of','in','on','at','to','for','with','is','are',
  'was','were','be','been','have','has','had','do','does','did',
  'and','or','but','if','so','as','by','from','it','its','this',
  'that','these','those','i','you','he','she','we','they','my',
  'your','his','her','our','their',
]);

// ─────────────────────────────────────────────────────────────
// MÓDULOS DE ANÁLISIS
// ─────────────────────────────────────────────────────────────

// 1. FLUIDEZ — PPM vs rangos ideales
const analizarFluidez = (ppm) => {
  let puntuacion, comentario;

  if (ppm === 0) {
    puntuacion = 1;
    comentario = 'No se detectó velocidad de lectura.';
  } else if (ppm < 60) {
    puntuacion = 3;
    comentario = `Tu velocidad fue de ${ppm} PPM. La lectura fue muy lenta. El rango ideal para secundaria es 120-150 PPM.`;
  } else if (ppm < 90) {
    puntuacion = 5;
    comentario = `Leíste a ${ppm} PPM. Velocidad por debajo del promedio. Practica con textos cortos cronometrados para ganar fluidez.`;
  } else if (ppm < 120) {
    puntuacion = 7;
    comentario = `Velocidad de ${ppm} PPM. Buen ritmo, estás acercándote al rango ideal de 120-150 PPM.`;
  } else if (ppm <= 160) {
    puntuacion = 10;
    comentario = `¡Excelente! ${ppm} PPM está en el rango ideal de lectura fluida. Muy bien logrado.`;
  } else if (ppm <= 200) {
    puntuacion = 8;
    comentario = `Leíste a ${ppm} PPM, un poco rápido. A veces la velocidad afecta la comprensión. Intenta desacelerar ligeramente.`;
  } else {
    puntuacion = 6;
    comentario = `${ppm} PPM es muy rápido. Puede ser difícil comprender el contenido a esa velocidad. Reduce el ritmo.`;
  }

  return { puntuacion, comentario };
};

// 2. PRECISIÓN — comparación fuzzy palabra a palabra vs texto referencia
const analizarPrecision = (transcripcion, textoReferencia) => {
  if (!textoReferencia) {
    return {
      puntuacion: 7,
      comentario: 'Modo libre: no hay texto de referencia para comparar precisión.',
    };
  }

  const palabrasRef    = normalizar(textoReferencia).split(/\s+/).filter(Boolean);
  const palabrasAlumno = normalizar(transcripcion).split(/\s+/).filter(Boolean);

  if (!palabrasRef.length || !palabrasAlumno.length) {
    return { puntuacion: 1, comentario: 'No se detectó texto suficiente para evaluar precisión.' };
  }

  // Cuenta palabras del alumno que tienen match >= 0.75 en el texto de referencia
  let aciertos = 0;
  palabrasAlumno.forEach(palabra => {
    const mejorMatch = Math.max(...palabrasRef.map(ref => similitud(palabra, ref)));
    if (mejorMatch >= 0.75) aciertos++;
  });

  const porcentaje = Math.round((aciertos / palabrasRef.length) * 100);
  let puntuacion, comentario;

  if (porcentaje >= 90) {
    puntuacion = 10;
    comentario = `Precisión del ${porcentaje}%. Seguiste el texto de referencia con gran fidelidad.`;
  } else if (porcentaje >= 75) {
    puntuacion = 8;
    comentario = `Precisión del ${porcentaje}%. Leíste la mayor parte del texto correctamente, con algunas omisiones menores.`;
  } else if (porcentaje >= 60) {
    puntuacion = 6;
    comentario = `Precisión del ${porcentaje}%. Varias palabras fueron omitidas o cambiadas. Practica releer el texto antes de grabarte.`;
  } else if (porcentaje >= 40) {
    puntuacion = 4;
    comentario = `Precisión del ${porcentaje}%. La lectura se alejó bastante del texto original. Intenta seguir línea por línea.`;
  } else {
    puntuacion = 2;
    comentario = `Precisión del ${porcentaje}%. El texto leído difiere mucho del de referencia. Revisa el texto con calma antes de leer.`;
  }

  return { puntuacion, comentario, porcentaje };
};

// 3. PAUSAS — detecta pausas naturales por puntuación en la transcripción
const analizarPausas = (transcripcion) => {
  const texto = transcripcion.trim();
  if (!texto) return { puntuacion: 1, comentario: 'No se detectó texto.' };

  // Cuenta signos de puntuación que indican pausas naturales
  const puntos    = (texto.match(/[.!?]/g)  || []).length;
  const comas     = (texto.match(/[,;:]/g)  || []).length;
  const palabras  = texto.split(/\s+/).length;

  // Ratio de puntuación vs palabras (indicador de pausas)
  const ratioPuntos = puntos  / Math.max(palabras, 1);
  const ratioComas  = comas   / Math.max(palabras, 1);
  const ratioTotal  = ratioPuntos + ratioComas;

  let puntuacion, comentario;

  if (ratioTotal < 0.01) {
    puntuacion = 4;
    comentario = 'Se detectaron muy pocas pausas. Recuerda respetar los puntos y comas del texto.';
  } else if (ratioTotal < 0.03) {
    puntuacion = 6;
    comentario = 'Pausas básicas detectadas. Puedes mejorar respetando más la puntuación del texto.';
  } else if (ratioTotal < 0.07) {
    puntuacion = 8;
    comentario = 'Buenas pausas naturales. La lectura tuvo un ritmo adecuado con la puntuación.';
  } else {
    puntuacion = 9;
    comentario = 'Excelente manejo de pausas. Respetaste bien la puntuación y el ritmo del texto.';
  }

  return { puntuacion, comentario };
};

// 4. DICCIÓN — riqueza de vocabulario y palabras complejas
const analizarDiccion = (transcripcion, idioma = 'es') => {
  const palabras      = transcripcion.toLowerCase().split(/\s+/).filter(Boolean);
  const vacias        = idioma === 'en' ? PALABRAS_VACIAS_EN : PALABRAS_VACIAS_ES;
  const significativas = palabras.filter(p => !vacias.has(normalizar(p)));
  const unicas        = new Set(significativas.map(normalizar));

  if (!palabras.length) return { puntuacion: 1, comentario: 'No se detectaron palabras.' };

  // Riqueza léxica: palabras únicas / total palabras significativas
  const riqueza = unicas.size / Math.max(significativas.length, 1);

  // Palabras largas (>6 letras) como indicador de vocabulario avanzado
  const palabrasLargas = significativas.filter(p => p.length > 6).length;
  const ratioLargas    = palabrasLargas / Math.max(significativas.length, 1);

  const score = (riqueza * 0.6) + (ratioLargas * 0.4);

  let puntuacion, comentario;

  if (score >= 0.7) {
    puntuacion = 9;
    comentario = `Excelente vocabulario. Usaste ${unicas.size} palabras distintas con buena variedad léxica.`;
  } else if (score >= 0.5) {
    puntuacion = 7;
    comentario = `Buen vocabulario con ${unicas.size} palabras únicas. Sigue leyendo para enriquecer tu léxico.`;
  } else if (score >= 0.35) {
    puntuacion = 6;
    comentario = `Vocabulario básico detectado. Intenta usar sinónimos y palabras más variadas al leer en voz alta.`;
  } else {
    puntuacion = 4;
    comentario = `Vocabulario limitado. La lectura de libros variados puede ayudarte a ampliar tu vocabulario.`;
  }

  return { puntuacion, comentario };
};

// 5. EXPRESIVIDAD — variación en la longitud de frases y signos de emoción
const analizarExpresividad = (transcripcion) => {
  const texto = transcripcion.trim();
  if (!texto) return { puntuacion: 1, comentario: 'No se detectó texto.' };

  const exclamaciones = (texto.match(/!/g) || []).length;
  const interrogaciones = (texto.match(/\?/g) || []).length;
  const palabras = texto.split(/\s+/).length;

  // Frases por puntuación
  const frases = texto.split(/[.!?]+/).filter(f => f.trim().length > 3);
  const longitudes = frases.map(f => f.trim().split(/\s+/).length);
  const variacion = longitudes.length > 1
    ? Math.max(...longitudes) - Math.min(...longitudes)
    : 0;

  const ratioExpresion = (exclamaciones + interrogaciones) / Math.max(palabras, 1);

  let puntuacion, comentario;

  if (ratioExpresion > 0.05 || variacion > 8) {
    puntuacion = 9;
    comentario = 'Lectura muy expresiva con buena variación de ritmo y tono.';
  } else if (ratioExpresion > 0.02 || variacion > 4) {
    puntuacion = 7;
    comentario = 'Buena expresividad. La lectura tuvo variación de ritmo en varios momentos.';
  } else if (variacion > 1) {
    puntuacion = 5;
    comentario = 'Expresividad moderada. Intenta variar más el tono de voz según el contenido.';
  } else {
    puntuacion = 4;
    comentario = 'Lectura plana. Trabaja en variar el tono y el ritmo para hacer la lectura más dinámica.';
  }

  return { puntuacion, comentario };
};

// 6. COHERENCIA (solo modo libre) — conectores y estructura del discurso
const analizarCoherencia = (transcripcion, idioma = 'es') => {
  const texto = transcripcion.toLowerCase();
  const conectoresES = ['porque','entonces','aunque','además','sin embargo','por lo tanto',
    'finalmente','primero','después','luego','también','pero','sin embargo','es decir'];
  const conectoresEN = ['because','therefore','although','however','furthermore','finally',
    'first','then','also','but','in addition','for example','as a result'];
  const conectores = idioma === 'en' ? conectoresEN : conectoresES;

  const encontrados = conectores.filter(c => texto.includes(c)).length;
  const palabras    = texto.split(/\s+/).length;
  const ratio       = encontrados / Math.max(palabras / 10, 1);

  let puntuacion, comentario;

  if (ratio >= 2) {
    puntuacion = 9;
    comentario = `Excelente coherencia. Usaste ${encontrados} conectores que dan estructura al discurso.`;
  } else if (ratio >= 1) {
    puntuacion = 7;
    comentario = `Buena coherencia con ${encontrados} conectores. El discurso tuvo estructura lógica.`;
  } else if (encontrados > 0) {
    puntuacion = 5;
    comentario = `Coherencia básica. Agrega más conectores como "además", "sin embargo", "por lo tanto".`;
  } else {
    puntuacion = 4;
    comentario = 'Poca coherencia detectada. Usa conectores para unir mejor tus ideas al leer.';
  }

  return { puntuacion, comentario };
};

// ─────────────────────────────────────────────────────────────
// GENERADOR DE RETROALIMENTACIÓN POR PLANTILLAS
// ─────────────────────────────────────────────────────────────
const generarFortalezas = (categorias) => {
  const fortalezas = [];
  Object.entries(categorias).forEach(([key, val]) => {
    if (val.puntuacion >= 8) {
      const mensajes = {
        fluidez:      'Velocidad de lectura en rango ideal',
        precision:    'Alta fidelidad al texto de referencia',
        pausas:       'Excelente manejo de pausas y puntuación',
        diccion:      'Vocabulario rico y variado',
        expresividad: 'Lectura expresiva y dinámica',
        coherencia:   'Discurso coherente y bien estructurado',
      };
      if (mensajes[key]) fortalezas.push(mensajes[key]);
    }
  });
  return fortalezas.length ? fortalezas : ['Completaste la lectura con esfuerzo y dedicación'];
};

const generarAreasAMejorar = (categorias) => {
  const areas = [];
  Object.entries(categorias).forEach(([key, val]) => {
    if (val.puntuacion < 6) {
      const mensajes = {
        fluidez:      'Trabajar la velocidad de lectura con práctica diaria',
        precision:    'Leer más despacio para seguir el texto con precisión',
        pausas:       'Respetar los signos de puntuación al leer',
        diccion:      'Ampliar el vocabulario con lectura variada',
        expresividad: 'Variar el tono y ritmo de la voz al leer',
        coherencia:   'Usar conectores para estructurar mejor el discurso',
      };
      if (mensajes[key]) areas.push(mensajes[key]);
    }
  });
  return areas.length ? areas : ['Continuar practicando la lectura en voz alta diariamente'];
};

const generarComentarioGeneral = (calif, ppm, nombre) => {
  if (calif >= 9) return `¡Lectura sobresaliente! ${nombre || 'El alumno'} demostró dominio en fluidez, precisión y expresividad. Sigue practicando para mantener este nivel.`;
  if (calif >= 7) return `Buena lectura de ${nombre || 'el alumno'}. Los resultados muestran un lector en desarrollo con áreas claras de mejora. Con práctica constante alcanzará el nivel ideal.`;
  if (calif >= 5) return `${nombre || 'El alumno'} está en proceso de desarrollo lector. Se recomienda práctica diaria de 10-15 minutos en voz alta con textos de su nivel.`;
  return `${nombre || 'El alumno'} necesita apoyo adicional en lectura. Se sugiere comenzar con textos más cortos y sencillos, aumentando gradualmente la dificultad.`;
};

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — ANÁLISIS COMPLETO LOCAL
// ─────────────────────────────────────────────────────────────
export const analizarLecturaLocal = ({
  transcripcion,
  textoReferencia,
  tiempoSegundos,
  modoLectura = 'libre',
  modoIdioma  = { leer: 'es' },
  alumnoNombre = '',
}) => {
  if (!transcripcion?.trim()) {
    return null;
  }

  const palabras          = transcripcion.trim().split(/\s+/).filter(Boolean);
  const numeroPalabras    = palabras.length;
  const tiempoMinutos     = (tiempoSegundos || 1) / 60;
  const palabrasPorMinuto = Math.round(numeroPalabras / tiempoMinutos);
  const idioma            = modoIdioma.leer || 'es';

  // Calcular cada categoría
  const fluidez      = analizarFluidez(palabrasPorMinuto);
  const diccion      = analizarDiccion(transcripcion, idioma);
  const pausas       = analizarPausas(transcripcion);
  const expresividad = analizarExpresividad(transcripcion);

  let categorias;

  if (modoLectura === 'guiada' && textoReferencia) {
    const precision = analizarPrecision(transcripcion, textoReferencia);
    categorias = { fluidez, diccion, precision, pausas, expresividad };
  } else {
    const coherencia = analizarCoherencia(transcripcion, idioma);
    categorias = { fluidez, diccion, pausas, expresividad, coherencia };
  }

  // Calificación final ponderada
  const pesos = {
    fluidez:      0.25,
    diccion:      0.20,
    precision:    0.25,
    pausas:       0.15,
    expresividad: 0.15,
    coherencia:   0.20,
  };

  let sumaPonderada = 0;
  let sumaPesos     = 0;
  Object.entries(categorias).forEach(([key, val]) => {
    const peso = pesos[key] || 0.15;
    sumaPonderada += val.puntuacion * peso;
    sumaPesos     += peso;
  });

  const calificacionFinal = Math.round((sumaPonderada / sumaPesos) * 10) / 10;
  const puntosGanados     = Math.round((calificacionFinal / 10) * 30);

  return {
    ...categorias,
    calificacionFinal,
    puntosGanados,
    palabrasPorMinuto,
    numeroPalabras,
    fortalezas:        generarFortalezas(categorias),
    areasAMejorar:     generarAreasAMejorar(categorias),
    comentarioGeneral: generarComentarioGeneral(calificacionFinal, palabrasPorMinuto, alumnoNombre),
    modoAnalisis:      'local', // marca para distinguirlo del análisis IA
  };
};