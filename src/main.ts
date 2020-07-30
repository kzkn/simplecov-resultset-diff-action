import * as path from 'path'
import * as fs from 'fs'
import * as github from '@actions/github'
import * as core from '@actions/core'
import markdownTable from 'markdown-table'
import {
  ResultSet,
  Coverage,
  getCoverageDiff,
  FileCoverageDiff
} from './simplecov'

const WORKSPACE: string = process.env.GITHUB_WORKSPACE!

function doesPathExists(filepath: string): void {
  if (!fs.existsSync(filepath)) {
    throw new Error(`${filepath} does not exist!`)
  }
}

function parseResultset(resultsetPath: string): ResultSet {
  const content = fs.readFileSync(path.resolve(WORKSPACE, resultsetPath))
  return JSON.parse(content.toString()) as ResultSet
}

function truncPercentage(n: number): number {
  return Math.sign(n) * (Math.trunc(Math.abs(n) * 10) / 10)
}

function badgeUrl(from: number, to: number): string {
  const top =
    'https://raw.githubusercontent.com/kzkn/simplecov-resultset-diff-action/main/assets'
  const diff = Math.abs(truncPercentage(to - from))
  if (diff === 0) {
    return `${top}/0.svg`
  } else {
    const dir = Math.sign(to - from) < 0 ? 'down' : 'up'
    const n = Math.trunc(diff)
    const m = (diff * 10) % 10
    return `${top}/${dir}/${n}/${n}.${m}.svg`
  }
}

function formatDiffItem({
  from,
  to
}: {
  from: number | null
  to: number | null
}): string {
  let p = ''
  let badge = ''
  if (to !== null) {
    p = ` ${truncPercentage(to)}%`
  }
  if (from !== null && to !== null) {
    badge = ` ![${truncPercentage(to - from)}%](${badgeUrl(from, to)})`
  }
  const created = from === null && to !== null ? 'NEW' : ''
  const deleted = from !== null && to === null ? 'DELETE' : ''
  return `${created}${deleted}${p}${badge}`
}

function trimWorkspacePath(filename: string): string {
  const workspace = `${WORKSPACE}/`
  if (filename.startsWith(workspace)) {
    return filename.slice(workspace.length)
  } else {
    return filename
  }
}

function formatDiff(diff: FileCoverageDiff): [string, string, string] {
  return [
    trimWorkspacePath(diff.filename),
    formatDiffItem(diff.lines),
    formatDiffItem(diff.branches)
  ]
}

async function run(): Promise<void> {
  try {
    const resultsetPaths = {
      base: core.getInput('base-resultset-path'),
      head: core.getInput('head-resultset-path')
    }

    const paths = {
      base: path.resolve(process.cwd(), resultsetPaths.base),
      head: path.resolve(process.cwd(), resultsetPaths.head)
    }

    doesPathExists(paths.base)
    doesPathExists(paths.head)

    const resultsets = {
      base: parseResultset(paths.base),
      head: parseResultset(paths.head)
    }

    const coverages = {
      base: new Coverage(resultsets.base),
      head: new Coverage(resultsets.head)
    }

    const diff = getCoverageDiff(coverages.base, coverages.head)

    let content: string
    if (diff.length === 0) {
      content = 'No differences'
    } else {
      content = markdownTable([
        ['Filename', 'Lines', 'Branches'],
        ...diff.map(formatDiff)
      ])
    }

    const message = `## Coverage difference
${content}
`

    /**
     * Publish a comment in the PR with the diff result.
     */
    const octokit = github.getOctokit(core.getInput('token'))

    const pullRequestId = github.context.issue.number
    if (!pullRequestId) {
      core.warning('Cannot find the PR id.')
      core.info(message)
      return
    }

    await octokit.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: pullRequestId,
      body: message
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
