import path from 'path'
import { CompilerOptions, NodeTypes } from '@vue/compiler-core'
import {
  COMPONENT_ON_LINK,
  copyMiniProgramPluginJson,
  createTransformComponentLink,
  MiniProgramCompilerOptions,
  transformMatchMedia,
} from '@dcloudio/uni-cli-shared'
import { UniMiniProgramPluginOptions } from '@dcloudio/uni-mp-vite'
import source from './mini.project.json'
import { transformRef } from './transforms/transformRef'
import { event } from './event'
import { transformOpenType } from './transforms/transformOpenType'

const projectConfigFilename = 'mini.project.json'

export const miniProgram: MiniProgramCompilerOptions = {
  event,
  class: {
    array: false,
  },
  slot: {
    $slots: false,
    // 支付宝 fallback 有 bug，当多个带默认 slot 组件嵌套使用时，所有的默认slot均会显示，如uni-file-picker(image)
    fallbackContent: true,
    dynamicSlotNames: true,
  },
  directive: 'a:',
  component: {
    getPropertySync: true,
  },
}
const nodeTransforms = [
  transformRef,
  transformOpenType,
  transformMatchMedia,
  createTransformComponentLink(COMPONENT_ON_LINK, NodeTypes.ATTRIBUTE),
]
export const compilerOptions: CompilerOptions = {
  nodeTransforms,
}

export const customElements = [
  'lifestyle',
  'life-follow',
  'contact-button',
  'spread',
  'error-view',
  'poster',
  'cashier',
  'ix-grid',
  'ix-native-grid',
  'ix-native-list',
  'mkt',
]

export const options: UniMiniProgramPluginOptions = {
  cdn: 2,
  vite: {
    inject: {
      uni: [path.resolve(__dirname, 'uni.api.esm.js'), 'default'],
    },
    alias: {
      'uni-mp-runtime': path.resolve(__dirname, 'uni.mp.esm.js'),
    },
    copyOptions: {
      assets: ['mycomponents'],
      targets: process.env.UNI_MP_PLUGIN ? [copyMiniProgramPluginJson] : [],
    },
  },
  global: 'my',
  json: {
    windowOptionsMap: {
      defaultTitle: 'navigationBarTitleText',
      pullRefresh: 'enablePullDownRefresh',
      allowsBounceVertical: 'allowsBounceVertical',
      titleBarColor: 'navigationBarBackgroundColor',
      optionMenu: 'optionMenu',
      backgroundColor: 'backgroundColor',
      usingComponents: 'usingComponents',
      navigationBarShadow: 'navigationBarShadow',
      titleImage: 'titleImage',
      transparentTitle: 'transparentTitle',
      titlePenetrate: 'titlePenetrate',
    },
    tabBarOptionsMap: {
      textColor: 'color',
      selectedColor: 'selectedColor',
      backgroundColor: 'backgroundColor',
      items: 'list',
    },
    tabBarItemOptionsMap: {
      pagePath: 'pagePath',
      name: 'text',
      icon: 'iconPath',
      activeIcon: 'selectedIconPath',
    },
  },
  app: {
    darkmode: false,
    subpackages: true,
    plugins: true,
  },
  project: {
    filename: projectConfigFilename,
    source,
  },
  template: {
    /* eslint-disable no-restricted-syntax */
    ...miniProgram,
    customElements,
    filter: {
      extname: '.sjs',
      lang: 'sjs',
      generate(filter, filename) {
        // TODO 标签内的 code 代码需要独立生成一个 sjs 文件
        // 暂不处理，让开发者自己全部使用 src 引入
        return `<import-sjs name="${filter.name}" from="${filename}.sjs"/>`
      },
    },
    extname: '.axml',
    compilerOptions,
  },
  style: {
    extname: '.acss',
  },
}