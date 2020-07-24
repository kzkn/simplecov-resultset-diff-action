export type ResultSet = {
  [command: string]: {
    coverage: RawCoverages
  }
}

type RawCoverages = {
  [filename: string]: RawCoverage
}

type RawCoverage = {
  lines: LineCoverage
  branches: BranchCoverage
}

type LineCoverage = (number | null)[]

type BranchCoverage = {
  [condition: string]: {
    [branch: string]: number
  }
}

type FileCoverage = {
  filename: string
  lines: number
  branches: number
}

type Diff = any

function floor(n: number, digits = 0): number {
  const d = Math.pow(10, digits)
  const x = Math.floor(n * d)
  return x / d
}

function linesCoverage(coverage: LineCoverage): number {
  const effectiveLines = coverage.filter(hit => hit !== null) as number[]
  const rows = effectiveLines.length
  if (rows === 0) {
    return 100
  }

  const covered = effectiveLines.filter(hit => hit > 0).length
  return floor((covered / rows) * 100, 2)
}

function branchesCoverages(coverage: BranchCoverage): number {
  const conditions = Object.keys(coverage)
  if (conditions.length === 0) {
    return 100
  }

  let total = 0
  let covered = 0
  conditions.forEach(k => {
    const cond = coverage[k]
    Object.keys(cond).forEach(branch => {
      total += 1
      const hit = cond[branch]
      if (hit > 0) {
        covered += 1
      }
    })
  })
  return floor((covered / total) * 100, 2)
}

export class Coverage {
  files: FileCoverage[]

  constructor(resultset: ResultSet) {
    const coverages = resultset['RSpec']['coverage']
    this.files = []
    Object.keys(coverages).forEach(filename => {
      const coverage = coverages[filename]
      this.files.push({
        filename,
        lines: linesCoverage(coverage.lines),
        branches: branchesCoverages(coverage.branches)
      })
    })
  }

  trimWorkspacePath(workspacePath: string): void {
    for (const fileCov of this.files) {
      if (fileCov.filename.startsWith(workspacePath)) {
        fileCov.filename = fileCov.filename.slice(workspacePath.length)
      }
    }
  }

  filesMap(): Map<string, FileCoverage> {
    const map = new Map<string, FileCoverage>()
    for (const fileCov of this.files) {
      map.set(fileCov.filename, fileCov)
    }
    return map
  }
}

export function getCoverageDiff(cov1: Coverage, cov2: Coverage): FileCoverageDiff[] {
  const diff: FileCoverageDiff[] = []
  const cov1Files = cov1.filesMap()
  const cov2Files = cov2.filesMap()
  for (const {filename} of cov1.files) {
    const fcov1 = cov1Files.get(filename)
    const fcov2 = cov2Files.get(filename)
    if (isDifference(fcov1, fcov2)) {
      diff.push(makeDiff(fcov1, fcov2))
    }
  }
  return diff
}

function isDifference(cov1?: FileCoverage, cov2?: FileCoverage): boolean {
  if (cov1 === cov2) { return false }
  if (cov1 && !cov2) { return true }
  if (!cov1 && cov2) { return true }
  if (cov1!.lines !== cov2!.lines) { return true }
  if (cov1!.branches !== cov2!.branches) { return true }
  return false
}

type FileCoverageDiff = {
  filename: string
  lines: number
  branches: number
}

function makeDiff(cov1?: FileCoverage, cov2?: FileCoverage): FileCoverageDiff {
  if (!cov1 && !cov2) {
    throw new Error('no coverages')
  }

  if (!cov1 && cov2) { return cov2 }
  if (!cov2 && cov1) { return { filename: cov1.filename, lines: -cov1.lines, branches: -cov1.branches } }
  return {
    filename: cov1!.filename,
    lines: cov1!.lines - cov2!.lines,
    branches: cov1!.branches - cov2!.branches
  }
}
