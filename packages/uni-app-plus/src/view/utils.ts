import { camelize, capitalize, isString } from '@vue/shared'
import { rpx2px } from '@dcloudio/uni-core'
import { getRealPath } from '../platform/getRealPath'

export function normalizeStyleValue(val: string) {
  return normalizeUrl(rpx2px(val, true))
}

const urlRE = /url\(\s*'?"?([a-zA-Z0-9\.\-\_\/]+\.(jpg|gif|png))"?'?\s*\)/

const normalizeUrl = (val: string) => {
  if (isString(val) && val.indexOf('url(') !== -1) {
    const matches = val.match(urlRE)
    if (matches && matches.length === 3) {
      val = val.replace(matches[1], getRealPath(matches[1]))
    }
  }
  return val
}

// 移动端，仅处理 Webkit
const prefixes = ['Webkit' /*, 'Moz', 'ms'*/]
const prefixCache: Record<string, string> = {}
// autoPrefix
export function normalizeStyleName(
  style: CSSStyleDeclaration,
  rawName: string
): string {
  const cached = prefixCache[rawName]
  if (cached) {
    return cached
  }
  let name = camelize(rawName)
  if (name !== 'filter' && name in style) {
    return (prefixCache[rawName] = name)
  }
  name = capitalize(name)
  for (let i = 0; i < prefixes.length; i++) {
    const prefixed = prefixes[i] + name
    if (prefixed in style) {
      return (prefixCache[rawName] = prefixed)
    }
  }
  return rawName
}