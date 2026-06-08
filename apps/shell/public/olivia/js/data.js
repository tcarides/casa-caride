/* =========================================================
   Olivia · Contenido del camino de paternidad
   - WEEKS: desarrollo semana a semana (bebé, mamá, papá)
   - DAILY_TIPS: banco de consejos para el papá (rotan a diario)
   - QUOTES: frases para acompañar
   - PREP: checklist de preparativos por trimestre
   ========================================================= */

const WEEKS = {
  4:  { size: "una semillita de amapola", baby: "Olivia es apenas un grupo de células que ya empezó a anidar. Se están formando las capas que darán origen a su cerebro, corazón y todo su cuerpo.", mom: "Quizá ni se nota todavía. Puede haber cansancio, sensibilidad en los pechos o un retraso que recién despierta sospechas.", dad: ["Acompañá el test y la primera consulta sin presionar.", "Empezá a sumar ácido fólico a la rutina de pareja: ofrecé recordatorios suaves.", "Guardá este momento: es el comienzo de todo."] },
  5:  { size: "una semilla de sésamo", baby: "El corazón de Olivia empieza a latir esta semana, aunque todavía no se escucha. Se forma el tubo neural, base de su cerebro y médula.", mom: "Llegan las náuseas, el sueño y los antojos. Las hormonas están a mil.", dad: ["Tené a mano galletas o algo liviano para las náuseas matutinas.", "Asumí un par de tareas de casa sin que te las pidan.", "Acompañala a sacar turno con el obstetra."] },
  6:  { size: "una lenteja", baby: "Aparecen los esbozos de bracitos y piernas, y se dibujan los rasgos de la carita. El corazón ya late fuerte.", mom: "Las náuseas pueden intensificarse. El olfato se vuelve súper sensible.", dad: ["Evitá cocinar cosas de olor fuerte en casa.", "Ofrecé agua y descanso; la hidratación ayuda muchísimo.", "Sé paciente con los cambios de humor: son hormonales, no personales."] },
  7:  { size: "un arándano", baby: "El cerebro crece a toda velocidad y se forman manos y pies con aspecto de remos. Olivia ya se mueve, aunque no se sienta.", mom: "El cansancio es real. Puede haber más saliva y aversión a ciertas comidas.", dad: ["Proponé siestas y noches tempranas sin culpa.", "Encargate vos de la lista del super esta semana.", "Preguntale cómo se siente, de verdad, y escuchá."] },
  8:  { size: "una frambuesa", baby: "Se forman los párpados, el labio superior y la nariz. Los deditos empiezan a separarse.", mom: "El útero crece y aparecen pinchazos. La ropa empieza a apretar.", dad: ["Anímala a comprar ropa cómoda si la necesita.", "Investigá juntos qué obstetra o partera quieren.", "Llevá un registro de fechas y turnos en un calendario compartido."] },
  9:  { size: "una aceituna", baby: "Olivia ya tiene forma humana en miniatura. Se forman dientes y articulaciones; pronto pasará de embrión a feto.", mom: "El volumen de sangre aumenta; puede haber mareos. Emociones a flor de piel.", dad: ["Si se marea, que no se levante de golpe; ofrecele tu brazo.", "Preparale snacks con hierro y proteína.", "Hablá con ella de cómo imaginan la crianza."] },
  10: { size: "una ciruela", baby: "Los órganos vitales ya funcionan. Las uñas y el fino vello empiezan a aparecer. Olivia traga y patalea.", mom: "Las náuseas pueden empezar a ceder. Tal vez ya quieran contar la noticia.", dad: ["Planeen juntos cómo y a quién contarle la novedad.", "Acompañala a la ecografía: es emocionante verla en pantalla.", "Empezá a leer sobre el primer trimestre para entender qué pasa."] },
  11: { size: "un higo", baby: "Olivia abre y cierra los puños, y le crecen folículos del pelo. Casi toda la estructura del cuerpo está formada.", mom: "Más energía a la vista. El apetito puede volver con ganas.", dad: ["Cociná juntos algo rico ahora que vuelven las ganas de comer.", "Festejen los pequeños hitos: cada semana cuenta.", "Empezá a pensar en el presupuesto familiar con calma."] },
  12: { size: "un limón", baby: "Los reflejos aparecen: Olivia reacciona si tocan la panza. Se forman las cuerdas vocales.", mom: "Fin del primer trimestre. Suele bajar el riesgo y subir el ánimo.", dad: ["Celebren cerrar el primer trimestre, es un gran hito.", "Sacá la ecografía del primer trimestre en la agenda.", "Proponé una salida tranquila para festejar los dos."] },
  13: { size: "una vaina de arvejas", baby: "Olivia ya tiene huellas digitales únicas. Sus huesos se endurecen y puede chuparse el dedo.", mom: "Empieza el segundo trimestre, el más amable. Suele volver la vitalidad.", dad: ["Aprovechá la mejor etapa para planear un viaje corto si se puede.", "Empezá a leer sobre el desarrollo del bebé en voz alta, juntos.", "Anotá ideas de nombres… aunque ya tengan a Olivia."] },
  14: { size: "un limón grande", baby: "Olivia hace gestos: fruncir el ceño, sonreír. Empieza a producir orina y a 'respirar' líquido amniótico.", mom: "La panza empieza a notarse. Puede aparecer la famosa 'línea negra'.", dad: ["Sacale una foto a la panza cada semana para ver el progreso.", "Ofrecele cremas para la piel y un masaje en la espalda.", "Investiguen juntos sobre cursos de preparación al parto."] },
  15: { size: "una manzana", baby: "Olivia percibe la luz aunque tenga los ojos cerrados, y empieza a oír sonidos. Mueve brazos y piernas con soltura.", mom: "Puede mejorar el cabello y la piel. Cuidado con la congestión nasal del embarazo.", dad: ["Empezá a hablarle a la panza: tu voz ya empieza a registrarla.", "Pongan música suave; a Olivia le llega.", "Acompañala a elegir ropa de embarazo si la necesita."] },
  16: { size: "una palta", baby: "Olivia ya escucha tu voz. Su corazón bombea litros de sangre por día y sus piernas crecen.", mom: "Quizá sientas los primeros movimientos suaves, como burbujas.", dad: ["Apoyá la mano en la panza al hablarle; creá el hábito.", "Preguntá en cada control si ya pueden saber más sobre ella.", "Empecemos a soñar la habitación: junten ideas."] },
  17: { size: "una pera", baby: "Olivia acumula grasa para regular su temperatura. Su esqueleto pasa de cartílago a hueso.", mom: "El centro de gravedad cambia; pueden aparecer molestias de espalda.", dad: ["Ofrecé masajes lumbares y ayudá con el calzado.", "Encargate de las tareas que impliquen agacharse o cargar peso.", "Busquen juntos una almohada de embarazo."] },
  18: { size: "un pimiento", baby: "Olivia bosteza, hipa y se mueve mucho. Sus oídos ya están en posición y oye mejor.", mom: "Los movimientos se vuelven más claros. Puede haber hambre frecuente.", dad: ["Esperá quieto con la mano en la panza para sentir una patadita.", "Si hay ecografía de la semana 20 cerca, agéndenla.", "Contale a Olivia cómo fue tu día: ya te escucha."] },
  19: { size: "un tomate grande", baby: "Una capa cremosa (vérnix) protege su piel. Se desarrollan los sentidos: gusto, olfato, oído, vista y tacto.", mom: "Posibles calambres nocturnos y piel estirada. Mucha sed.", dad: ["Tené agua en la mesa de luz para los calambres de la noche.", "Masajeale las pantorrillas antes de dormir.", "Planeen la ecografía morfológica con ilusión."] },
  20: { size: "una banana", baby: "¡Mitad del camino! Olivia mide unos 25 cm. Traga más y sus pataditas son inconfundibles.", mom: "Ecografía morfológica: un momento enorme para conocerla mejor.", dad: ["Pedí copia de las imágenes de la eco para guardar.", "Festejen llegar a la mitad del embarazo.", "Empiecen la lista del ajuar de Olivia con calma."] },
  21: { size: "una zanahoria", baby: "Olivia tiene un patrón de sueño y vigilia. Saborea lo que come mamá a través del líquido amniótico.", mom: "Puede sentirse más cómoda y enérgica. Apetito en alza.", dad: ["Cociná comidas variadas: Olivia 'prueba' sabores con vos.", "Reservá un curso de preparación para el parto.", "Lean juntos un cuento en voz alta por las noches."] },
  22: { size: "un coco pequeño", baby: "Sus rasgos están casi definidos: cejas, pestañas y pelo fino. Reacciona a tu voz con movimientos.", mom: "La panza es protagonista. Pueden aparecer estrías; la piel pide hidratación.", dad: ["Hacele masajes con crema en la panza por la noche.", "Decidan juntos el nombre definitivo y la decoración.", "Empezá a investigar sobre la licencia y los trámites."] },
  23: { size: "un mango", baby: "La piel de Olivia es rojiza y arrugada; pronto se rellenará. Oye ruidos fuertes de afuera.", mom: "Posible hinchazón en pies y manos. Importante mover las piernas.", dad: ["Proponé caminatas suaves juntos al atardecer.", "Si se hincha, ayudá a elevar sus piernas al descansar.", "Empiecen a comparar cunas, cochecitos y sillas de auto."] },
  24: { size: "una mazorca de maíz", baby: "Olivia cruza un umbral de viabilidad importante. Sus pulmones desarrollan las vías para respirar.", mom: "Suele hacerse el test de diabetes gestacional por estas semanas.", dad: ["Acompañala al test de glucosa; lleven algo para después.", "Armen juntos un plan por si el parto se adelanta.", "Reforzá la red de apoyo: avisá a la familia cercana."] },
  25: { size: "un nabo", baby: "Olivia responde a tu voz y a la música con movimientos. Sus manitos ya tienen reflejo de agarre.", mom: "Puede aparecer acidez y dolor de espalda. El sueño se vuelve liviano.", dad: ["Preparale almohadas para dormir de costado.", "Ofrecé comidas livianas a la noche para la acidez.", "Reservá la silla de auto: es lo primero que necesitarán al salir."] },
  26: { size: "una lechuga", baby: "Olivia abre los ojos por primera vez y empieza a parpadear. Reacciona a la luz sobre la panza.", mom: "Tercer trimestre a la vista. Más peso, más cansancio.", dad: ["Probá apuntar una linterna suave a la panza: puede moverse.", "Encargate de los trámites y compras grandes esta etapa.", "Confirmá la fecha del curso de preparación al parto."] },
  27: { size: "una coliflor", baby: "¡Empieza el tercer trimestre! Olivia hipa (lo sentirás), sueña y reconoce tu voz con claridad.", mom: "Pueden volver el cansancio y las molestias del primer trimestre.", dad: ["Retomá el rol de cuidador: tareas, descanso, mimos.", "Planeen el bolso del hospital con tiempo.", "Hablen del plan de parto: qué quieren y qué no."] },
  28: { size: "una berenjena", baby: "Olivia abre y cierra los ojos y tiene ciclos de sueño REM: ya sueña. Engorda semana a semana.", mom: "Controles más seguidos. Posible hinchazón y reflujo.", dad: ["Acompañala a los controles, ahora más frecuentes.", "Empezá a armar el bolso del hospital con una lista.", "Practiquen juntos respiraciones para el trabajo de parto."] },
  29: { size: "una calabaza pequeña", baby: "Los músculos y pulmones de Olivia maduran rápido. Sus pataditas ahora son firmes.", mom: "Falta de aire al subir escaleras y necesidad de orinar seguido.", dad: ["Encargate de lo pesado en casa; cero esfuerzos para ella.", "Repasen el camino y los tiempos hasta el hospital.", "Instalá la silla de auto y aprendé a usarla bien."] },
  30: { size: "un repollo", baby: "El cerebro de Olivia se vuelve más complejo y arrugado. Puede distinguir luz de oscuridad.", mom: "Cambios de humor por cansancio. El sueño cuesta más.", dad: ["Creá un ritual nocturno tranquilo para los dos.", "Tené listo el bolso y los documentos a mano.", "Cociná y congelá comidas para las primeras semanas con Olivia."] },
  31: { size: "un coco", baby: "Olivia procesa información y registra estímulos. Suele ubicarse cabeza abajo preparándose.", mom: "Pueden empezar contracciones de práctica (Braxton Hicks).", dad: ["Aprendé a diferenciar contracciones reales de las de práctica.", "Confirmá el bolso del hospital y dejalo en la puerta.", "Repasen juntos el plan: a quién llamar y cuándo salir."] },
  32: { size: "una jícama", baby: "Olivia practica respirar, tragar y patear. Sus uñas llegan a la punta de los dedos.", mom: "Más presión en la pelvis. El descanso se vuelve clave.", dad: ["Ayudá a que descanse con las piernas elevadas.", "Terminen los trámites de obra social y licencia.", "Armen la habitación o el rincón de Olivia."] },
  33: { size: "una piña", baby: "El sistema inmune de Olivia recibe anticuerpos de mamá. Sus huesos se endurecen, salvo el cráneo.", mom: "Posibles dolores de pelvis y ciática. Sueño interrumpido.", dad: ["Ofrecé masajes y compresas tibias para la ciática.", "Encargate de las compras finales del ajuar.", "Lavá y guardá la ropita de Olivia con cariño."] },
  34: { size: "un melón", baby: "Los pulmones casi listos. Olivia ya reconoce canciones que escucha seguido.", mom: "Cansancio y ganas de que llegue. Nido en marcha.", dad: ["Elijan una canción para Olivia y cántensela seguido.", "Verificá que la silla de auto esté bien instalada.", "Tengan lista la lista de contactos para el día D."] },
  35: { size: "un melón grande", baby: "Olivia gana peso rápido y casi no le queda espacio. Sus riñones y hígado ya funcionan solos.", mom: "Movimientos más lentos pero fuertes. Posibles controles semanales.", dad: ["Estate atento: a partir de ahora puede pasar en cualquier momento.", "Carguen nafta y tengan el auto siempre listo.", "Repasen las señales de trabajo de parto juntos."] },
  36: { size: "una lechuga romana", baby: "Olivia se encaja en la pelvis. Pierde el lanugo y traga vérnix. Está casi a término.", mom: "Más presión abajo, quizá respires mejor. Controles semanales.", dad: ["Tené el teléfono siempre cargado y a mano.", "Confirmá quién cuida la casa/mascotas cuando salgan.", "Practiquen la salida al hospital como un simulacro."] },
  37: { size: "una acelga", baby: "¡Olivia es de término temprano! Ya podría nacer sana en cualquier momento.", mom: "Puede perder el tapón mucoso. Atención a las contracciones.", dad: ["Mantené la calma y el bolso en la puerta.", "Repasá los teléfonos del hospital y del obstetra.", "Descansá vos también: vas a necesitar energía."] },
  38: { size: "un puerro", baby: "Olivia tiene agarre firme y sus órganos están listos. Solo suma grasa y madura.", mom: "Espera activa. Cada molestia puede ser el inicio.", dad: ["Estate disponible y localizable todo el día.", "Cociná algo rico: pueden ser las últimas cenas en pareja.", "Recordale lo capaz y fuerte que es para lo que viene."] },
  39: { size: "una sandía pequeña", baby: "Olivia está a término completo. Su cerebro y pulmones siguen afinando detalles.", mom: "Ansiedad y ganas. Posibles contracciones que van y vienen.", dad: ["Sé el ancla de calma: respiren juntos.", "Cronometren contracciones sin alarmarse.", "Tengan la cámara lista para el gran momento."] },
  40: { size: "una sandía 🍉", baby: "¡Llegó la fecha esperada! Olivia está completamente lista para conocerte. Puede llegar cualquier día de estos.", mom: "Cuerpo y mente listos. La paciencia es la última gran prueba.", dad: ["Acompañá cada contracción con presencia y calma.", "Confiá en ella y en el equipo médico.", "Grabá en la memoria el momento de conocer a Olivia: lo esperaste todo este tiempo."] },
  41: { size: "una sandía madura", baby: "Olivia se toma unos días extra. Es normal; el equipo médico controlará todo de cerca.", mom: "Paciencia y controles frecuentes. Puede plantearse una inducción.", dad: ["Mantené la calma: muchos bebés llegan después de la fecha.", "Acompañá los controles extra sin transmitir ansiedad.", "Seguí presente, atento y sereno: ya falta poquito."] },
};

const DAILY_TIPS = [
  "Hablale a la panza hoy. Aunque te sientas raro, Olivia reconoce tu voz y crea vínculo desde antes de nacer.",
  "Preguntale a tu pareja '¿cómo te puedo ayudar hoy?' en vez de adivinar. A veces lo más útil es simplemente escuchar.",
  "Tomá vos una tarea invisible de la casa esta semana (turnos, compras, limpieza) y hacela tuya sin que te la recuerden.",
  "Sacale hoy una foto a la panza. En unos meses vas a atesorar ver cómo creció Olivia semana a semana.",
  "El cansancio del embarazo es real y agotador. Ofrecé una siesta y encargate vos de lo que haga falta.",
  "Aprendé a tomar la presión y reconocer señales de alarma. Estar informado te vuelve un compañero más tranquilo.",
  "Anotá una cosa que admirás de tu pareja como futura mamá y decísela hoy. Las palabras sostienen mucho.",
  "Investigá los pasos del trabajo de parto. Saber qué esperar baja el miedo de los dos cuando llegue el día.",
  "Preparale algo rico de comer sin que lo pida. Los gestos chiquitos valen más que los grandes discursos.",
  "Guardá hoy un recuerdo: una nota, una eco, un audio. Estás construyendo la historia de Olivia.",
  "Si hay cambios de humor, recordá que son hormonales. Respondé con paciencia, no con lógica.",
  "Acompañá el próximo control médico. Tu presencia en la sala dice más que mil mensajes de apoyo.",
  "Empezá a leer en voz alta un cuento corto cada noche. Olivia se acostumbra a tu voz y ustedes crean un ritual.",
  "Revisá el bolso del hospital. Tenerlo listo con tiempo evita el caos del último momento.",
  "Cuidate vos también: dormí, comé bien y movete. Un papá descansado sostiene mejor a su familia.",
  "Decile a tu pareja que es un gran equipo. Sentirse acompañada cambia por completo la experiencia.",
  "Practiquen juntos una respiración lenta: inhalar en 4, exhalar en 6. Les va a servir el día del parto.",
  "Encargate hoy de un trámite pendiente (obra social, licencia, turno). Sacarle un peso de encima es amor.",
  "Masajeale los pies o la espalda esta noche. El cuerpo cambia mucho y un masaje alivia de verdad.",
  "Hablá con otro papá de confianza. Compartir dudas y miedos te hace bien y te prepara mejor.",
  "Imaginá en voz alta cómo será tener a Olivia en brazos. Soñar juntos fortalece el vínculo de pareja.",
  "Dejá el celular un rato y estén presentes los dos. Estos meses de a dos no vuelven.",
  "Aprendé a poner la silla de auto antes de tiempo. El día que nazca, no querrás estar peleando con correas.",
  "Validá lo que siente tu pareja sin querer arreglarlo. A veces alcanza con 'te entiendo, estoy con vos'.",
  "Cargá la heladera con opciones sanas y fáciles. Comer bien es más simple cuando está a mano.",
  "Escribile unas líneas a Olivia hoy. Algún día va a emocionarse leyendo lo que su papá sentía.",
  "Si pueden, paseen al aire libre. Caminar suave le hace bien al cuerpo y a la cabeza de los dos.",
  "Preguntá en el control cómo va todo y anotá las respuestas. Sos parte activa de este embarazo.",
  "Armá una playlist tranquila para la panza. La música que escuchan ahora, Olivia la reconocerá después.",
  "Hacé hoy algo que le saque una sonrisa. La risa compartida también prepara para la maternidad y paternidad.",
  "Revisá las cuentas y armá un colchón para los primeros meses. La calma económica también es cuidado.",
  "Aprendé a cambiar un pañal en un muñeco o video. Llegar con la teoría sabida te da seguridad.",
  "Agradecele a tu pareja por gestar a Olivia. Es un trabajo enorme, silencioso y constante.",
  "Bajá las exigencias de la casa esta semana. Está bien que algo quede sin hacer; descansar es prioridad.",
  "Conversen sobre qué tipo de papá y mamá quieren ser. Ponerlo en palabras los alinea para lo que viene.",
  "Tené a mano agua y un snack para ella siempre. La hidratación y el azúcar estable evitan mareos.",
  "Festejá cada semana cumplida. Cada lunes que pasa, Olivia está más fuerte y más cerca.",
  "Ofrecé hacerte cargo de las visitas y avisos. Que ella solo se ocupe de descansar y de Olivia.",
  "Repasá el camino al hospital y cuánto tarda a distintas horas. La logística clara evita pánico.",
  "Mirá una foto de cuando eras bebé. Te va a conmover pensar que pronto verás esos rasgos en Olivia.",
  "Preguntale qué la asusta del parto y escuchá sin minimizar. Compartir el miedo lo vuelve más liviano.",
  "Dejá lista la ropa de recién nacido, lavada y doblada. Es un gesto concreto de que ya viene Olivia.",
  "Tomate cinco minutos para vos hoy. Cuidar al cuidador no es egoísmo, es sostenibilidad.",
  "Decile 'gracias por elegir este camino conmigo'. La gratitud renueva las fuerzas de los dos.",
  "Aprendé las señales de cuándo ir al hospital. Tener criterio claro te hace el sostén que ella necesita.",
  "Pongan una mano cada uno sobre la panza y queden en silencio un minuto. Ese trío ya existe.",
  "Anticipate: cargá nafta, cargá el teléfono, tené efectivo. Los detalles resueltos son tranquilidad.",
  "Reconocé tus propios miedos sobre ser papá. Nombrarlos te ayuda a transformarlos en preparación.",
  "Proponé una cita tranquila esta semana. Cuidar la pareja es cuidar el hogar donde llega Olivia.",
  "Cada vez que sientas una patadita, frená y disfrutá. Esos instantes son el comienzo de todo.",
];

const QUOTES = [
  "Ser papá no empieza el día que nace; empieza el día que decidís estar presente.",
  "El mejor regalo para tu hija es amar a su madre.",
  "No tenés que saberlo todo. Solo tenés que estar.",
  "La paternidad no se trata de ser perfecto, sino de aparecer todos los días.",
  "Un bebé llena un lugar en tu corazón que no sabías que estaba vacío.",
  "Las manos pequeñas se aferran a los corazones grandes.",
  "Antes de cargarla en brazos, ya la llevás en el alma.",
  "Cada patadita es una carta que Olivia te escribe desde adentro.",
  "El amor de un padre se mide en presencia, no en discursos.",
  "Vas a olvidar muchas cosas, pero nunca la primera vez que la sientas moverse.",
  "Criar es enseñar a volar mientras aprendés a soltar.",
  "Tu calma será su refugio cuando el mundo le parezca grande.",
  "Hoy sos su universo entero. Habitalo con ternura.",
  "La espera también es amor.",
  "No estás contando los días: estás haciéndolos memorables.",
  "Un padre presente vale más que mil promesas.",
  "El hogar es donde tu voz la hace sentir segura.",
  "Vas a ser fuerte por ella, y ella te enseñará una fuerza nueva.",
  "Lo que sembrás hoy en paciencia, lo cosechás mañana en confianza.",
  "La paternidad es el viaje en el que descubrís de qué estás hecho.",
];

const LESSONS = [
  /* ---- Entender el embarazo ---- */
  { cat: "Entender el embarazo", title: "Cómo se cuentan las semanas de embarazo",
    body: [
      "El embarazo se cuenta en semanas desde el primer día de la última menstruación, no desde la concepción. Por eso, cuando se habla de 40 semanas, en realidad el bebé tiene unas 38 semanas de desarrollo real.",
      "Se divide en tres trimestres: el primero (semanas 1 a 13) es de formación; el segundo (14 a 27), de crecimiento y mayor comodidad; y el tercero (28 al nacimiento), de maduración final y preparación para el parto.",
      "La 'fecha probable de parto' es una estimación: solo un 5% de los bebés nace exactamente ese día. Entre la semana 37 y la 42 se considera nacimiento a término."],
    points: ["A término: 37 a 42 semanas.", "La fecha esperada es orientativa, no exacta.", "Cada trimestre tiene su propio ritmo y desafíos."] },

  { cat: "Entender el embarazo", title: "Qué pasa en el cuerpo de tu pareja",
    body: [
      "El cuerpo materno hace un trabajo enorme: el volumen de sangre aumenta hasta un 50%, el corazón late más rápido y casi todos los órganos se adaptan para sostener al bebé. Eso explica el cansancio, los mareos y la falta de aire.",
      "Las hormonas (estrógeno, progesterona, relaxina) provocan náuseas, cambios de humor, sensibilidad y aflojamiento de las articulaciones. No son caprichos: son cambios fisiológicos reales e intensos.",
      "Entender esto te ayuda a acompañar sin minimizar. Cuando algo le molesta o la emociona de más, casi siempre hay una explicación biológica detrás."],
    points: ["El volumen de sangre sube hasta 50%.", "Las hormonas explican humor y náuseas.", "Acompañar con empatía vale más que dar soluciones."] },

  { cat: "Entender el embarazo", title: "Los movimientos del bebé: qué significan",
    body: [
      "A partir de la semana 18-22 se empiezan a sentir los movimientos. Al principio son como burbujas o aleteos; más adelante, patadas claras. Vos podrás sentirlos apoyando la mano en la panza unas semanas después.",
      "Cada bebé tiene su patrón de actividad y descanso. Olivia será más activa después de comer, con sonidos o cuando mamá se acuesta. La consistencia importa más que la cantidad.",
      "En el tercer trimestre es útil prestar atención a que se mueva con regularidad. Una disminución marcada o repentina de movimientos es motivo para consultar, no para esperar."],
    points: ["Primeros movimientos: semanas 18-22.", "Cada bebé tiene su propio ritmo.", "Menos movimientos de lo habitual = consultar."] },

  /* ---- Preparación para el parto ---- */
  { cat: "Preparación para el parto", title: "Las fases del trabajo de parto",
    body: [
      "El parto tiene tres etapas. La dilatación (la más larga) es cuando el cuello del útero se abre de 0 a 10 cm, con contracciones que se vuelven más seguidas e intensas. El expulsivo es cuando nace el bebé. El alumbramiento es la salida de la placenta.",
      "La fase inicial puede durar horas y se vive mejor en casa, con calma, hidratación y movimiento. Se va al hospital cuando las contracciones siguen la regla del 5-1-1: cada 5 minutos, de 1 minuto de duración, durante 1 hora (confirmá el criterio con tu equipo).",
      "Tu rol como papá: cronometrar contracciones, sostener la calma, ofrecer agua, masajes y palabras. Sos el ancla emocional del proceso."],
    points: ["Tres etapas: dilatación, expulsivo, alumbramiento.", "Regla orientativa 5-1-1 para ir al hospital.", "Tu trabajo: calma, logística y contención."] },

  { cat: "Preparación para el parto", title: "Contracciones reales vs. de práctica",
    body: [
      "Las contracciones de Braxton Hicks ('de práctica') aparecen desde el segundo trimestre. Son irregulares, no aumentan de intensidad y suelen ceder con reposo, cambio de posición o agua.",
      "Las contracciones de trabajo de parto son rítmicas, cada vez más frecuentes, más largas y más intensas, y no paran aunque cambie de posición. Suelen empezar en la zona baja de la espalda y envolver la panza.",
      "Ante la duda, cronometren: anoten cuándo empieza cada una y cuánto dura. Si siguen un patrón creciente, es momento de prepararse para salir."],
    points: ["Braxton Hicks: irregulares y ceden con reposo.", "Parto real: rítmicas, crecientes, no ceden.", "Cronometrar despeja la duda."] },

  { cat: "Preparación para el parto", title: "Qué llevar en el bolso del hospital",
    body: [
      "Conviene tenerlo listo desde la semana 35. Para mamá: documentos y estudios, ropa cómoda, elementos de higiene, sostén de lactancia, y ropa para volver. Para Olivia: bodies, enteritos, gorrito, medias, mantita y la primera muda según la estación.",
      "Para vos, el acompañante: cargador de celular, agua y snacks, una muda de ropa, abrigo (las salas suelen ser frías) y dinero o tarjeta. Las esperas pueden ser largas.",
      "Sumá la silla de auto ya instalada: sin ella no podrás llevar a Olivia a casa. Dejá el bolso cerca de la puerta y avisá a quién llamarás cuando llegue el momento."],
    points: ["Tené el bolso listo desde la semana 35.", "No olvides cargador, abrigo y snacks para vos.", "Silla de auto instalada antes del día D."] },

  /* ---- Cuidados del recién nacido ---- */
  { cat: "Cuidados del recién nacido", title: "Cómo cambiar un pañal, paso a paso",
    body: [
      "Tené todo a mano antes de empezar: pañal limpio, algodón o toallitas, agua tibia y muda por si acaso. Nunca dejes al bebé solo sobre el cambiador.",
      "Abrí el pañal sucio, limpiá de adelante hacia atrás (especialmente en las nenas, para prevenir infecciones), levantá las piernitas con suavidad tomando los tobillos, deslizá el pañal limpio debajo y ajustalo sin apretar: debe entrar un dedo en la cintura.",
      "Los primeros días las cacas son oscuras (meconio) y luego cambian de color. Vas a cambiar entre 8 y 12 pañales por día al principio. Es una de las formas más concretas de cuidar y vincularte con Olivia."],
    points: ["Limpiar siempre de adelante hacia atrás.", "Nunca soltar al bebé sobre el cambiador.", "8 a 12 pañales diarios las primeras semanas."] },

  { cat: "Cuidados del recién nacido", title: "El sueño del recién nacido",
    body: [
      "Los recién nacidos duermen entre 14 y 17 horas al día, pero en tramos cortos de 2 a 4 horas, sin distinguir día de noche. Esto es normal: su reloj interno todavía no madura.",
      "Para dormir seguro, seguí el ABC: el bebé solo (Alone) en su espacio, boca arriba (Back) y en cuna firme y despejada (Crib), sin almohadas, peluches ni mantas sueltas. Esto reduce el riesgo de muerte súbita.",
      "Compartir habitación (no cama) los primeros meses es recomendable. Y recordá: turnarse de noche con tu pareja no es opcional, es supervivencia del equipo."],
    points: ["Duermen 14-17 hs en tramos cortos.", "ABC del sueño seguro: solo, boca arriba, cuna firme.", "Turnarse de noche cuida a todos."] },

  { cat: "Cuidados del recién nacido", title: "Cómo calmar el llanto",
    body: [
      "El llanto es el único lenguaje del recién nacido. Repasá la lista: hambre, pañal sucio, sueño, frío o calor, o necesidad de contacto. La mayoría de las veces es algo de esto.",
      "Las '5 S' ayudan a calmar: envolver (swaddle), ponerlo de costado en brazos, sonido suave o 'shhh', mecer (swing) con movimientos suaves y ofrecer succión (chupete o pecho). Imitan el ambiente del útero.",
      "Habrá llantos que no cederán enseguida y está bien. Si te frustrás, dejá al bebé seguro en la cuna y tomate un respiro de unos minutos. Nunca lo sacudas: jamás. Pedí relevo cuando lo necesites."],
    points: ["Repasá: hambre, pañal, sueño, temperatura, contacto.", "Las 5 S imitan el útero y calman.", "Nunca sacudir al bebé; pedí relevo si te superás."] },

  { cat: "Cuidados del recién nacido", title: "Cómo sostener y cargar a tu bebé",
    body: [
      "El cuello del recién nacido no tiene fuerza: siempre hay que sostener la cabeza y el cuello con la mano o el antebrazo. Acercalo a tu pecho para que sienta tu calor y tu latido.",
      "El contacto piel con piel (también con papá) regula la temperatura, la respiración y el ritmo cardíaco del bebé, y fortalece el vínculo. No es solo cosa de mamá.",
      "Lavate las manos antes de cargarlo y sostené con firmeza tranquila. Cargar a Olivia no la 'malcría': el contacto en los primeros meses construye seguridad para toda la vida."],
    points: ["Sostené siempre cabeza y cuello.", "El piel con piel también es cosa de papá.", "El contacto temprano da seguridad, no malcría."] },

  /* ---- Lactancia y alimentación ---- */
  { cat: "Lactancia y alimentación", title: "Lo básico de la lactancia (y tu rol)",
    body: [
      "La lactancia es natural pero se aprende: los primeros días pueden ser difíciles, con dolor o dudas sobre si el bebé come bien. La clave es el buen agarre: la boca abierta abarcando gran parte de la areola, no solo el pezón.",
      "El bebé suele mamar de 8 a 12 veces por día al principio, a demanda. Señales de que come bien: moja varios pañales, sube de peso y se lo escucha tragar.",
      "Tu rol es enorme aunque no amamantes: acercar al bebé, traerle agua y comida a mamá, ocuparte de los eructos y los cambios, proteger su descanso y sostener emocionalmente. Muchas lactancias se sostienen gracias al apoyo de la pareja."],
    points: ["Buen agarre = boca abierta sobre la areola.", "8-12 tomas diarias a demanda al principio.", "Tu apoyo sostiene la lactancia, aunque no amamantes."] },

  { cat: "Lactancia y alimentación", title: "Cómo hacer eructar al bebé",
    body: [
      "Al mamar o tomar la mamadera, los bebés tragan aire que puede molestarles. Hacerlos eructar después de cada toma (y a veces en el medio) alivia los cólicos y la incomodidad.",
      "Tres posiciones clásicas: sobre tu hombro dándole palmaditas suaves en la espalda; sentado en tu regazo sosteniendo su pecho y mentón; o boca abajo sobre tu antebrazo. Probá cuál funciona mejor con Olivia.",
      "No siempre eructará, y está bien. Si no lo hace en unos minutos, podés recostarlo. Tené un paño a mano: las pequeñas regurgitaciones de leche son normales."],
    points: ["Eructar alivia cólicos y molestias.", "Probá las tres posiciones clásicas.", "Las regurgitaciones leves son normales."] },

  /* ---- Vínculo y bienestar ---- */
  { cat: "Vínculo y bienestar", title: "Cómo crear vínculo antes de que nazca",
    body: [
      "A partir de la semana 16-18, Olivia empieza a oír. Tu voz, más grave, atraviesa bien la pared abdominal: hablarle, cantarle o leerle crea un reconocimiento que se notará al nacer, cuando se calme al escucharte.",
      "Apoyar las manos en la panza, responder a sus pataditas, ponerle música o contarle tu día son formas reales de vínculo. No es simbólico: estás registrándote en su memoria.",
      "Este hábito también te prepara a vos emocionalmente para la paternidad y fortalece la complicidad con tu pareja. El vínculo no empieza en el parto: empieza ahora."],
    points: ["Olivia oye tu voz desde la semana 16-18.", "Hablar, cantar y leer crea reconocimiento real.", "El vínculo empieza en el embarazo, no en el parto."] },

  { cat: "Vínculo y bienestar", title: "Cuidar tu salud mental como papá",
    body: [
      "Se habla poco, pero hasta 1 de cada 10 padres atraviesa ansiedad o depresión en el período perinatal. Sentir miedo, abrumo o dudas sobre tu nuevo rol no te hace peor padre: te hace humano.",
      "Dormir poco, los cambios de identidad y la responsabilidad pueden pesar. Hablar con tu pareja, con otros padres o con un profesional ayuda. No te lo guardes 'para ser fuerte': la fortaleza real es pedir apoyo.",
      "Cuidarte a vos no es egoísmo. Un papá que duerme algo, come bien y se permite sentir está mucho más disponible para Olivia y para su pareja."],
    points: ["La ansiedad/depresión paterna existe y es común.", "Hablarlo es fortaleza, no debilidad.", "Cuidarte te hace mejor sostén para tu familia."] },

  { cat: "Vínculo y bienestar", title: "Sostener a tu pareja en el posparto",
    body: [
      "El posparto es una etapa intensa: dolor físico, cambios hormonales bruscos, falta de sueño y una nueva identidad. Hasta el 80% de las madres tiene 'baby blues' (tristeza y llanto) los primeros días, y algunas desarrollan depresión posparto, que requiere ayuda profesional.",
      "Tu apoyo concreto marca la diferencia: ocuparte de la casa, las comidas y las visitas, levantarte de noche, y validar lo que siente sin juzgar. Preguntale cómo está, de verdad, y prestá atención a señales de alarma.",
      "Si notás tristeza profunda y persistente, desconexión con el bebé o ideas preocupantes, buscá ayuda profesional sin demora. No es debilidad: es salud."],
    points: ["El 'baby blues' es común; la depresión posparto necesita ayuda.", "Apoyo concreto: casa, comidas, noches, escucha.", "Ante señales de alarma, consultar sin demora."] },

  /* ---- Salud y señales de alarma ---- */
  { cat: "Salud y señales de alarma", title: "Cuándo ir al hospital durante el embarazo",
    body: [
      "Hay señales que requieren consulta inmediata, sin esperar al próximo control: sangrado vaginal, pérdida de líquido (puede ser la bolsa), dolor de cabeza intenso con visión borrosa, hinchazón brusca de cara y manos, fiebre alta o dolor abdominal fuerte y persistente.",
      "En el tercer trimestre, una disminución notable de los movimientos del bebé también es motivo de consulta. Es preferible ir y que esté todo bien, que quedarse con la duda.",
      "Tené anotados los teléfonos del obstetra y del hospital, y el camino claro. Conocer estas señales te convierte en un acompañante que actúa a tiempo."],
    points: ["Alarmas: sangrado, pérdida de líquido, cefalea con visión borrosa.", "Menos movimientos en el 3° trimestre = consultar.", "Ante la duda, siempre consultar."] },

  { cat: "Salud y señales de alarma", title: "Señales de alarma en el recién nacido",
    body: [
      "Consultá al pediatra o a la guardia si Olivia tiene fiebre (37,5-38°C o más en un recién nacido es urgencia), rechaza varias tomas seguidas, está muy decaída o difícil de despertar, respira con dificultad o muy rápido, o tiene la piel u ojos muy amarillos.",
      "También son señales de atención: llanto inconsolable distinto al habitual, pocos pañales mojados (signo de deshidratación) o vómitos en chorro repetidos.",
      "Confiá en tu instinto: si algo 'no está bien', consultá. Los primeros días conviene tener a mano los teléfonos del pediatra y conocer la guardia más cercana."],
    points: ["Fiebre en un recién nacido es urgencia.", "Atención a dificultad para respirar o color amarillo.", "Si tu instinto dice que algo anda mal, consultá."] },

  { cat: "Salud y señales de alarma", title: "Primeros días en casa: qué esperar",
    body: [
      "Los primeros días son de adaptación pura. Olivia dormirá mucho, comerá seguido y llorará sin un manual. Ustedes estarán cansados y aprendiendo: es normal sentirse desbordados y no saberlo todo.",
      "Reduzcan al mínimo las visitas y las exigencias. Acepten ayuda concreta (comida, mandados) y protejan el descanso. El cordón umbilical se cae solo en 1 a 3 semanas; mantenelo limpio y seco.",
      "No comparen su bebé ni su crianza con nadie. Cada familia encuentra su ritmo. Pedir ayuda y bajar las expectativas no es fracasar: es cuidar."],
    points: ["Está bien sentirse desbordado al principio.", "Menos visitas, más descanso y ayuda concreta.", "Cada familia encuentra su propio ritmo."] },
];

const PREP = [
  { tri: "1° trimestre", text: "Elegir obstetra o partera y agendar controles" },
  { tri: "1° trimestre", text: "Comenzar suplementos (ácido fólico, hierro si indican)" },
  { tri: "1° trimestre", text: "Ecografía del primer trimestre" },
  { tri: "1° trimestre", text: "Avisar en el trabajo y averiguar licencias" },
  { tri: "2° trimestre", text: "Ecografía morfológica (semana 20)" },
  { tri: "2° trimestre", text: "Anotarse en curso de preparación para el parto" },
  { tri: "2° trimestre", text: "Definir nombre y empezar la habitación" },
  { tri: "2° trimestre", text: "Trámites de obra social / prepaga para Olivia" },
  { tri: "2° trimestre", text: "Comprar lo grande: cuna, cochecito, silla de auto" },
  { tri: "3° trimestre", text: "Test de diabetes gestacional" },
  { tri: "3° trimestre", text: "Instalar y probar la silla de auto" },
  { tri: "3° trimestre", text: "Armar el bolso del hospital (mamá, bebé y papá)" },
  { tri: "3° trimestre", text: "Lavar y guardar la ropita de recién nacido" },
  { tri: "3° trimestre", text: "Escribir el plan de parto y repasarlo con el equipo" },
  { tri: "3° trimestre", text: "Definir el camino al hospital y a quién llamar" },
  { tri: "3° trimestre", text: "Cocinar y congelar comidas para las primeras semanas" },
  { tri: "3° trimestre", text: "Inscribir cobertura médica y documentos listos" },
];
