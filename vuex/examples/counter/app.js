import 'babel-polyfill'
import Vue from 'vue'
import Counter from './Counter.vue'
import store from './store'

console.log('line-6---store', store)

var vm = new Vue({
  el: '#app',
  store,
  render: h => h(Counter)
})
console.log('13--line-----vm', vm)
