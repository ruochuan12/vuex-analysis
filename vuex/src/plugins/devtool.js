// 目标对象判断
const target = typeof window !== 'undefined'
  ? window
  : typeof global !== 'undefined'
    ? global
    : {}

// devtool
const devtoolHook = target.__VUE_DEVTOOLS_GLOBAL_HOOK__

// 导出插件
export default function devtoolPlugin (store) {
  if (!devtoolHook) return

  store._devtoolHook = devtoolHook

  // 触发vuex:init
  devtoolHook.emit('vuex:init', store)

  // 时光穿梭功能
  devtoolHook.on('vuex:travel-to-state', targetState => {
    // replaceState (state) {
    //   this._withCommit(() => {
    //     this._vm._data.$$state = state
    //   })
    // }
    store.replaceState(targetState)
  })

  // 订阅 mutation
  store.subscribe((mutation, state) => {
    devtoolHook.emit('vuex:mutation', mutation, state)
  })
}
