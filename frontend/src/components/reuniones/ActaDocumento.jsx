import itscoUrl from '@/logoTec/itsco-logo.png'
import sevUrl from '@/logoTec/sev-logo.png'
import { INSTITUCION } from '@/lib/formatoInstitucional'
import { modeloActa } from '@/lib/actaReunion'

// El acta es una hoja impresa: blanco y negro también en modo oscuro.
const celda = 'border border-black px-2 py-1.5 align-middle'
const cabecera = `${celda} text-center font-bold`

function Seccion({ children }) {
  return <h3 className="mb-2 mt-5 text-center text-[0.8125rem] font-bold">{children}</h3>
}

function Tabla({ columnas, anchos, filas, render }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-[0.75rem]">
        <colgroup>{anchos.map((a, i) => <col key={i} style={{ width: `${a}%` }} />)}</colgroup>
        <thead><tr>{columnas.map((c) => <th key={c} scope="col" className={cabecera}>{c}</th>)}</tr></thead>
        <tbody>{filas.map((fila, i) => <tr key={i}>{render ? render(fila) : fila.map((t, k) => <td key={k} className={celda}>{t}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

/**
 * El acta de la reunión con el formato institucional (F01PSA01.02), para
 * leerla en la app sin descargarla. El PDF y el Word salen del mismo modelo.
 */
export default function ActaDocumento({ reunion }) {
  const m = modeloActa(reunion)
  return (
    <article aria-label={m.encabezado} className="mx-auto max-w-[52rem] rounded-sm bg-white p-4 font-[Arial,Helvetica,sans-serif] text-[0.8125rem] leading-relaxed text-black shadow-sm ring-1 ring-black/10 sm:p-8">
      <header className="grid grid-cols-[minmax(0,29fr)_minmax(0,71fr)] border border-black">
        <div className="row-span-2 flex items-center justify-center gap-2 border-r border-black p-2">
          <img src={itscoUrl} alt="ITSCO" className="h-10 w-10 object-contain sm:h-16 sm:w-16" />
          <img src={sevUrl} alt="SEV" className="h-6 object-contain sm:h-9" />
        </div>
        <div className="px-2 py-3 text-center font-bold sm:py-4">
          <p className="text-[0.6875rem] sm:text-[0.9375rem]">{INSTITUCION}</p>
          <p className="mt-1.5 text-[0.6875rem] sm:text-[0.8125rem]">{m.formato.titulo}</p>
          <p className="mt-1 text-[0.6875rem] sm:text-[0.8125rem]">{m.formato.subtitulo}</p>
        </div>
        <p className="border-t border-black px-2 py-2 text-[0.6875rem] sm:px-3 sm:text-[0.75rem]">
          <strong>Referencia a la Norma ISO 9001/2008:</strong> 8.2 Seguimiento y Medición.
        </p>
      </header>

      <p className="mt-5 font-bold">{m.encabezado}</p>
      <p className="mt-3 whitespace-pre-line">{m.apertura}</p>

      <Seccion>ORDEN DEL DÍA</Seccion>
      <Tabla
        columnas={['No.', 'Descripción']}
        anchos={[8, 92]}
        filas={m.puntos}
        render={([n, d]) => <><td className={`${celda} text-center`}>{n}</td><td className={celda}>{d}</td></>}
      />
      <p className="mt-4">{m.transicion}</p>

      <Seccion>SEGUIMIENTO DE ACUERDOS ANTERIORES</Seccion>
      <Tabla columnas={['Acuerdo', 'Responsable', 'Fecha de cumplimiento', 'Avance']} anchos={[36, 19, 17, 28]} filas={m.seguimiento} />

      <Seccion>ACUERDOS DE REUNIÓN</Seccion>
      <Tabla columnas={['Acuerdo', 'Responsable', 'Fecha de cumplimiento']} anchos={[49, 26, 25]} filas={m.acuerdos} />
      <p className="mt-4">{m.cierre}</p>

      <table className="mt-8 w-full table-fixed border-collapse text-center text-[0.75rem]">
        <thead><tr><th scope="col" className={cabecera}>PRESIDENTE(A)</th><th scope="col" className={cabecera}>SECRETARIO(A)</th></tr></thead>
        <tbody>
          <tr><td className={`${celda} h-9`}>{m.presidente}</td><td className={`${celda} h-9`}>{m.secretario}</td></tr>
          <tr><td className={`${celda} h-16 align-bottom`}>FIRMA</td><td className={`${celda} h-16 align-bottom`}>FIRMA</td></tr>
        </tbody>
      </table>

      <Seccion>CONSTANCIA DE APROBACIÓN</Seccion>
      <p>Nombre y firma de los miembros de la academia que asistieron a la reunión y manifiestan su aprobación para la presente acta.</p>
      <div className="mt-2">
        <Tabla
          columnas={['Profesor', 'Materia que imparte', 'Firma']}
          anchos={[38, 36, 26]}
          filas={m.constancia}
          render={([nombre, materias]) => <><td className={`${celda} h-11`}>{nombre}</td><td className={celda}>{materias}</td><td className={celda} /></>}
        />
      </div>

      <Seccion>OBSERVACIONES</Seccion>
      <p className="whitespace-pre-line">{m.observaciones}</p>
    </article>
  )
}
