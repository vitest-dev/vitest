import path from 'node:path'
import url from 'node:url'
import { writeFile } from 'node:fs/promises'
import { getTsconfig } from 'get-tsconfig'
import type { RawErrsMap, TscErrorInfo } from './types'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
const newLineRegExp = /\r?\n/
const errCodeRegExp = /error TS(?<errCode>\d+)/

export async function makeTscErrorInfo(
  errInfo: string,
): Promise<[string, TscErrorInfo | null]> {
  const [errFilePathPos = '', ...errMsgRawArr] = errInfo.split(':')
  if (
    !errFilePathPos
    || errMsgRawArr.length === 0
    || errMsgRawArr.join('').length === 0
  )
    return ['unknown filepath', null]

  const errMsgRaw = errMsgRawArr.join('').trim()

  // get filePath, line, col
  const [errFilePath, errPos] = errFilePathPos
    .slice(0, -1) // removes the ')'
    .split('(')
  if (!errFilePath || !errPos)
    return ['unknown filepath', null]

  const [errLine, errCol] = errPos.split(',')
  if (!errLine || !errCol)
    return [errFilePath, null]

  // get errCode, errMsg
  const execArr = errCodeRegExp.exec(errMsgRaw)
  if (!execArr)
    return [errFilePath, null]

  const errCodeStr = execArr.groups?.errCode ?? ''
  if (!errCodeStr)
    return [errFilePath, null]

  const line = Number(errLine)
  const col = Number(errCol)
  const errCode = Number(errCodeStr)
  return [
    errFilePath,
    {
      filePath: errFilePath,
      errCode,
      line,
      column: col,
      errMsg: errMsgRaw.slice(`error TS${errCode} `.length),
    },
  ]
}

export async function getTsconfigPath(root: string) {
  const tmpConfigPath = path.join(root, 'tsconfig.tmp.json') // TODO put into tmp dir
  // TODO delete after use

  const tsconfig = getTsconfig(root)

  if (!tsconfig)
    throw new Error('no tsconfig.json found')

  try {
    const tmpTsConfig: Record<string, any> = { ...tsconfig.config }

    tmpTsConfig.compilerOptions ??= {}
    tmpTsConfig.compilerOptions.emitDeclarationOnly = false
    tmpTsConfig.compilerOptions.incremental = true
    tmpTsConfig.compilerOptions.tsBuildInfoFile = path.join(
      __dirname,
      'tsconfig.tmp.tsbuildinfo',
    )

    const tsconfigFinalContent = JSON.stringify(tmpTsConfig, null, 2)
    await writeFile(tmpConfigPath, tsconfigFinalContent)
    return tmpConfigPath
  }
  catch (err) {
    throw new Error('failed to write tsconfig.tmp.json', { cause: err })
  }
}

export async function getRawErrsMapFromTsCompile(
  tscErrorStdout: string,
) {
  const rawErrsMap: RawErrsMap = new Map()

  // Merge details line with main line (i.e. which contains file path)
  const infos = await Promise.all(
    tscErrorStdout
      .split(newLineRegExp)
      .reduce<string[]>((prev, next) => {
        if (!next)
          return prev

        else if (!next.startsWith(' '))
          prev.push(next)

        else
          prev[prev.length - 1] += `\n${next}`

        return prev
      }, [])
      .map(errInfoLine => makeTscErrorInfo(errInfoLine)),
  )
  infos.forEach(([errFilePath, errInfo]) => {
    if (!errInfo)
      return

    if (!rawErrsMap.has(errFilePath))
      rawErrsMap.set(errFilePath, [errInfo])

    else
      rawErrsMap.get(errFilePath)?.push(errInfo)
  })
  return rawErrsMap
}
