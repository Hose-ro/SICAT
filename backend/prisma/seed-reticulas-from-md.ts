import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

/**
 * Seed ReticulaMateria and, optionally, Materia records by parsing
 * the markdown file instrucciones-reticulas.md.
 *
 * Usage:
 *   npx ts-node prisma/seed-reticulas-from-md.ts [--skip-materias]
 *
 * Env:
 *   RETICULA_MD=/absolute/path/a/instrucciones-reticulas.md
 */

const prisma = new PrismaClient()

type Entrada = {
  nombre: string
  clave: string
  semestre: number
  horasTeoria: number
  horasPractica: number
  creditos: number
  carreraCodigo: string
}

function leerArchivo(): string {
  const cliPath = process.argv.find((a) => a.endsWith('.md'))
  const envPath = process.env.RETICULA_MD
  const candidates = [
    cliPath,
    envPath,
    '/Users/jose/Downloads/instrucciones-reticulas.md',
    path.resolve(process.cwd(), '..', 'Downloads', 'instrucciones-reticulas.md'),
  ].filter(Boolean) as string[]

  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      console.log(`Usando archivo de retícula: ${p}`)
      return fs.readFileSync(p, 'utf8')
    }
  }

  throw new Error(
    'No se encontró el archivo instrucciones-reticulas.md. Define RETICULA_MD o pasa la ruta .md.',
  )
}

function parsear(md: string): Entrada[] {
  const lines = md.split(/\r?\n/)
  let carreraCodigo: string | null = null
  let semestre = 0
  const out: Entrada[] = []

  const carreraRe = /^####\s+.+?Código:\s*"(\d{2})"/i
  const semRe = /^\*\*Semestre\s+(\d+):\*\*/i
  const itemRe = /^-\s+(.+?)\s*\|\s*([A-Z0-9-]+)\s*\|\s*(\d+)-(\d+)-(\d+)/

  for (const raw of lines) {
    const line = raw.trim()
    const c = carreraRe.exec(line)
    if (c) {
      carreraCodigo = c[1]
      continue
    }
    const s = semRe.exec(line)
    if (s) {
      semestre = Number(s[1])
      continue
    }
    const m = itemRe.exec(line)
    if (m && carreraCodigo && semestre) {
      const [, nombre, clave, ht, hp, cred] = m
      out.push({
        nombre: nombre.trim(),
        clave: clave.trim(),
        semestre,
        horasTeoria: Number(ht),
        horasPractica: Number(hp),
        creditos: Number(cred),
        carreraCodigo,
      })
    }
  }
  return out
}

async function main() {
  const skipMaterias = process.argv.includes('--skip-materias')
  const md = leerArchivo()
  const entradas = parsear(md)

  if (entradas.length === 0) {
    throw new Error('No se parseó ninguna materia. Revisa el formato del archivo o la ruta.')
  }

  console.log(`Encontradas ${entradas.length} materias de retícula en total`)

  const carrerasCache = new Map<string, number>()
  const conteoPorCarrera = new Map<string, number>()

  for (const e of entradas) {
    let carreraId = carrerasCache.get(e.carreraCodigo)
    if (!carreraId) {
      const carrera = await prisma.carrera.findUnique({ where: { codigo: e.carreraCodigo } })
      if (!carrera) {
        console.warn(`⚠️  Carrera código ${e.carreraCodigo} no existe. Saltando ${e.clave}`)
        continue
      }
      carreraId = carrera.id
      carrerasCache.set(e.carreraCodigo, carreraId)
    }
    conteoPorCarrera.set(e.carreraCodigo, (conteoPorCarrera.get(e.carreraCodigo) ?? 0) + 1)

    await prisma.reticulaMateria.upsert({
      where: { clave_carreraId: { clave: e.clave, carreraId } },
      update: {
        nombre: e.nombre,
        semestre: e.semestre,
        horasTeoria: e.horasTeoria,
        horasPractica: e.horasPractica,
        creditos: e.creditos,
        activo: true,
      },
      create: {
        nombre: e.nombre,
        clave: e.clave,
        semestre: e.semestre,
        carreraId,
        horasTeoria: e.horasTeoria,
        horasPractica: e.horasPractica,
        creditos: e.creditos,
        activo: true,
      },
    })

    if (!skipMaterias) {
      await prisma.materia.upsert({
        where: { clave: e.clave },
        update: {
          nombre: e.nombre,
          semestre: e.semestre,
          carreraId,
        },
        create: {
          nombre: e.nombre,
          clave: e.clave,
          semestre: e.semestre,
          carreraId,
          descripcion: null,
          horaInicio: '00:00',
          horaFin: '00:00',
          dias: '',
          docenteId: null,
          aulaId: null,
          numUnidades: 3,
        },
      })
    }
  }

  console.log('Materias por carrera:', Object.fromEntries(conteoPorCarrera))
  console.log('✅ Seed completado')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
