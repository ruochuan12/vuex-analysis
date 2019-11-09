# 学习 vuex 源码整体架构

## 前言

>这是学习源码整体架构第五篇。整体架构这词语好像有点大，姑且就算是源码整体结构吧，主要就是学习是代码整体结构，不深究其他不是主线的具体函数的实现。本篇文章学习的是实际仓库的代码。

其余四篇分别是：
>1.[学习 jQuery 源码整体架构，打造属于自己的 js 类库](https://juejin.im/post/5d39d2cbf265da1bc23fbd42)<br/>
>2.[学习 underscore 源码整体架构，打造属于自己的函数式编程类库](https://juejin.im/post/5d4bf94de51d453bb13b65dc)<br/>
>3.[学习 lodash 源码整体架构，打造属于自己的函数式编程类库](https://juejin.im/post/5d767e1d6fb9a06b032025ea)<br/>
>4.[学习 sentry 源码整体架构，打造属于自己的前端异常监控SDK](https://juejin.im/post/5dba5a39e51d452a2378348a)<br/>

感兴趣的读者可以点击阅读。

**导读**<br/>

## chrome 浏览器调试 vuex 源码方法

[Vue文档：在 VS Code 中调试Vue](https://cn.vuejs.org/v2/cookbook/debugging-in-vscode.html)<br/>
从上文中同理可得调试 `vuex` 方法，这里详细说下，便于帮助到可能不知道如何调试源码的读者。<br/>
可以把我的这个 [vuex-analysis](https://github.com/lxchuan12/vuex-analysis) 源码分析仓库`fork`一份或者直接克隆下来，
`git clone https://github.com/lxchuan12/vuex-analysis.git`
>
>其中文件夹`vuex`，是克隆官方的`vuex`仓库 `dev`分支。<br/>
>`git clone https://github.com/vuejs/vuex.git` <br/>
TODO:  修改时间和commit<br/>
>截至目前（2019年11月），版本是`v3.1.1`，最新一次commit是`540b81f`，`2019-11-09 16:45 Sai`。<br/>
>包含我的注释，便于理解。<br/>

克隆完成后， 在`vuex/examples/webpack.config.js` 中添加`devtool`配置。
```js
// 新增devtool配置，便于调试
devtool: 'source-map',
output: {}
```

```bash
cd vuex
npm i
npm run dev
# 打开localhost:8080
# 点击你想打开的例子，例如：Shopping Cart
# 打开控制面板 source 在左侧找到 webapck//      .    src 目录 store文件 根据自己需求断点调试即可。
```

正文开始～

## Vue.use 安装

[文档 Vue.use](https://cn.vuejs.org/v2/api/#Vue-use)
Vue.use(Vuex)

>参数：
{Object | Function} plugin
>用法：<br/>
>安装 Vue.js 插件。如果插件是一个对象，必须提供 `install` 方法。如果插件是一个函数，它会被作为 install 方法。`install` 方法调用时，会将 Vue 作为参数传入。<br/>
>该方法需要在调用 `new Vue()` 之前被调用。<br/>
当 install 方法被同一个插件多次调用，插件将只会被安装一次。<br/>

```js
function initUse (Vue) {
  Vue.use = function (plugin) {
    var installedPlugins = (this._installedPlugins || (this._installedPlugins = []));
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    var args = toArray(arguments, 1);
    args.unshift(this);
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args);
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args);
    }
    installedPlugins.push(plugin);
    return this
  };
}
```

### install

`vuex/src/store.js`

```js
export function install (_Vue) {
  if (Vue && _Vue === Vue) {
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
```

### applyMixin

`vuex/src/mixin.js`

```js
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
    const options = this.$options
    // store injection
    if (options.store) {
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } else if (options.parent && options.parent.$store) {
      this.$store = options.parent.$store
    }
  }
}
```


## store

### 构造函数


## Vuex.Store 实例方法

### commit

提交 mutation。

### dispatch

分发 action。

### replaceState

替换 store 的根状态，仅用状态合并或时光旅行调试。

### watch

响应式地侦听 fn 的返回值，当值改变时调用回调函数。

### subscribe

订阅 store 的 mutation。

### subscribeAction

订阅 store 的 action。

### registerModule

注册一个动态模块。

### unregisterModule

卸载一个动态模块。

### hotUpdate

热替换新的 action 和 mutation。

## 组件绑定的辅助函数

### mapState

为组件创建计算属性以返回 Vuex store 中的状态。

### mapGetters

为组件创建计算属性以返回 getter 的返回值。

### mapActions

创建组件方法分发 action。

### mapMutations

创建组件方法提交 mutation。

### createNamespacedHelpers

创建基于命名空间的组件绑定辅助函数。

## 细节点

### isReserved proxy

```js
/**
 * Check if a string starts with $ or _
 */
function isReserved (str) {
  var c = (str + '').charCodeAt(0);
  return c === 0x24 || c === 0x5F
}
```

```js
if (!isReserved(key)) {
	proxy(vm, "_data", key);
}
```

```js
function proxy (target, sourceKey, key) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  };
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val;
  };
  Object.defineProperty(target, key, sharedPropertyDefinition);
}
```

## 插件

### devtool

### logger

## 推荐阅读

[vuex 官方文档](https://vuex.vuejs.org/zh/)<br/>
[vuex github 仓库](https://github.com/vuejs/vuex)<br/>
[美团明裔：Vuex框架原理与源码分析](https://tech.meituan.com/2017/04/27/vuex-code-analysis.html)<br/>
[知乎黄轶：Vuex 2.0 源码分析](https://zhuanlan.zhihu.com/p/23921964)<br/>
[染陌：Vuex 源码解析](https://juejin.im/post/59f66bd7f265da432d275d30)<br/>
[网易考拉前端团队：Vuex 源码分析](https://juejin.im/post/59b88e2e6fb9a00a4f1b0a0b#heading-8)<br/>
[yck：Vuex 源码深度解析](https://yuchengkai.cn/blog/2018-07-31.html)<br/>
[小虫巨蟹：Vuex 源码解析（如何阅读源代码实践篇）](https://juejin.im/post/5962c13c6fb9a06b9e11a6a9)<br/>
[小生方勤：【前端词典】从源码解读 Vuex 注入 Vue 生命周期的过程](https://juejin.im/post/5cb30243e51d456e431ada29)<br/>
