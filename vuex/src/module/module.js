/**
 * forEach for object
    export function forEachValue (obj, fn) {
      Object.keys(obj).forEach(key => fn(obj[key], key))
    }
 */
import { forEachValue } from '../util'

// Base data struct for store's module, package with some attribute and method
// store 的模块 基础数据结构，包括一些属性和方法
export default class Module {
  constructor (rawModule, runtime) {
    // 接收参数 runtime
    this.runtime = runtime
    // Store some children item
    // 存储子模块
    this._children = Object.create(null)
    // Store the origin module object which passed by programmer
    // 存储原始未加工的模块
    this._rawModule = rawModule
    // 模块 state
    const rawState = rawModule.state

    // Store the origin module's state
    // 原始Store 可能是函数，也可能是是对象，是假值，则赋值空对象。
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
  }

  // 获取是否区分命名空间 namespaced，也就是用户自定义的namespaced
  get namespaced () {
    return !!this._rawModule.namespaced
  }

  // 添加子模块
  addChild (key, module) {
    this._children[key] = module
  }
  // 删除子模块
  removeChild (key) {
    delete this._children[key]
  }

  // 获取子模块
  getChild (key) {
    return this._children[key]
  }

  // 更新
  // 把 原始模块作为参数，分别赋值namespaced、actions、mutations、getters
  update (rawModule) {
    this._rawModule.namespaced = rawModule.namespaced
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }

  // 遍历 子模块 主要用在 class Store installModule 函数中
  forEachChild (fn) {
    forEachValue(this._children, fn)
  }

  // 遍历 用户自定义的 action 主要用在 class Store installModule 函数中
  forEachGetter (fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn)
    }
  }

  // 遍历 用户自定义的 action 主要用在 class Store installModule 函数中
  forEachAction (fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn)
    }
  }

  // 遍历 用户自定义的 mutation 主要用在 class Store installModule 函数中
  forEachMutation (fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
