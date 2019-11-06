export default function (Vue) {
  const version = Number(Vue.version.split('.')[0])

  if (version >= 2) {
    // 合并选项后 beforeCreate 是数组里函数的形式  [func,  func]
    // 最后调用循环遍历这个数组，调用这些函数，这是一种函数与函数合并的解决方案。
    // 假设是我们自己来设计，会是什么方案呢。
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // override init and inject vuex init procedure
    // for 1.x backwards compatibility.
    const _init = Vue.prototype._init
    Vue.prototype._init = function (options = {}) {
      options.init = options.init
        ? [vuexInit].concat(options.init)
        : vuexInit
      _init.call(this, options)
    }
  }

  /**
   * Vuex init hook, injected into each instances init hooks list.
   */

  function vuexInit () {
    console.log('vuexInit')
    const options = this.$options
    // store 注入
    // 使得每个Vue实例下 都有 $store 这个对象（Store 实例，包含一系列方法和属性），且是同一个对象。
    // 先是判断 options.store 也就是 这个
    /*
    const store = new Vuex.Store();
    new Vue({
      store,
    })
    */
    // store injection
    if (options.store) {
      console.log('options.store')
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } else if (options.parent && options.parent.$store) {
      console.log('options.parent.$store')
      this.$store = options.parent.$store
    }
  }
}
