<template>
  <div class="cart">
    <h2>Your Cart</h2>
    <p v-show="!products.length"><i>Please add some products to cart.</i></p>
    <ul>
      <li
        v-for="product in products"
        :key="product.id">
        {{ product.title }} - {{ product.price | currency }} x {{ product.quantity }}
      </li>
    </ul>
    <p>Total: {{ total | currency }}</p>
    <p><button :disabled="!products.length" @click="checkout(products)">Checkout</button></p>
    <p v-show="checkoutStatus">Checkout {{ checkoutStatus }}.</p>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
const state = mapState({
  checkoutStatus: state => state.cart.checkoutStatus
})

const getters = mapGetters('cart', {
  products: 'cartProducts',
  total: 'cartTotalPrice'
})

console.log('%c shoppingCart.vue, state, getters', 'color: #03A9F4; font-weight: bold', state, getters)

export default {
  computed: {
    // ...mapState({
    //   checkoutStatus: state => state.cart.checkoutStatus
    // }),
    ...state,
    ...getters
    // ...mapGetters('cart', {
    //   products: 'cartProducts',
    //   total: 'cartTotalPrice'
    // })
  },
  methods: {
    checkout (products) {
      this.$store.dispatch('cart/checkout', products)
    }
  }
}
</script>
