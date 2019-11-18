import 'babel-polyfill'
import Vue from 'vue'
import App from './components/App.vue'
import store from './store'
import { currency } from './currency'

console.log('shopping-cart store', store)

Vue.filter('currency', currency)

const vm = new Vue({
  el: '#app',
  store,
  render: h => h(App)
})

console.log('shopping-cart vm', vm)
