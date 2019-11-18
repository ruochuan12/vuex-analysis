import 'babel-polyfill'
import Vue from 'vue'
import App from './components/App.vue'
import store from './store'
import { currency } from './currency'

console.log('%c shopping-cart store', 'color: #03A9F4; font-weight: bold', store)

Vue.filter('currency', currency)

const vm = new Vue({
  el: '#app',
  store,
  render: h => h(App)
})

console.log('%c shopping-cart vm', 'color: #03A9F4; font-weight: bold', vm)

console.log('vm.$store === vm.$children[0].$store', vm.$store === vm.$children[0].$store) // true
console.log('vm.$store === vm.$children[0].$children[0].$store', vm.$store === vm.$children[0].$children[0].$store) // true
console.log('vm.$store === vm.$children[0].$children[1].$store', vm.$store === vm.$children[0].$children[1].$store) // true
