import { LEGAL_INFO } from "@jurmaq/shared/seo";

/**
 * REFERENCE ONLY — not loaded at runtime.
 *
 * La fuente de verdad del template legal vive en la tabla `contratos_templates`
 * de Supabase, gestionada desde /admin/contratos/templates. El renderer en
 * `lib/contrato-render.ts` recibe el HTML como string desde DB, no desde acá.
 *
 * Este archivo se conserva en el repo como:
 *   - Source-of-truth legal del wording original
 *   - Referencia para futuros refactors o auditorías legales
 *   - Plantilla seed si se necesita repoblar la tabla en otro entorno
 *
 * NO ELIMINAR sin antes (1) confirmar que la tabla DB ya tiene el contenido,
 * y (2) registrar la versión legal validada en otro lugar trazable.
 *
 * Template legal de contrato de arriendo de maquinaria para JURMAQ.
 *
 * Diseñado para ser procesado con un motor de plantillas tipo Handlebars/Mustache.
 * Usa placeholders `{{variable}}` y condicionales `{{#if ...}}...{{else}}...{{/if}}`.
 *
 * Marco legal aplicable:
 *   - Código Civil de Chile, arts. 1915 a 1941 (contrato de arrendamiento de cosas).
 *   - Código Civil, arts. 44 y 45 (culpa y caso fortuito / fuerza mayor).
 *   - Ley N° 19.799 sobre Documentos Electrónicos, Firma Electrónica y Servicios de Certificación.
 *   - Ley N° 18.010 sobre operaciones de crédito de dinero (interés máximo convencional).
 *   - Ley N° 19.496 sobre Protección de los Derechos de los Consumidores (cuando el arrendatario sea consumidor final).
 *   - Ley N° 18.290 de Tránsito (arts. 169 y sgtes. — responsabilidad solidaria del propietario).
 *   - Ley N° 18.490 sobre Seguro Obligatorio de Accidentes Personales (SOAP).
 *   - Ley N° 16.744 sobre Accidentes del Trabajo y Enfermedades Profesionales.
 *   - Ley N° 19.628 sobre Protección de la Vida Privada y Ley N° 21.719 (2024) que moderniza
 *     el régimen de protección de datos personales en Chile.
 *   - Ley N° 20.393 sobre Responsabilidad Penal de las Personas Jurídicas (delitos de cohecho,
 *     lavado de activos, financiamiento del terrorismo, receptación, entre otros).
 *   - Código del Trabajo, art. 183-A y siguientes (subcontratación y suministro de trabajadores).
 *
 * Para obtener el HTML final listo para firmar o imprimir, se debe compilar esta
 * cadena con los datos del contrato correspondiente.
 */

export const DEFAULT_CONTRATO_TEMPLATE: string = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contrato de Arriendo de Maquinaria {{numero_contrato}}</title>
  <style>
    /* Estilos base orientados a impresión A4 y visualización en pantalla */
    @page {
      size: A4;
      margin: 20mm 18mm 22mm 18mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #f4f4f5;
      color: #111827;
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 11.5pt;
      line-height: 1.55;
    }
    .page {
      max-width: 210mm;
      min-height: 297mm;
      margin: 16px auto;
      padding: 22mm 20mm;
      background: #ffffff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    @media print {
      html, body { background: #ffffff; }
      .page { box-shadow: none; margin: 0; padding: 0; min-height: auto; }
      .page-break { page-break-before: always; }
      .no-print { display: none !important; }
    }
    /* Cabecera */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 18px;
    }
    .header .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header .brand img {
      height: 52px;
      width: auto;
    }
    .header .brand .name {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      font-size: 13pt;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .header .brand .sub {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #475569;
    }
    .header .meta {
      text-align: right;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #334155;
    }
    .header .meta strong { color: #0f172a; }
    /* Tipografía */
    h1.contract-title {
      text-align: center;
      font-size: 15pt;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin: 6px 0 4px 0;
    }
    h2.section-title {
      font-size: 11.5pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin: 18px 0 6px 0;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 3px;
    }
    h3.clause-title {
      font-size: 11pt;
      margin: 14px 0 4px 0;
    }
    p { margin: 6px 0; text-align: justify; }
    ul, ol { margin: 6px 0 6px 20px; padding: 0; }
    li { margin: 3px 0; text-align: justify; }
    .center { text-align: center; }
    .small { font-size: 9.5pt; color: #475569; }
    .muted { color: #475569; }
    .bold { font-weight: 700; }
    /* Tablas de datos e inventario */
    table.data {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0 10px 0;
      font-size: 10.5pt;
    }
    table.data th, table.data td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      vertical-align: top;
      text-align: left;
    }
    table.data th {
      background: #f1f5f9;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      width: 32%;
    }
    /* Firmas */
    .signatures {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-top: 36px;
    }
    .signature-box {
      width: 48%;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #0f172a;
      margin-top: 80px;
      padding-top: 6px;
    }
    .signature-box .role {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .signature-box .name { font-size: 10.5pt; margin-top: 2px; }
    .signature-box .rut { font-size: 10pt; color: #334155; }
    /* Metadatos de firma electrónica */
    .e-sign {
      margin-top: 26px;
      border: 1px dashed #94a3b8;
      padding: 10px 12px;
      font-family: "Courier New", Courier, monospace;
      font-size: 9pt;
      color: #334155;
      background: #f8fafc;
      word-break: break-all;
    }
    .e-sign .e-title {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      font-size: 9.5pt;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .footer-note {
      margin-top: 14px;
      font-size: 8.5pt;
      color: #64748b;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }
    /* Utilidades Tailwind-like para quien compile con Tailwind */
    .rounded-md { border-radius: 6px; }
    .bg-slate-50 { background: #f8fafc; }
  </style>
</head>
<body>
  <div class="page">

    <!-- ============ CABECERA / ENCABEZADO ============ -->
    <header class="header">
      <div class="brand">
        <img src="https://jurmaq.cl/images/logo-jurmaq.png" alt="JURMAQ Constructora" width="104" height="52" />
        <div>
          <div class="name">Constructora Jorge Ubilla Rivera E.I.R.L.</div>
          <div class="sub">JURMAQ &middot; Arriendo de maquinaria y materiales de construcción</div>
          <div class="sub">RUT 76.624.872-1 &middot; ${LEGAL_INFO.brands.constructora.direccionLegal}</div>
          <div class="sub">Teléfono +56 9 7667 3577 &middot; contacto@jurmaq.cl</div>
        </div>
      </div>
      <div class="meta">
        <div><strong>Contrato N°</strong><br/>{{numero_contrato}}</div>
        <div style="margin-top:6px;"><strong>Fecha</strong><br/>{{fecha_contrato}}</div>
        <div style="margin-top:6px;"><strong>Ciudad</strong><br/>{{ciudad_contrato}}</div>
      </div>
    </header>

    <h1 class="contract-title">Contrato de Arriendo de Maquinaria</h1>
    <p class="center small">Celebrado conforme a los artículos 1915 y siguientes del Código Civil de la República de Chile</p>

    <!-- ============ COMPARECENCIA ============ -->
    <h2 class="section-title">Comparecencia</h2>
    <p>
      En la ciudad de <strong>{{ciudad_contrato}}</strong>, con fecha <strong>{{fecha_contrato}}</strong>,
      entre las partes que a continuación se individualizan, se celebra el presente Contrato de Arriendo de
      Maquinaria, que se regirá por las cláusulas que más adelante se expresan y, en lo no previsto en ellas,
      por las disposiciones del Título XXVI del Libro IV del Código Civil chileno y demás normativa aplicable.
    </p>

    <h3 class="clause-title">1. Del Arrendador</h3>
    <p>
      Comparece por una parte <strong>Constructora Jorge Ubilla Rivera E.I.R.L.</strong>, empresa
      individual de responsabilidad limitada del giro de su denominación, Rol Único Tributario
      <strong>76.624.872-1</strong>, con domicilio en <em>${LEGAL_INFO.brands.constructora.direccionLegal}</em>, representada legalmente por don <strong>Jorge Ubilla Rivera</strong>,
      en adelante e indistintamente "<strong>el Arrendador</strong>" o "<strong>JURMAQ</strong>".
    </p>

    <h3 class="clause-title">2. Del Arrendatario</h3>
    {{#if es_natural}}
    <p>
      Y por la otra parte, don(ña) <strong>{{arrendatario_nombre}}</strong>, cédula nacional de identidad
      N° <strong>{{arrendatario_rut}}</strong>{{#if arrendatario_profesion}}, de profesión u oficio
      {{arrendatario_profesion}}{{/if}}, con domicilio en <em>{{arrendatario_domicilio}}</em>, teléfono de
      contacto {{arrendatario_telefono}} y correo electrónico {{arrendatario_email}}, en adelante
      "<strong>el Arrendatario</strong>".
    </p>
    {{else}}
    <p>
      Y por la otra parte, la sociedad <strong>{{arrendatario_razon_social}}</strong>, Rol Único Tributario
      <strong>{{arrendatario_rut}}</strong>, del giro <em>{{arrendatario_giro}}</em>, con domicilio en
      <em>{{arrendatario_domicilio}}</em>, representada legalmente por don(ña)
      <strong>{{arrendatario_rep_legal}}</strong>, cédula nacional de identidad N°
      <strong>{{arrendatario_rep_rut}}</strong>, cuyas facultades de representación se entienden vigentes y
      suficientes para la celebración del presente contrato, teléfono de contacto
      {{arrendatario_telefono}} y correo electrónico {{arrendatario_email}}, en adelante
      "<strong>el Arrendatario</strong>".
    </p>
    {{/if}}
    <p>
      El Arrendador y el Arrendatario, en conjunto, se denominarán "<strong>las Partes</strong>"; y
      cada una de ellas indistintamente una "<strong>Parte</strong>".
    </p>

    <!-- ============ CONSIDERANDOS ============ -->
    <h2 class="section-title">Considerandos</h2>
    <p>
      <strong>Primero.</strong> Que el Arrendador es propietario o tenedor legítimo del bien mueble que más
      adelante se individualiza, y se dedica profesionalmente al arriendo de maquinaria y equipos para la
      construcción y actividades conexas.
    </p>
    <p>
      <strong>Segundo.</strong> Que el Arrendatario requiere del uso temporal de dicho bien para los fines
      propios de su actividad, manifestando conocer su naturaleza, destino, condiciones técnicas y de
      operación.
    </p>
    <p>
      <strong>Tercero.</strong> Que, en virtud de lo anterior, las Partes han convenido celebrar el presente
      contrato de arrendamiento, el cual se regirá por las cláusulas que a continuación se estipulan.
    </p>

    <!-- ============ CLÁUSULAS ============ -->
    <h2 class="section-title">Cláusulas</h2>

    <!-- ===== PRIMERA ===== -->
    <h3 class="clause-title">Primera. Objeto del Contrato</h3>
    <p>
      Por el presente instrumento, el Arrendador da en arriendo al Arrendatario, quien acepta para sí,
      el bien mueble consistente en maquinaria cuyas características son las siguientes:
    </p>
    <table class="data" aria-label="Identificación de la maquinaria arrendada">
      <tbody>
        <tr><th>Denominación</th><td>{{maquinaria_nombre}}</td></tr>
        <tr><th>Marca</th><td>{{maquinaria_marca}}</td></tr>
        <tr><th>Modelo</th><td>{{maquinaria_modelo}}</td></tr>
        <tr><th>Número de serie</th><td>{{maquinaria_serie}}</td></tr>
        <tr><th>Año de fabricación</th><td>{{maquinaria_anio}}</td></tr>
        <tr><th>Descripción y accesorios</th><td>{{maquinaria_descripcion}}</td></tr>
      </tbody>
    </table>
    <p>
      El Arrendador declara que la maquinaria objeto del presente contrato se entrega en buen estado
      operativo, apta para su uso conforme a su destino natural, con la documentación técnica y legal al
      día en cuanto resulte aplicable (manual de uso, permiso de circulación y revisión técnica si
      corresponde), sin perjuicio de lo dispuesto en la cláusula Octava. El Arrendatario reconoce haber
      inspeccionado la maquinaria con anterioridad a la suscripción de este contrato, o bien, declara
      conocer sus características y aceptarla en las condiciones indicadas en el acta de entrega.
    </p>

    <!-- ===== SEGUNDA ===== -->
    <h3 class="clause-title">Segunda. Plazo</h3>
    <p>
      El presente contrato tendrá una duración de <strong>{{dias_arriendo}} día(s)</strong>, iniciándose
      el <strong>{{fecha_inicio}}</strong> y terminando el <strong>{{fecha_termino}}</strong>, fecha esta
      última en la cual el Arrendatario deberá restituir la maquinaria en los términos establecidos en la
      cláusula Undécima.
    </p>
    <p>
      El plazo antes indicado sólo podrá ser prorrogado o renovado por acuerdo escrito y expreso de ambas
      Partes, suscrito con una anticipación mínima de 48 horas al vencimiento original. La mera tolerancia
      del Arrendador frente a una restitución tardía no importará renovación tácita del contrato, aplicándose
      en tal caso lo dispuesto en la cláusula Undécima.
    </p>

    <!-- ===== TERCERA ===== -->
    <h3 class="clause-title">Tercera. Precio y Forma de Pago</h3>
    <p>
      El precio del arrendamiento se pacta sobre la base de <strong>{{precio_unidad}}</strong>, ascendiendo
      a la suma de <strong>$ {{precio_por_unidad}}</strong> (pesos chilenos) por cada {{precio_unidad}} de
      uso, lo que determina un precio total por la totalidad del plazo contratado ascendente a
      <strong>$ {{precio_total}}</strong> (<em>{{precio_total_letras}}</em>), monto que se entenderá
      expresado en pesos chilenos y no incluye, en caso de corresponder, el Impuesto al Valor Agregado,
      el que se facturará separadamente conforme a la normativa tributaria vigente.
    </p>
    <p>
      El pago se efectuará en dinero efectivo, mediante transferencia electrónica a la cuenta bancaria que
      el Arrendador indique, o por cualquier otro medio de pago que las Partes acepten, con carácter
      anticipado respecto del inicio del período contratado, salvo pacto escrito en contrario consignado en
      las observaciones. La garantía a que se refiere la cláusula Cuarta es independiente del precio.
    </p>
    <p>
      La mora o simple retardo en el pago de cualquier suma adeudada bajo este contrato devengará, desde
      la fecha de incumplimiento y hasta la del pago efectivo, el <strong>interés máximo convencional
      aplicable a operaciones de crédito de dinero no reajustables</strong>, conforme a la Ley N° 18.010,
      sin necesidad de requerimiento judicial previo y sin perjuicio de las demás acciones contractuales o
      legales que asistan al Arrendador.
    </p>

    <!-- ===== CUARTA ===== -->
    <h3 class="clause-title">Cuarta. Garantía o Depósito</h3>
    <p>
      Al momento de la entrega de la maquinaria, el Arrendatario constituirá en favor del Arrendador una
      garantía en dinero por la suma de <strong>$ {{garantia_monto}}</strong>
      (<em>{{garantia_monto_letras}}</em>), la cual podrá rendirse mediante transferencia electrónica a la
      cuenta que se indique, cheque nominativo, pagaré, depósito en efectivo, o pre-autorización en tarjeta
      de crédito según el método acordado entre las partes.
    </p>
    <p>
      Esta garantía tiene por objeto caucionar el cumplimiento de todas y cada una de las obligaciones que
      el presente contrato impone al Arrendatario, incluyendo, sin que la enumeración sea taxativa: el pago
      íntegro y oportuno del precio, el resarcimiento de daños o deterioros distintos del desgaste natural
      por uso normal, el pago de multas por restitución tardía, y los gastos de limpieza, reparación o
      reposición de accesorios y combustible.
    </p>
    {{garantia_klap_clausula}}
    <p>
      Dentro de los diez (10) días hábiles siguientes a la restitución conforme de la maquinaria y previa
      inspección y firma del acta de devolución, el Arrendador restituirá al Arrendatario el saldo de la
      garantía, una vez efectuados los descuentos que procedan por los conceptos antes señalados. En el
      caso de garantías constituidas mediante pre-autorización de tarjeta de crédito, dicha restitución
      operará por la cancelación de la retención (hold) o, en su caso, la captura parcial del monto del
      daño con liberación del saldo, sin requerir nueva intervención del Arrendatario. El Arrendador
      entregará al Arrendatario un detalle escrito de cualquier deducción, con los respaldos
      correspondientes.
    </p>

    <!-- ===== QUINTA ===== -->
    <h3 class="clause-title">Quinta. Entrega</h3>
    <p>
      La entrega material de la maquinaria se efectuará el día <strong>{{fecha_inicio}}</strong> en el
      domicilio ubicado en <strong>{{direccion_entrega}}</strong>. En dicho acto las Partes suscribirán un
      <em>acta de entrega</em> que contendrá, a lo menos: (i) inventario de la maquinaria y sus
      accesorios; (ii) estado general, horómetro o kilometraje cuando aplique; (iii) nivel de combustible;
      (iv) registro fotográfico que se entenderá parte integrante del acta; y (v) observaciones particulares.
    </p>
    <p>
      Los gastos de transporte de ida y vuelta de la maquinaria serán de cargo del Arrendatario, salvo
      pacto expreso en contrario que conste en el campo de observaciones del presente contrato. El traslado
      se efectuará adoptando las medidas de seguridad pertinentes, siendo responsable quien asume dichos
      costos por los daños ocurridos durante el respectivo transporte.
    </p>

    <!-- ===== SEXTA ===== -->
    <h3 class="clause-title">Sexta. Uso y Operación de la Maquinaria</h3>
    {{#if con_operador}}
    <p>
      El arriendo se contrata <strong>con operador</strong> proporcionado por el Arrendador. Para estos
      efectos, don(ña) <strong>{{operador_nombre}}</strong> se desempeñará como operador de la maquinaria.
      Se deja expresa constancia que dicho operador es <em>dependiente exclusivo del Arrendador</em>, quien
      asume respecto de él todas las obligaciones laborales, previsionales, tributarias y de seguridad
      social, incluyendo remuneraciones, cotizaciones previsionales y de salud, seguro de la Ley N° 16.744
      sobre Accidentes del Trabajo y Enfermedades Profesionales, feriados, indemnizaciones por término de
      contrato y toda otra obligación que emane del Código del Trabajo y legislación complementaria.
    </p>
    <p>
      <strong>No existe entre el operador y el Arrendatario vínculo alguno de subordinación, dependencia
      ni relación laboral, de suministro o subcontratación en los términos de los artículos 183-A y
      siguientes del Código del Trabajo.</strong> El Arrendatario no podrá impartir órdenes directas sobre
      cumplimiento de jornada, remuneración o disciplina laboral al operador, limitándose a indicarle el
      frente de obra, la tarea específica y las condiciones técnicas del trabajo encomendado.
    </p>
    <p>
      <strong>Indemnidad laboral.</strong> El Arrendador se obliga a mantener indemne al Arrendatario
      frente a cualquier acción, demanda, reclamación administrativa o sanción de autoridad laboral,
      previsional o tributaria que el operador u organismos competentes pudieran dirigir en su contra con
      motivo de la relación laboral entre el Arrendador y el operador, asumiendo íntegramente los costos,
      honorarios profesionales y eventuales condenas que de ello deriven, dentro del plazo de diez (10)
      días hábiles desde la respectiva notificación.
    </p>
    <p>
      La jornada de trabajo del operador se ajustará a la jornada ordinaria de trabajo vigente en Chile y
      a la Ley laboral aplicable, considerándose los descansos correspondientes. Cualquier requerimiento
      de horas extraordinarias, trabajos en días festivos o jornadas nocturnas deberá ser acordado
      previamente y por escrito, pudiendo implicar un recargo sobre la tarifa pactada.
    </p>
    <p>
      El Arrendador responderá por los hechos u omisiones del operador en el ejercicio técnico de sus
      funciones. No obstante, el Arrendatario deberá: (i) proporcionar al operador condiciones seguras
      de trabajo conforme al D.S. 594 sobre condiciones sanitarias y ambientales mínimas; (ii) habilitar
      un frente de obra adecuado, con accesos y niveles estables; (iii) entregar las instrucciones
      técnicas pertinentes al trabajo a ejecutar; (iv) poner a disposición elementos de protección
      personal colectivos propios de la faena (señalética, cercos, vigía); y (v) abastecer el combustible,
      lubricantes y consumibles menores, salvo pacto en contrario. El incumplimiento de estos deberes por
      el Arrendatario que cause perjuicio al operador o a la maquinaria será de su cargo exclusivo.
    </p>
    {{else}}
    <p>
      El arriendo se contrata <strong>sin operador</strong>. En consecuencia, el Arrendatario deberá
      operar la maquinaria por sí mismo o a través de dependientes suyos que cuenten con la licencia,
      certificación o autorización habilitante que la normativa aplicable exija, y con la capacitación
      técnica necesaria para su correcto manejo.
    </p>
    <p>
      El Arrendatario declara expresamente conocer el modo de operación de la maquinaria, sus riesgos
      inherentes y las precauciones de seguridad correspondientes, asumiendo toda responsabilidad civil,
      administrativa y, en general, de cualquier índole, que derive del uso, operación o manejo de la
      misma por él o por sus dependientes. En particular, responderá por los daños causados a la maquinaria,
      a terceros o al medio ambiente por mal uso, negligencia, imprudencia, impericia o inobservancia de
      las instrucciones del fabricante o del Arrendador. El combustible, lubricantes y consumibles menores
      serán de cargo exclusivo del Arrendatario.
    </p>
    {{/if}}

    <!-- ===== SÉPTIMA ===== -->
    <h3 class="clause-title">Séptima. Obligaciones del Arrendatario</h3>
    <p>Serán obligaciones del Arrendatario, sin perjuicio de las demás que emanen del presente contrato o de la ley:</p>
    <ol>
      <li>Usar la maquinaria con el cuidado de un buen padre de familia, conforme a su destino natural y a las indicaciones técnicas que hubiere recibido del Arrendador o del fabricante.</li>
      <li>Destinar la maquinaria exclusivamente a los fines propios de su giro y al tipo de trabajo para el cual ha sido diseñada, quedando estrictamente prohibido darle un uso distinto.</li>
      <li>Proporcionar el combustible, lubricantes y consumibles menores necesarios para su operación, salvo pacto expreso en contrario.</li>
      <li>Mantener la maquinaria en las mismas condiciones en que le fue entregada, salvo el desgaste natural proveniente de su uso legítimo.</li>
      <li>Comunicar al Arrendador, por escrito y a la brevedad, cualquier desperfecto, daño, siniestro, robo o circunstancia que afecte o pudiere afectar a la maquinaria, dentro de un plazo no superior a veinticuatro (24) horas desde ocurrido el hecho.</li>
      <li>No ceder, subarrendar, prestar, entregar en comodato ni traspasar, a cualquier título, el uso o la tenencia de la maquinaria, sin autorización previa y escrita del Arrendador.</li>
      <li>Permitir al Arrendador y a las personas por él designadas inspeccionar la maquinaria en cualquier momento razonable durante la vigencia del contrato.</li>
      <li>Pagar oportunamente el precio pactado y las demás sumas que se devenguen conforme a este contrato.</li>
      <li>Restituir la maquinaria al término del contrato en la forma prevista en la cláusula Undécima.</li>
      <li>Cumplir toda la normativa laboral, de seguridad, tributaria, ambiental y administrativa aplicable al uso de la maquinaria en la faena respectiva.</li>
    </ol>

    <!-- ===== OCTAVA ===== -->
    <h3 class="clause-title">Octava. Obligaciones del Arrendador</h3>
    <p>Serán obligaciones del Arrendador, sin perjuicio de las demás que emanen del presente contrato o de la ley:</p>
    <ol>
      <li>Entregar la maquinaria al Arrendatario en buen estado operativo, con sus elementos y accesorios esenciales, apta para el uso convenido.</li>
      <li>Garantizar al Arrendatario el uso pacífico de la maquinaria durante la vigencia del contrato, salvo los casos en que proceda la terminación anticipada conforme a la cláusula Decimotercera.</li>
      <li>Mantener al día la documentación técnica y legal de la maquinaria que resulte exigible, tales como permiso de circulación y revisión técnica cuando corresponda.</li>
      <li>Responder por los vicios o defectos ocultos de la maquinaria existentes al momento de la entrega, conforme a lo dispuesto en los artículos 1932 y siguientes del Código Civil.</li>
      <li>Asumir, conforme a la cláusula Novena, la mantención preventiva que corresponda.</li>
    </ol>

    <!-- ===== NOVENA ===== -->
    <h3 class="clause-title">Novena. Mantenimiento y Reparaciones</h3>
    <p>
      Cuando el plazo total del arriendo supere los treinta (30) días corridos, el Arrendador será
      responsable de efectuar la <strong>mantención preventiva</strong> que corresponda según las pautas del
      fabricante (cambios de aceite, filtros y revisiones programadas), coordinando con el Arrendatario las
      ventanas de tiempo para su ejecución, procurando no afectar la continuidad de las faenas.
    </p>
    <p>
      Las reparaciones originadas en el desgaste natural o en el uso normal y diligente de la maquinaria
      serán de cargo exclusivo del Arrendador. En cambio, toda reparación, reposición de piezas, repuestos,
      accesorios o gasto extraordinario que resulte del mal uso, negligencia, imprudencia, impericia, dolo
      o cualquier otra causa imputable al Arrendatario, a sus dependientes o a personas bajo su cuidado o
      dirección, será de su cargo exclusivo, pudiendo el Arrendador imputar dichos montos a la garantía
      pactada en la cláusula Cuarta o exigir su pago directo.
    </p>
    <p>
      Queda estrictamente prohibido al Arrendatario realizar modificaciones, alteraciones o reparaciones
      sustantivas por cuenta propia, salvo aquellas de emergencia indispensables para evitar un mal mayor,
      las que deberán ser inmediatamente informadas y documentadas al Arrendador.
    </p>

    <!-- ===== DÉCIMA ===== -->
    <h3 class="clause-title">Décima. Seguros</h3>
    <p>
      <strong>10.1. Seguro de Responsabilidad Civil del Arrendador.</strong> El Arrendador mantendrá, por
      su cuenta y cargo, un seguro que ampare la maquinaria objeto de este contrato, cuya cobertura y
      condiciones se ajustarán a las prácticas habituales del mercado y a las exigencias de la póliza
      respectiva. El Arrendador exhibirá al Arrendatario, a requerimiento escrito de éste, copia vigente
      de dicha póliza.
    </p>
    <p>
      <strong>10.2. Seguro Obligatorio de Accidentes Personales (SOAP) — Ley N° 18.490.</strong> Tratándose
      de maquinaria que, por su naturaleza o por las necesidades de la faena, deba circular por vías
      públicas o caminos abiertos al tránsito público, el Arrendador mantendrá vigente el Seguro Obligatorio
      de Accidentes Personales (SOAP) conforme a la Ley N° 18.490. Dicho seguro cubre exclusivamente los
      daños personales de víctimas de accidentes de tránsito en los términos de dicha ley, sin cubrir daños
      a cosas, lucro cesante ni daño moral, los cuales se regirán por los seguros complementarios o por
      las cláusulas del presente contrato.
    </p>
    <p>
      <strong>10.3. Seguro de Responsabilidad Civil de Obra a cargo del Arrendatario.</strong> El
      Arrendatario se obliga a contratar y mantener vigente, durante toda la vigencia del contrato y
      mientras la maquinaria permanezca en su poder, un <strong>seguro de responsabilidad civil de obra
      o faena</strong> que cubra daños a terceros (personas y bienes) derivados del uso, operación,
      permanencia o traslado de la maquinaria, por un monto asegurado no inferior a
      <strong>UF {{seguro_rc_obra_uf_min}}</strong> por evento y por vigencia. El Arrendatario exhibirá
      copia de la póliza y de sus pagos al Arrendador dentro de los cinco (5) días hábiles siguientes a
      la entrega de la maquinaria, siendo causal de terminación anticipada la falta de contratación o
      mantención de esta cobertura.
    </p>
    <p>
      <strong>10.4. Deducible y exclusiones.</strong> En caso de siniestro atribuible en todo o en parte
      al uso o actuación del Arrendatario, sus dependientes o terceros bajo su responsabilidad, el
      Arrendatario responderá por el <strong>monto del deducible</strong> contemplado en la póliza
      respectiva, así como por aquellos daños o costos que sean excluidos de la cobertura por causa
      imputable a su actuación u omisión (operación fuera de especificaciones, conducción sin licencia
      habilitante, ebriedad o influencia de estupefacientes, uso en actividades ilícitas, incumplimiento
      de normas de seguridad de la obra, entre otras). Lo anterior es sin perjuicio de las acciones de
      subrogación que pudiere ejercer la compañía aseguradora en contra del Arrendatario.
    </p>

    <!-- ===== DÉCIMA BIS: LEY DE TRÁNSITO ===== -->
    <h3 class="clause-title">Décima Bis. Responsabilidad Civil por Circulación en Vía Pública (Ley N° 18.290)</h3>
    <p>
      Las Partes reconocen expresamente que, conforme a los <strong>artículos 169 y siguientes de la
      Ley N° 18.290 de Tránsito</strong>, el propietario del vehículo o maquinaria es <em>solidariamente
      responsable</em> con el conductor por los daños y perjuicios que éste cause en accidentes del
      tránsito, salvo que acredite que la maquinaria fue usada contra su voluntad.
    </p>
    <p>
      En atención a que el presente contrato confiere al Arrendatario el uso y tenencia material de la
      maquinaria, las Partes acuerdan, <strong>en el plano estrictamente contractual y sin afectar los
      derechos de terceros</strong>, que el Arrendatario asume frente al Arrendador la obligación de
      reembolsar e indemnizar íntegramente toda suma que éste se viera obligado a pagar a terceros con
      motivo de accidentes de tránsito ocurridos durante la vigencia del contrato y por causa imputable
      al Arrendatario, a sus dependientes, al conductor u operador designado por él, incluyendo capital,
      intereses, reajustes, costas procesales y honorarios profesionales.
    </p>
    <p>
      El Arrendatario se obliga a conducir u operar la maquinaria únicamente por personas mayores de edad
      que posean la <strong>licencia de conducir clase correspondiente</strong> (clase D o la que exija la
      normativa para maquinaria automotriz no sujeta a matrícula), en estado de sobriedad y en
      cumplimiento estricto de las normas de tránsito, de seguridad vial y de las restricciones de
      circulación aplicables.
    </p>

    <!-- ===== DÉCIMA TER: TRANSPORTE EN VÍA PÚBLICA ===== -->
    <h3 class="clause-title">Décima Ter. Transporte de la Maquinaria en Vía Pública</h3>
    <p>
      Todo traslado de la maquinaria por vías públicas, cuando sea necesario, se sujetará a las
      disposiciones del Ministerio de Obras Públicas, de la Dirección de Vialidad y del Ministerio de
      Transportes y Telecomunicaciones, en particular respecto de:
    </p>
    <ol>
      <li><strong>Permisos de circulación para cargas sobredimensionadas o sobrepeso</strong> emitidos por la Dirección de Vialidad (DV), cuando la maquinaria o su transporte exceda los límites legales de peso, alto, ancho o largo.</li>
      <li><strong>Escolta vehicular (vehículo piloto o policial)</strong> cuando la normativa lo exija en función de las dimensiones o de la ruta autorizada.</li>
      <li><strong>Señalización, banderolas y luces</strong> en el vehículo de transporte y en la carga, conforme a la reglamentación vigente.</li>
      <li><strong>Restricciones horarias, de ruta y de días inhábiles</strong> establecidas en los permisos o por autoridad competente.</li>
      <li><strong>Pesaje y documentación</strong> (guía de despacho, permiso, póliza de transporte) disponible ante fiscalización.</li>
    </ol>
    <p>
      Salvo pacto escrito en contrario, la <strong>gestión, tramitación y costo</strong> de los permisos,
      escoltas y seguros de transporte serán de cargo de la Parte que, conforme a la cláusula Quinta,
      asuma el costo del traslado respectivo. La Parte responsable del traslado responderá asimismo por
      las multas e infracciones, daños a la infraestructura vial, daños a terceros y daños a la propia
      maquinaria durante el transporte.
    </p>

    <!-- ===== UNDÉCIMA ===== -->
    <h3 class="clause-title">Undécima. Devolución y Restitución</h3>
    <p>
      Al vencimiento del plazo pactado, y a más tardar el día <strong>{{fecha_termino}}</strong>, el
      Arrendatario deberá restituir la maquinaria en <strong>{{direccion_retiro}}</strong>, en el mismo
      estado en que la recibió, salvo el desgaste natural por uso normal, con la totalidad de sus
      accesorios, manuales, elementos de seguridad y documentación.
    </p>
    <p>
      En el acto de restitución, las Partes suscribirán un <em>acta de devolución</em>, con inventario,
      registro fotográfico y eventuales observaciones. Sólo desde la firma del acta se entenderá
      jurídicamente restituida la maquinaria.
    </p>
    <p>
      La restitución efectuada con posterioridad a la fecha pactada, sin prórroga escrita, dará derecho al
      Arrendador a cobrar, a título de <strong>multa por restitución tardía</strong>, una suma diaria
      equivalente al <strong>cincuenta por ciento (50%) adicional</strong> del valor por día aplicable
      según la cláusula Tercera, sin perjuicio del pago del arriendo correspondiente a esos días y de la
      indemnización de los daños y perjuicios que la tardanza hubiere ocasionado al Arrendador o a
      terceros.
    </p>

    <!-- ===== DUODÉCIMA ===== -->
    <h3 class="clause-title">Duodécima. Daños y Responsabilidad</h3>
    <p>
      El Arrendatario será responsable de todo daño, deterioro, menoscabo, pérdida o destrucción, total o
      parcial, que experimente la maquinaria durante la vigencia del contrato por causa imputable a él, a
      sus dependientes o a personas bajo su cuidado o dirección, respondiendo hasta de la culpa leve de
      conformidad con el artículo 44 del Código Civil.
    </p>
    <p>
      En caso de <strong>destrucción total, pérdida, hurto o robo</strong> de la maquinaria, el
      Arrendatario deberá pagar al Arrendador, dentro de los diez (10) días corridos siguientes a la
      ocurrencia o constatación del hecho, el <strong>valor comercial de reposición</strong> de una
      maquinaria de idénticas o equivalentes características, marca, modelo, año y estado, debidamente
      acreditado mediante cotizaciones formales. Lo anterior sin perjuicio del deducible y de los montos
      que cubra el seguro a que se refiere la cláusula Décima.
    </p>
    <p>
      El Arrendatario será, asimismo, responsable de los daños que la maquinaria, por su operación o por
      hechos de sus dependientes, cause a terceros o a bienes de éstos, debiendo mantener indemne al
      Arrendador frente a cualquier acción, reclamo, demanda o sanción que le sea dirigida con motivo de
      dichos hechos.
    </p>

    <!-- ===== DECIMOTERCERA ===== -->
    <h3 class="clause-title">Decimotercera. Terminación Anticipada</h3>
    <p>
      El Arrendador podrá poner término anticipado al presente contrato, mediante aviso escrito dirigido
      al Arrendatario con una anticipación mínima de <strong>cuarenta y ocho (48) horas</strong>, sin
      necesidad de declaración judicial previa, en cualquiera de los siguientes casos:
    </p>
    <ol>
      <li>Incumplimiento por parte del Arrendatario de cualquiera de las obligaciones contraídas en virtud del presente contrato.</li>
      <li>Mora o simple retardo en el pago del precio u otras sumas adeudadas por un período superior a diez (10) días corridos.</li>
      <li>Uso de la maquinaria en actividades distintas de aquellas para las cuales ha sido diseñada, o en infracción a la ley o a las instrucciones del Arrendador.</li>
      <li>Cesión, subarriendo o entrega no autorizada del uso o tenencia de la maquinaria a un tercero.</li>
      <li>Deterioro grave, abandono o exposición injustificada de la maquinaria a situaciones de riesgo.</li>
      <li>Declaración de quiebra, solicitud de reorganización o liquidación concursal del Arrendatario.</li>
      <li>Cualquier otra causal que las leyes chilenas contemplen como motivo para la terminación del arrendamiento.</li>
    </ol>
    <p>
      La terminación anticipada por causa imputable al Arrendatario no dará derecho alguno a éste para
      exigir la devolución total o parcial de los pagos ya efectuados, los que se entenderán abonados en
      concepto de avaluación anticipada de los perjuicios mínimos ocasionados al Arrendador, sin perjuicio
      del derecho de éste a exigir indemnización complementaria por los daños mayores que acredite.
    </p>

    <!-- ===== DECIMOCUARTA ===== -->
    <h3 class="clause-title">Decimocuarta. Fuerza Mayor y Caso Fortuito</h3>
    <p>
      Conforme al artículo 45 del Código Civil, ninguna de las Partes será responsable por el incumplimiento
      de las obligaciones emanadas del presente contrato, cuando éste se deba a fuerza mayor o caso
      fortuito, entendiéndose por tal el imprevisto al que no es posible resistir, tales como catástrofes
      naturales, actos de autoridad, conmociones graves del orden público, pandemias declaradas o hechos
      similares, siempre que la Parte afectada haya obrado con la debida diligencia y comunique el impedimento
      a la otra Parte dentro de las cuarenta y ocho (48) horas siguientes a su ocurrencia.
    </p>
    <p>
      Durante la vigencia del evento de fuerza mayor o caso fortuito, las obligaciones afectadas se
      entenderán suspendidas, sin generar intereses ni multas. Si el evento se prolonga por más de
      <strong>quince (15) días corridos</strong>, cualquiera de las Partes podrá poner término al contrato
      mediante comunicación escrita, procediéndose a la liquidación de los pagos efectuados y a la
      inmediata restitución de la maquinaria, sin que ello dé lugar a indemnización alguna, salvo las
      sumas devengadas y no pagadas hasta el momento de la suspensión.
    </p>

    <!-- ===== DECIMOCUARTA BIS: PROTECCIÓN DEL DOMINIO ANTE EMBARGO/QUIEBRA ===== -->
    <h3 class="clause-title">Decimocuarta Bis. Reserva de Dominio y Protección ante Embargo o Insolvencia</h3>
    <p>
      Las Partes dejan expresa constancia que la maquinaria objeto del presente contrato es de
      <strong>propiedad exclusiva del Arrendador</strong>, y que el Arrendatario únicamente detenta su
      <em>mera tenencia material</em> a título de arriendo, sin que el presente contrato confiera al
      Arrendatario derecho real alguno sobre la misma.
    </p>
    <p>
      En consecuencia, la maquinaria <strong>no forma parte del activo del Arrendatario</strong> y no es
      susceptible de ser embargada, enajenada, gravada ni incorporada a un procedimiento concursal de
      reorganización o liquidación en conformidad a la <strong>Ley N° 20.720</strong>. En caso de embargo,
      retención o medida precautoria decretada por un tercero sobre la maquinaria, el Arrendatario deberá:
    </p>
    <ol>
      <li>Comunicar al Arrendador por escrito, dentro de las veinticuatro (24) horas siguientes, la existencia de la medida, el tribunal y el expediente que la ordenó.</li>
      <li>Exhibir al ministro de fe o funcionario actuante el presente contrato y declarar formalmente que la maquinaria es de propiedad del Arrendador.</li>
      <li>Colaborar con el Arrendador en la presentación de tercerías de dominio o posesión (artículos 518 y siguientes del Código de Procedimiento Civil) o incidentes de exclusión en el procedimiento concursal, asumiendo el Arrendatario los costos judiciales que la defensa irrogue cuando la medida sea consecuencia de obligaciones suyas.</li>
    </ol>
    <p>
      La declaración de quiebra, inicio de procedimiento concursal de reorganización o liquidación, cesión
      de bienes, notoria insolvencia, protesto reiterado de documentos o retiro no comunicado del giro del
      Arrendatario constituirá causal de <strong>terminación ipso facto</strong> del presente contrato,
      facultando al Arrendador para retirar inmediatamente la maquinaria, sin perjuicio de las acciones
      legales que le asistan para el cobro de las sumas adeudadas.
    </p>

    <!-- ===== DECIMOCUARTA TER: ANTICORRUPCIÓN Y CUMPLIMIENTO ===== -->
    <h3 class="clause-title">Decimocuarta Ter. Cumplimiento Normativo y Anticorrupción (Ley N° 20.393)</h3>
    <p>
      Las Partes se obligan a observar, en la ejecución del presente contrato y en todas las actividades
      relacionadas con éste, las disposiciones de la <strong>Ley N° 20.393 sobre Responsabilidad Penal de
      las Personas Jurídicas</strong>, así como las demás normas chilenas e internacionales aplicables en
      materia de prevención del cohecho a funcionarios públicos nacionales y extranjeros, lavado de
      activos, financiamiento del terrorismo, receptación, administración desleal, contaminación de aguas
      y demás delitos base comprendidos en dicha ley y sus modificaciones.
    </p>
    <p>
      Cada Parte declara que ni ella, ni sus representantes legales, administradores, socios controladores
      ni dependientes con facultades de dirección, ha sido condenada ni se encuentra formalizada por los
      delitos a que se refiere la Ley N° 20.393, comprometiéndose a comunicar a la otra Parte, dentro de
      los cinco (5) días hábiles siguientes, cualquier cambio relevante en dicha situación.
    </p>
    <p>
      Queda estrictamente prohibido a las Partes y a sus dependientes ofrecer, prometer, entregar o
      aceptar, directa o indirectamente, beneficios económicos o de cualquier otra naturaleza con el
      objeto de influir indebidamente en las decisiones de funcionarios públicos o privados relacionados
      con el presente contrato. El incumplimiento de esta cláusula constituirá causal suficiente de
      terminación anticipada, sin derecho a indemnización para la parte infractora y sin perjuicio de las
      acciones civiles y penales que correspondan.
    </p>

    <!-- ===== DECIMOCUARTA QUÁTER: DATOS PERSONALES ===== -->
    <h3 class="clause-title">Decimocuarta Quáter. Tratamiento de Datos Personales (Leyes N° 19.628 y N° 21.719)</h3>
    <p>
      Para la celebración, ejecución, facturación, cobranza y eventual defensa judicial del presente
      contrato, las Partes tratarán datos personales de contrapartes, representantes legales, operadores,
      contactos y dependientes. Dicho tratamiento se sujetará a la <strong>Ley N° 19.628 sobre Protección
      de la Vida Privada</strong> y a la <strong>Ley N° 21.719 (2024) que moderniza el régimen de
      protección de datos personales</strong>, en lo que resulte aplicable desde su entrada en vigencia.
    </p>
    <p>
      <strong>Responsable del tratamiento.</strong> Cada Parte será responsable del tratamiento respecto
      de los datos personales que obtenga con motivo del presente contrato, debiendo aplicar medidas
      técnicas y organizativas razonables para garantizar su confidencialidad, integridad y
      disponibilidad.
    </p>
    <p>
      <strong>Finalidades.</strong> Los datos serán tratados únicamente para: (i) la celebración,
      ejecución y cumplimiento del contrato; (ii) la emisión y cobro de documentos tributarios; (iii) el
      cumplimiento de obligaciones legales, tributarias y regulatorias; (iv) la defensa de derechos ante
      tribunales y autoridades; (v) la prevención de fraude y la verificación crediticia (Boletín
      Comercial, DICOM), cuando corresponda; y (vi) el envío de comunicaciones operacionales del
      contrato. Cualquier finalidad distinta requerirá el consentimiento expreso del titular.
    </p>
    <p>
      <strong>Derechos del titular.</strong> Los titulares de datos podrán ejercer los derechos de acceso,
      rectificación, cancelación (supresión), oposición, portabilidad y bloqueo, según corresponda,
      dirigiendo solicitud escrita al correo <em>contacto@jurmaq.cl</em>, la que será respondida en los
      plazos y forma que establezca la normativa vigente.
    </p>
    <p>
      <strong>Comunicación a terceros.</strong> Las Partes podrán comunicar datos personales a sus
      asesores legales, contables y tributarios, auditores, compañías de seguros, transportistas,
      proveedores tecnológicos bajo contrato de encargo, autoridades fiscalizadoras y tribunales, cuando
      ello sea necesario para las finalidades antes indicadas.
    </p>
    <p>
      <strong>Conservación.</strong> Los datos se conservarán por el plazo exigido por la normativa
      tributaria, laboral y comercial aplicable, y por el tiempo necesario para el ejercicio o defensa de
      acciones legales derivadas del contrato.
    </p>

    <!-- ===== DECIMOCUARTA QUINQUIES: RESOLUCIÓN DE CONTROVERSIAS ===== -->
    <h3 class="clause-title">Decimocuarta Quinquies. Mediación Previa y Resolución de Controversias</h3>
    <p>
      Antes de iniciar cualquier acción judicial derivada del presente contrato, las Partes se obligan a
      intentar de buena fe una <strong>instancia de mediación directa o extrajudicial</strong>, de carácter
      obligatorio y previo, en los siguientes términos:
    </p>
    <ol>
      <li>La Parte interesada notificará por escrito a la otra, mediante correo electrónico a la dirección declarada en la comparecencia y carta certificada subsidiaria, su intención de someter la controversia a mediación, indicando la materia y los antecedentes relevantes.</li>
      <li>Las Partes dispondrán de un plazo de <strong>treinta (30) días corridos</strong> contados desde la notificación para celebrar, ya sea por sí o a través de un mediador común (Centro de Arbitraje y Mediación de la Cámara de Comercio de Santiago u otro centro que acuerden), al menos una sesión de mediación.</li>
      <li>Vencido dicho plazo sin acuerdo, o constatado formalmente el fracaso de la mediación, las Partes quedarán en libertad de accionar ante los Tribunales Ordinarios en los términos de la cláusula Decimosexta.</li>
    </ol>
    <p>
      La concurrencia al proceso de mediación no implicará reconocimiento alguno de pretensiones, ni
      suspenderá el devengo de intereses y multas pactados, salvo acuerdo en contrario. Los costos del
      mediador, cuando se designe, se soportarán por partes iguales, sin perjuicio de lo que se resuelva
      en definitiva.
    </p>

    <!-- ===== DECIMOQUINTA ===== -->
    <h3 class="clause-title">Decimoquinta. Firma Electrónica</h3>
    <p>
      Las Partes aceptan expresamente que el presente contrato pueda ser suscrito mediante
      <strong>firma electrónica simple</strong>, reconocida por la <strong>Ley N° 19.799</strong>, sobre
      Documentos Electrónicos, Firma Electrónica y Servicios de Certificación, confiriéndosele, para todos
      los efectos legales, el mismo valor jurídico y fuerza probatoria que a una firma manuscrita.
    </p>
    <p>
      La identidad del firmante se verificará mediante un <strong>código de un solo uso (OTP)</strong>
      enviado al correo electrónico declarado por cada Parte, complementado con el registro
      de la dirección IP desde la cual se efectúa la firma y la marca temporal (timestamp) del
      acto. Adicionalmente, el contrato incorporará su respectivo código hash SHA-256, que permitirá
      verificar en todo momento la integridad e inalterabilidad del documento.
    </p>
    <p>
      Las Partes renuncian expresamente a impugnar la validez o autenticidad del presente contrato por el
      solo hecho de haber sido suscrito por medios electrónicos, sin perjuicio del derecho a acreditar,
      por las vías legales pertinentes, eventuales vicios específicos del consentimiento.
    </p>

    <!-- ===== DECIMOSEXTA ===== -->
    <h3 class="clause-title">Decimosexta. Domicilio y Jurisdicción</h3>
    <p>
      Para todos los efectos legales derivados del presente contrato, las Partes fijan su domicilio en la
      ciudad de <strong>Curicó</strong>, Región del Maule, Chile, prorrogando expresamente competencia en
      favor de sus Tribunales Ordinarios de Justicia para conocer de cualquier dificultad o controversia
      que se suscite con motivo del presente contrato, su interpretación, cumplimiento, terminación o
      liquidación.
    </p>
    <p>
      Lo anterior se entiende sin perjuicio del derecho del Arrendatario, cuando revista el carácter de
      consumidor en los términos de la <strong>Ley N° 19.496</strong> sobre Protección de los Derechos de
      los Consumidores, de recurrir a las instancias de mediación u otros mecanismos previstos por dicha
      ley ante el Servicio Nacional del Consumidor (SERNAC) en los casos que proceda.
    </p>

    <!-- ===== DECIMOSÉPTIMA ===== -->
    <h3 class="clause-title">Decimoséptima. Observaciones y Cláusulas Particulares</h3>
    {{#if observaciones}}
    <p>Las Partes dejan constancia de las siguientes estipulaciones particulares, que forman parte integrante del presente contrato:</p>
    <div class="rounded-md bg-slate-50" style="border:1px solid #e2e8f0; padding:10px 12px; margin:6px 0;">
      {{observaciones}}
    </div>
    {{else}}
    <p class="muted"><em>No se pactan cláusulas particulares adicionales.</em></p>
    {{/if}}
    <p>
      En todo lo no previsto en el presente instrumento, las Partes se remiten a las normas del Código
      Civil chileno sobre contrato de arrendamiento de cosas y demás legislación aplicable, en especial,
      cuando corresponda: la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores; la Ley
      N° 19.799 sobre Firma Electrónica; la Ley N° 18.010 sobre Operaciones de Crédito de Dinero; la Ley
      N° 18.290 de Tránsito y Ley N° 18.490 sobre SOAP; la Ley N° 16.744 sobre Accidentes del Trabajo;
      las Leyes N° 19.628 y N° 21.719 sobre Protección de Datos Personales; la Ley N° 20.393 sobre
      Responsabilidad Penal de las Personas Jurídicas; y la Ley N° 20.720 de Reorganización y Liquidación
      de Empresas y Personas.
    </p>

    <!-- ============ EJEMPLARES ============ -->
    <h2 class="section-title">Ejemplares</h2>
    <p>
      El presente contrato se suscribe en dos ejemplares de idéntico tenor y fecha, quedando uno en poder
      de cada Parte, o, cuando la firma se verifique por medios electrónicos, en formato digital con
      idéntico valor probatorio conforme a la Ley N° 19.799.
    </p>

    <!-- ============ FIRMAS ============ -->
    <div class="signatures">
      <div class="signature-box">
        <div class="signature-line">&nbsp;</div>
        <div class="role">Arrendador</div>
        <div class="name">Jorge Ubilla Rivera</div>
        <div class="rut">RUT 76.624.872-1</div>
        <div class="small muted">Representante Legal<br/>Constructora Jorge Ubilla Rivera E.I.R.L.</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">&nbsp;</div>
        <div class="role">Arrendatario</div>
        {{#if es_natural}}
        <div class="name">{{arrendatario_nombre}}</div>
        <div class="rut">RUT {{arrendatario_rut}}</div>
        {{else}}
        <div class="name">{{arrendatario_rep_legal}}</div>
        <div class="rut">RUT {{arrendatario_rep_rut}}</div>
        <div class="small muted">En representación de<br/>{{arrendatario_razon_social}} &middot; RUT {{arrendatario_rut}}</div>
        {{/if}}
      </div>
    </div>

    <!-- ============ METADATOS DE FIRMA ELECTRÓNICA (solo si firmado) ============ -->
    {{#if firma_timestamp}}
    <div class="e-sign" aria-label="Metadatos de firma electrónica">
      <div class="e-title">Registro de firma electrónica (Ley N° 19.799)</div>
      <div><strong>Contrato N°:</strong> {{numero_contrato}}</div>
      <div><strong>Hash SHA-256 del documento:</strong> {{hash_sha256}}</div>
      <div><strong>Código OTP validado:</strong> {{otp_codigo}}</div>
      <div><strong>Dirección IP del firmante:</strong> {{firma_ip}}</div>
      <div><strong>Fecha y hora de la firma (timestamp):</strong> {{firma_timestamp}}</div>
      <div><strong>Correo electrónico verificado:</strong> {{firma_email}}</div>
    </div>
    {{/if}}

    <div class="footer-note">
      Documento generado por la plataforma JURMAQ &middot; www.jurmaq.cl &middot; contacto@jurmaq.cl
      &middot; Contrato N° {{numero_contrato}}
    </div>
  </div>
</body>
</html>`;

export default DEFAULT_CONTRATO_TEMPLATE;
