import applyMixin from './mixin'
import devtoolPlugin from './plugins/devtool'
import ModuleCollection from './module/module-collection'
import { forEachValue, isObject, isPromise, assert, partial } from './util'

let Vue // bind on install

export class Store {
  constructor (options = {}) {
    // Auto install if it is not done yet and `window` has `Vue`.
    // To allow users to avoid auto-installation in some cases,
    // this code should be placed here. See #731
    // 如果是 cdn script 引入vuex插件，则自动安装vuex插件，不需要用Vue.use(Vuex)来安装
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue)
    }

    // 不是生产环境
    // 断言函数
    /**
     * 条件 断言 不满足直接抛出错误
      export function assert (condition, msg) {
        if (!condition) throw new Error(`[vuex] ${msg}`)
      }
     */

    if (process.env.NODE_ENV !== 'production') {
      // 可能有读者会问：为啥不用console.assert，console.assert函数报错不会阻止后续代码执行
      // 必须使用Vue.use(Vuex) 创建 store 实例
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      // 当前环境不支持Promise，报错：vuex需要Promise polyfill
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      // Store 函数必须使用new操作符调用
      assert(this instanceof Store, `store must be called with the new operator.`)
    }

    const {
      // 插件默认是空数组
      plugins = [],
      // 严格模式默认是false
      strict = false
    } = options

    // store internal state
    // store实例 内部的 state
    this._committing = false
    // 用来存放处理后的用户自定义的actoins
    /**
     * 提一下 Object.create(null) 和 {} 的区别。前者没有原型链，后者有。
        即 Object.create(null).__proto__ 是 undefined
        ({}).__proto__ 是 Object.prototype
     */
    this._actions = Object.create(null)
    // 用来存放 actions 订阅
    this._actionSubscribers = []
    // 用来存放处理后的用户自定义的mutations
    this._mutations = Object.create(null)
    // 用来存放处理后的用户自定义的 getters
    this._wrappedGetters = Object.create(null)
    // 模块收集器，构造模块树形结构
    this._modules = new ModuleCollection(options)
    // 用于存储模块命名空间的关系
    this._modulesNamespaceMap = Object.create(null)
    // 订阅
    this._subscribers = []
    // 用于使用 $watch 观测 getters
    this._watcherVM = new Vue()
    // 用来存放生成的本地 getters 的缓存
    this._makeLocalGettersCache = Object.create(null)

    // bind commit and dispatch to self
    // 给自己 绑定 commit 和 dispatch
    const store = this
    const { dispatch, commit } = this
    // 为何要这样绑定 ?
    // 说明调用commit和dispach 的 this 不一定是 store 实例
    // 这是确保这两个函数里的this是store实例
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    // 严格模式，默认是false
    this.strict = strict

    // 根模块的state
    const state = this._modules.root.state

    // init root module.
    // this also recursively registers all sub-modules
    // and collects all module getters inside this._wrappedGetters
    // 初始化 根模块
    // 并且也递归的注册所有子模块
    // 并且收集所有模块的 getters 放在 this._wrappedGetters 里面
    installModule(this, state, [], this._modules.root)

    // initialize the store vm, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    // 初始化 store._vm 响应式的
    // 并且注册 _wrappedGetters 作为 computed 的属性
    resetStoreVM(this, state)

    // apply plugins
    // 把实例store传给插件函数，执行所有插件
    plugins.forEach(plugin => plugin(this))

    // 初始化 vue-devtool 开发工具
    // 参数 devtools 传递了取 devtools 否则取Vue.config.devtools 配置
    const useDevtools = options.devtools !== undefined ? options.devtools : Vue.config.devtools
    if (useDevtools) {
      devtoolPlugin(this)
    }
  }

  get state () {
    return this._vm._data.$$state
  }

  // 设置 state 非生产环境报错
  set state (v) {
    if (process.env.NODE_ENV !== 'production') {
      // 使用 replaceState() 替换
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }

  commit (_type, _payload, _options) {
    // check object-style commit
    // 统一成对象风格
    /**
    * 支持多种方式
    * 最后返回  { type, payload, options }
     * this.$store.commit('increment', {
     *    count: 10
     *  })
     *  // 对象提交方式
     *  this.$store.commit({
     *    type: 'increment',
     *    count: 10
     *  })
     */
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    const entry = this._mutations[type]
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    this._withCommit(() => {
      entry.forEach(function commitIterator (handler) {
        handler(payload)
      })
    })
    this._subscribers.forEach(sub => sub(mutation, this.state))

    if (
      process.env.NODE_ENV !== 'production' &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  dispatch (_type, _payload) {
    // check object-style dispatch
    // 获取到type和payload参数
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    // 声明 action 变量 等于 type和payload参数
    const action = { type, payload }
    // 入口，也就是 _actions 集合
    const entry = this._actions[type]
    // 如果不存在
    if (!entry) {
      // 非生产环境报错，匹配不到 action 类型
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      // 不往下执行
      return
    }

    try {
      this._actionSubscribers
        .filter(sub => sub.before)
        .forEach(sub => sub.before(action, this.state))
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[vuex] error in before action subscribers: `)
        console.error(e)
      }
    }

    const result = entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)

    return result.then(res => {
      try {
        this._actionSubscribers
          .filter(sub => sub.after)
          .forEach(sub => sub.after(action, this.state))
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[vuex] error in after action subscribers: `)
          console.error(e)
        }
      }
      return res
    })
  }

  subscribe (fn) {
    return genericSubscribe(fn, this._subscribers)
  }

  subscribeAction (fn) {
    const subs = typeof fn === 'function' ? { before: fn } : fn
    return genericSubscribe(subs, this._actionSubscribers)
  }

  /**
   * 观测某个值
   * @param {Function} getter 函数
   * @param {Function} cb 回调
   * @param {Object} options 参数对象
   */
  watch (getter, cb, options) {
    if (process.env.NODE_ENV !== 'production') {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
  }

  replaceState (state) {
    this._withCommit(() => {
      this._vm._data.$$state = state
    })
  }

  /**
   * 动态注册模块
   * @param {Array|String} path 路径
   * @param {Object} rawModule 原始未加工的模块
   * @param {Object} options 参数选项
   */
  registerModule (path, rawModule, options = {}) {
    // 如果 path 是字符串，转成数组
    if (typeof path === 'string') path = [path]

    // 非生产环境
    if (process.env.NODE_ENV !== 'production') {
      // path不是数组，报错：必须是字符串或者数组
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      // 如果path长度大于0，报错不能使用 register 注册根模块
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    // 手动调用 模块注册的方法
    this._modules.register(path, rawModule)
    // 安装模块
    installModule(this, this.state, path, this._modules.get(path), options.preserveState)
    // reset store to update getters...
    // 设置 resetStoreVM
    resetStoreVM(this, this.state)
  }

  /**
   * 注销模块
   * @param {Array|String} path 路径
   */
  unregisterModule (path) {
    // 如果 path 是字符串，转成数组
    if (typeof path === 'string') path = [path]

    // 非生产环境
    if (process.env.NODE_ENV !== 'production') {
      // path不是数组，报错：必须是字符串或者数组
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    // 手动调用模块注销
    this._modules.unregister(path)
    this._withCommit(() => {
      // 注销这个模块
      const parentState = getNestedState(this.state, path.slice(0, -1))
      Vue.delete(parentState, path[path.length - 1])
    })
    // 重置Store
    resetStore(this)
  }

  // 热加载
  hotUpdate (newOptions) {
    this._modules.update(newOptions)
    resetStore(this, true)
  }

  // 内部方法 _withCommit _committing 变量 主要是给严格模式下
  // enableStrictMode函数 监控是否是通过这个函数修改，不是则报错。
  _withCommit (fn) {
    // 存储committing 变量
    const committing = this._committing
    // committing 为 true
    this._committing = true
    // 执行参数 fn 函数
    fn()
    // committing 为 true
    this._committing = committing
  }
}

function genericSubscribe (fn, subs) {
  if (subs.indexOf(fn) < 0) {
    subs.push(fn)
  }
  return () => {
    const i = subs.indexOf(fn)
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}

/**
 * 重置Store
 * @param {Object} store Store 实例对象
 * @param {Boolean} hot 热加载
 */
function resetStore (store, hot) {
  // 重置 _actions 为空对象
  store._actions = Object.create(null)
  // 重置 _mutations 为空对象
  store._mutations = Object.create(null)
  // 重置 _wrappedGetters 为空对象
  store._wrappedGetters = Object.create(null)
  // 重置 _modulesNamespaceMap 为空对象
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // init all modules
  // 初始化所有模块
  installModule(store, state, [], store._modules.root, true)
  // reset vm
  // 重置
  resetStoreVM(store, state, hot)
}

function resetStoreVM (store, state, hot) {

  // 存储一份老的Vue实例对象 _vm
  const oldVm = store._vm

  // bind store public getters
  // 绑定store.getter
  store.getters = {}
  // reset local getters cache
  // 重置 本地getters的缓存
  store._makeLocalGettersCache = Object.create(null)
  // 注册时收集的处理后的用户自定义的 wrappedGetters
  const wrappedGetters = store._wrappedGetters
  // 声明 计算属性 computed 对象
  const computed = {}
  // 遍历 wrappedGetters 赋值到computed 上
  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    // direct inline function use will lead to closure preserving oldVm.
    // using partial to return function with only arguments preserved in closure environment.
    /**
     * partial 函数
     * 执行函数 返回一个新函数
        export function partial (fn, arg) {
          return function () {
            return fn(arg)
          }
        }
     */
    computed[key] = partial(fn, store)
    // getter 赋值 keys
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      // 可以枚举
      enumerable: true // for local getters
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  // 使用一个 Vue 实例对象存储 state 树
  // 阻止警告 用户添加的一些全局mixins

  // 声明变量 silent 存储用户设置的静默模式配置
  const silent = Vue.config.silent
  // 静默模式开启
  Vue.config.silent = true
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  })
  // 把存储的静默模式配置赋值回来
  Vue.config.silent = silent

  // enable strict mode for new vm
  // 开启严格模式 执行这句
  // 用$watch 观测 state，只能使用 mutation 修改 也就是 _withCommit 函数
  if (store.strict) {
    enableStrictMode(store)
  }

  // 如果存在老的 _vm 实例
  if (oldVm) {
    // 热加载为 true
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      // 设置  oldVm._data.$$state = null
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    // 实例销毁
    Vue.nextTick(() => oldVm.$destroy())
  }
}

function installModule (store, rootState, path, module, hot) {
  // 是根模块
  const isRoot = !path.length
  // 命名空间 字符串
  /**
   * getNamespace (path) {
      let module = this.root
      return path.reduce((namespace, key) => {
        module = module.getChild(key)
        return namespace + (module.namespaced ? key + '/' : '')
      }, '')
    }
  */
  const namespace = store._modules.getNamespace(path)

  // register in namespace map
  // 注册在命名空间的map对象中。
  // 模块命名控件为 true 执行以下代码
  if (module.namespaced) {
    // 模块命名空间map对象中已经有了，开发环境报错提示重复
    if (store._modulesNamespaceMap[namespace] && process.env.NODE_ENV !== 'production') {
      console.error(`[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`)
    }
    // module 赋值给 _modulesNamespaceMap[namespace]
    store._modulesNamespaceMap[namespace] = module
  }

  // set state
  // 不是根模块且不是热重载
  if (!isRoot && !hot) {
    // 获取父级的state
    const parentState = getNestedState(rootState, path.slice(0, -1))
    // 模块名称
    // 比如 cart
    const moduleName = path[path.length - 1]
    // state 注册
    store._withCommit(() => {
      if (process.env.NODE_ENV !== 'production') {
        if (moduleName in parentState) {
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join('.')}"`
          )
        }
      }
      /**
       * 最后得到的是类似这样的结构且是响应式的数据 比如
       *
       Store实例：{
        // 省略若干属性和方法
        // 这里的state是只读属性 可搜索 get state 查看
        state: {
          cart: {
            checkoutStatus: null,
            items: []
          }
        }
       }
       *
       */
      Vue.set(parentState, moduleName, module.state)
    })
  }

  // module.context  这个赋值主要是给 helpers 中 mapState、mapGetters、mapMutations、mapActions四个辅助函数使用的。
  const local = module.context = makeLocalContext(store, namespace, path)

  /**
   * 循环遍历注册 mutation
   * module.forEachMutation 函数 ===== forEachAction 和 forEachGetter 也类似
   * 定义在 class Module 里
   * _rawModule.mutations 是用户定义的未加工的mutations
    * forEachMutation (fn) {
    *   if (this._rawModule.mutations) {
    *     forEachValue(this._rawModule.mutations, fn)
    *   }
    * }
    */
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key
    registerMutation(store, namespacedType, mutation, local)
  })

  // 循环遍历注册 action
  module.forEachAction((action, key) => {
    const type = action.root ? key : namespace + key
    const handler = action.handler || action
    registerAction(store, type, handler, local)
  })

  // 循环遍历注册 getter
  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key
    registerGetter(store, namespacedType, getter, local)
  })

  /**
   * 注册子模块
   * forEachChild (fn) {
        forEachValue(this._children, fn)
      }
   */
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
  })
}

/**
 * make localized dispatch, commit, getters and state
 * if there is no namespace, just use root ones
 */
/**
 * 生成本地的dispatch、commit、getters和state
 * 主要作用就是抹平差异化，不需要用户再传模块参数
 * @examples 比如 购物车的例子中，commit('setProducts', products)
 *           实际上会拼接成commit('products/setProducts', products) 去执行
 * @param {Object} store Store实例
 * @param {String} namespace 命名空间
 * @param {Array} path 路径
 */
function makeLocalContext (store, namespace, path) {
  // 声明变量 没有命名空间
  const noNamespace = namespace === ''

  const local = {
    // 如果没有命名空间就用 store.dispatch 函数
    // 否则添加模块
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      // 为啥取payload, options, type要分开来写，是因为type需要修改，所以用let声明
      // 正常情况下都可以用let声明，不管改不改
      // 但 这个项目 eslint 校验 如果payload，options等值不修改不能用let声明
      const { payload, options } = args
      let { type } = args

      // 如果 第三个参数 options 没传，则是 undefined ，!options 则是 true
      // 或者 !options.root 为 true
      if (!options || !options.root) {
        // 类型 命名空间字符串拼接
        type = namespace + type
        // 非生成环境，最终收集的 _ations 里找不到，报错不知道的局部type和全局type。
        if (process.env.NODE_ENV !== 'production' && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }

      // 返回 store.dispatch
      return store.dispatch(type, payload)
    },

    // commit 和 dispatch类似，就不再细述
    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      // 如果 第三个参数 options 没传，则是 undefined ，!options 则是 true
      // 或者 !options.root 为 true
      if (!options || !options.root) {
        type = namespace + type
        if (process.env.NODE_ENV !== 'production' && !store._mutations[type]) {
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }

      store.commit(type, payload, options)
    }
  }

  // getters and state object must be gotten lazily
  // because they will be changed by vm update
  // getters 和 state 对象 获取 必须 延迟
  // 因为它们将被vm update 修改
  Object.defineProperties(local, {
    getters: {
      // 没有命名空间，直接取值 store.getters
      get: noNamespace
        ? () => store.getters
        // 否则
        : () => makeLocalGetters(store, namespace)
    },
    state: {
      get: () => getNestedState(store.state, path)
    }
  })

  return local
}

function makeLocalGetters (store, namespace) {
  // _makeLocalGettersCache 缓存是vuex v3.1.2中 加的
  // 如果不存在getters本地缓存中不存在，才执行下面的代码
  // 如果存在直接返回
  // return store._makeLocalGettersCache[namespace]
  if (!store._makeLocalGettersCache[namespace]) {
    // 声明 gettersProxy对象
    const gettersProxy = {}
    // 命名空间 长度
    const splitPos = namespace.length
    // 其实这里可以用util中的forEachValue方法优化
    /**
     *
    export function forEachValue (obj, fn) {
      Object.keys(obj).forEach(key => fn(obj[key], key))
    }
    * forEach for object
    */
    Object.keys(store.getters).forEach(type => {
      // skip if the target getter is not match this namespace
      // 如果目标getters没有匹配到命名空间直接跳过
      if (type.slice(0, splitPos) !== namespace) return

      // extract local getter type
      // 提取本地type
      const localType = type.slice(splitPos)

      // Add a port to the getters proxy.
      // Define as getter property because
      // we do not want to evaluate the getters in this time.
      // 添加一个代理
      // 定义getters 属性
      // 因为我们现在不想计算getters
      Object.defineProperty(gettersProxy, localType, {
        get: () => store.getters[type],
        // 可以枚举
        enumerable: true
      })
    })
    // 赋值
    store._makeLocalGettersCache[namespace] = gettersProxy
  }

  // 如果存在直接返回
  return store._makeLocalGettersCache[namespace]
}

/**
 * 注册 mutation
 * @param {Object} store 对象
 * @param {String} type 类型
 * @param {Function} handler 用户自定义的函数
 * @param {Object} local local 对象
 */
function registerMutation (store, type, handler, local) {
  // 收集的所有的mutations找对应的mutation函数，没有就赋值空数组
  const entry = store._mutations[type] || (store._mutations[type] = [])
  // 最后 mutation
  entry.push(function wrappedMutationHandler (payload) {
    /**
     * mutations: {
     *    pushProductToCart (state, { id }) {
     *        console.log(state);
     *    }
     * }
     * 也就是为什么用户定义的 mutation 第一个参数是state的原因，第二个参数是payload参数
     */
    handler.call(store, local.state, payload)
  })
}

/**
* 注册 mutation
* @param {Object} store 对象
* @param {String} type 类型
* @param {Function} handler 用户自定义的函数
* @param {Object} local local 对象
*/
function registerAction (store, type, handler, local) {
  const entry = store._actions[type] || (store._actions[type] = [])
  // payload 是actions函数的第二个参数
  entry.push(function wrappedActionHandler (payload) {
    /**
     * 也就是为什么用户定义的actions中的函数第一个参数有
     *  { dispatch, commit, getters, state, rootGetters, rootState } 的原因
     * actions: {
     *    checkout ({ commit, state }, products) {
     *        console.log(commit, state);
     *    }
     * }
     */
    let res = handler.call(store, {
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state
    }, payload)
    /**
     * export function isPromise (val) {
        return val && typeof val.then === 'function'
      }
     * 判断如果不是Promise Promise 化，也就是为啥 actions 中处理异步函数
        也就是为什么构造函数中断言不支持promise报错的原因
        vuex需要Promise polyfill
        assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
     */
    if (!isPromise(res)) {
      res = Promise.resolve(res)
    }
    // devtool 工具触发 vuex:error
    if (store._devtoolHook) {
      // catch 捕获错误
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        // 抛出错误
        throw err
      })
    } else {
      // 然后函数执行结果
      return res
    }
  })
}

/**
 * 注册 getter
 * @param {Object} store  Store实例
 * @param {String} type 类型
 * @param {Object} rawGetter  原始未加工的 getter 也就是用户定义的 getter 函数
 * @examples  比如 cartProducts: (state, getters, rootState, rootGetters) => {}
 * @param {Object} local 本地 local 对象
 */
function registerGetter (store, type, rawGetter, local) {
  // 类型如果已经存在，报错：已经存在
  if (store._wrappedGetters[type]) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  // 否则：赋值
  store._wrappedGetters[type] = function wrappedGetter (store) {
    /**
     * 这也就是为啥 getters 中能获取到  (state, getters, rootState, rootGetters)  这些值的原因
     * getters = {
     *      cartProducts: (state, getters, rootState, rootGetters) => {
     *        console.log(state, getters, rootState, rootGetters);
     *      }
     * }
     */
    return rawGetter(
      local.state, // local state
      local.getters, // local getters
      store.state, // root state
      store.getters // root getters
    )
  }
}
// 开启严格模式下，深度监控 state 的变化
// 如果 state 不是通过 this._withCommit() 方法修改，则报错。
function enableStrictMode (store) {
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (process.env.NODE_ENV !== 'production') {
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}

// 根据路径来获取嵌套的state
function getNestedState (state, path) {
  return path.length
    ? path.reduce((state, key) => state[key], state)
    : state
}

// 统一成对象风格
function unifyObjectStyle (type, payload, options) {
  /**
    * 支持多种方式
    * 最后返回  { type, payload, options }
     * this.$store.commit('increment', {
     *    count: 10
     *  })
     *  // 对象提交方式
     *  this.$store.commit({
     *    type: 'increment',
     *    count: 10
     *  })
     */
  if (isObject(type) && type.type) {
    options = payload
    payload = type
    type = type.type
  }

  // type不是字符串类型，非生产环境报错
  if (process.env.NODE_ENV !== 'production') {
    assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`)
  }

  return { type, payload, options }
}

export function install (_Vue) {
  // Vue 已经存在并且相等，说明已经Vuex.use过
  if (Vue && _Vue === Vue) {
    // 非生产环境报错，vuex已经安装，代码继续执行
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  Vue = _Vue
  applyMixin(Vue)
}
