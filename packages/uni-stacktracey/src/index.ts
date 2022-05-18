import fs from 'fs'
import StackTracey from 'stacktracey'
import {
  SourceMapConsumer,
  BasicSourceMapConsumer,
  IndexedSourceMapConsumer,
  Position,
} from 'source-map'

const nixSlashes = (x: string) => x.replace(/\\/g, '/')
const sourcemapCatch: Record<string, string | Promise<string>> = {}

type StacktraceyItems = StackTracey.Entry & {
  errMsg?: string
}
type Stacktracey = {
  items: StacktraceyItems[]
  asTable?: StackTracey['asTable']
}
interface StacktraceyPreset {
  /**
   * 解析错误栈信息
   * @param filename
   */
  parseStacktrace(stacktrace: string): Stacktracey
  /**
   * 根据错误信息重新赋值为错误栈信息
   * @param filename
   */
  asTableStacktrace(opts?: {
    maxColumnWidths?: StackTracey.MaxColumnWidths
    stacktrace: string
  }): string
  /**
   * 根据编译后的文件名地址
   * @param file
   * 根据编译后的文件名
   * @param filename
   */
  parseSourceMapUrl(file: string, fileName: string): string
  getSourceMapContent(file: string, fileName: string): Promise<string>
}

interface StacktraceyOptions {
  preset: StacktraceyPreset
}

export function stacktracey(
  stacktrace: string,
  opts: StacktraceyOptions
): Promise<string> {
  const parseStack: Array<Promise<any>> = []

  const stack = opts.preset.parseStacktrace(stacktrace)

  stack.items.forEach((item, index) => {
    const fn = () => {
      const { line = 0, column = 0, file, fileName } = item
      try {
        return opts.preset
          .getSourceMapContent(file, fileName)
          .then((content) => {
            if (content)
              return SourceMapConsumer.with(content, null, (consumer) => {
                const sourceMapContent = parseSourceMapContent(consumer, {
                  line,
                  column,
                })

                if (sourceMapContent) {
                  const {
                    source,
                    sourcePath,
                    sourceLine,
                    sourceColumn,
                    fileName = '',
                  } = sourceMapContent

                  stack.items[index] = Object.assign({}, item, {
                    file: source,
                    line: sourceLine,
                    column: sourceColumn,
                    fileShort: sourcePath,
                    fileRelative: sourcePath,
                    fileName,
                  })
                }
              })
          })
      } catch (error) {
        return Promise.resolve()
      }
    }
    parseStack.push(fn())
  })

  return new Promise((resolve, reject) => {
    Promise.all(parseStack)
      .then(() => {
        const parseError = opts.preset.asTableStacktrace({
          maxColumnWidths: {
            callee: 999,
            file: 999,
            sourceLine: 999,
          },
          stacktrace,
        })
        resolve(parseError)
      })
      .catch(() => {
        resolve(stacktrace)
      })
  })
}

function getSourceMapContent(sourcemapUrl: string) {
  try {
    return (
      sourcemapCatch[sourcemapUrl] ||
      (sourcemapCatch[sourcemapUrl] = new Promise((resolve, reject) => {
        try {
          if (/^[a-z]+:/i.test(sourcemapUrl)) {
            uni.request({
              url: sourcemapUrl,
              success: (res) => {
                console.log('sourcemapUrl :>> ', sourcemapUrl)
                sourcemapCatch[sourcemapUrl] = res.data as string
                resolve(sourcemapCatch[sourcemapUrl])
              },
            })
          } else {
            sourcemapCatch[sourcemapUrl] = fs.readFileSync(
              sourcemapUrl,
              'utf-8'
            )
            resolve(sourcemapCatch[sourcemapUrl])
          }
        } catch (error) {
          resolve('')
        }
      }))
    )
  } catch (error) {
    return ''
  }
}

type SourceMapContent =
  | undefined
  | {
      source: string
      sourcePath: string
      sourceLine: number
      sourceColumn: number
      fileName: string | undefined
    }
function parseSourceMapContent(
  consumer: BasicSourceMapConsumer | IndexedSourceMapConsumer,
  obj: Position
): SourceMapContent {
  // source -> 'uni-app:///node_modules/@sentry/browser/esm/helpers.js'
  const {
    source,
    line: sourceLine,
    column: sourceColumn,
  } = consumer.originalPositionFor(obj)
  if (source) {
    const sourcePathSplit = source.split('/')
    const sourcePath = sourcePathSplit.slice(3).join('/')
    const fileName = sourcePathSplit.pop()

    return {
      source,
      sourcePath,
      sourceLine: sourceLine === null ? 0 : sourceLine,
      sourceColumn: sourceColumn === null ? 0 : sourceColumn,
      fileName,
    }
  }
}

interface UniStracktraceyPresetOptions {
  base: string
  appId: string
  platform: string
  version: string
}
export function uniStracktraceyPreset(
  opts: UniStracktraceyPresetOptions
): StacktraceyPreset {
  const { base, platform, version } = opts

  let stack: Stacktracey

  return {
    parseSourceMapUrl(file, fileName) {
      if (!platform || !version) return ''
      // 根据 base,platform,version,filename 组合 sourceMapUrl
      return `${base}/${version}/.sourcemap/${platform}/${
        file.split('.')[0]
      }.js.map`
    },
    getSourceMapContent(file, fileName) {
      return Promise.resolve(
        getSourceMapContent(this.parseSourceMapUrl(file, fileName))
      )
    },
    parseStacktrace(stacktrace) {
      return (stack = new StackTracey(stacktrace))
    },
    asTableStacktrace({ maxColumnWidths, stacktrace } = { stacktrace: '' }) {
      const errorName = stacktrace.split('\n')[0]
      return (
        (errorName.indexOf('at') === -1 ? `${errorName}\n` : '') +
        (stack.asTable ? stack.asTable({ maxColumnWidths }) : '')
      )
    },
  }
}

interface UtsStracktraceyPreset {
  /**
   * source 根目录（如：/wgtRoot/__UNI__E070870/nativeplugins/DCloud-UTSPlugin/android/src/）
   */
  sourceRoot: string
  /**
   * sourceMap 根目录
   */
  base: string
}
export function utsStracktraceyPreset(
  opts: UtsStracktraceyPreset
): StacktraceyPreset {
  let stack: Stacktracey
  let errStack: string[] = []
  return {
    parseSourceMapUrl(file, fileName) {
      // 根据 base,filename 组合 sourceMapUrl
      return `${opts.base}${file.replace(opts.sourceRoot, '')}.map`
    },
    getSourceMapContent(file, fileName) {
      // 根据 base,filename 组合 sourceMapUrl
      return Promise.resolve(
        getSourceMapContent(this.parseSourceMapUrl(file, fileName))
      )
    },
    parseStacktrace(str) {
      const lines = (str || '').split('\n')

      const entries = lines
        .map((line, index) => {
          line = line.trim()

          let callee,
            fileLineColumn = [],
            planA,
            planB

          if ((planA = line.match(/e: (.+\.kt)(.+\))*:\s*(.+)*/))) {
            errStack.push('%StacktraceyItem%')
            callee = 'e: '
            fileLineColumn = (
              planA[2].match(/.*:.*\((\d+).+?(\d+)\)/) || []
            ).slice(1)
          } else {
            errStack.push(line)
            return undefined
          }

          const fileName = planA[1]
            ? (planB = planA[1].match(/(.*)*\/(.+)/) || [])[2] || ''
            : ''

          return {
            beforeParse: line,
            callee: callee || '',
            index: false,
            native: false,
            file: nixSlashes(planA[1] || ''),
            line: parseInt(fileLineColumn[0] || '', 10) || undefined,
            column: parseInt(fileLineColumn[1] || '', 10) || undefined,
            fileName,
            fileShort: planB ? planB[1] : '',
            errMsg: planA[3] || '',
            calleeShort: '',
            fileRelative: '',
            thirdParty: false,
          }
        })
        .filter((x) => x !== undefined)

      return (stack = {
        items: entries as StackTracey.Entry[],
      })
    },
    asTableStacktrace({ stacktrace } = { stacktrace: '' }) {
      return errStack
        .map((item) => {
          if (item === '%StacktraceyItem%') {
            const _stack = stack.items.shift()
            if (_stack)
              return `${_stack.callee}${_stack.fileShort}/${_stack.fileName}: (${_stack.line}, ${_stack.column}): ${_stack.errMsg}`
          }
          return item
        })
        .join('\n')
    },
  }
}