import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import './style.css';
import App from './App.vue';
import { VueQueryPlugin } from '@tanstack/vue-query';

const app = createApp(App);

// Register plugins
app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);

// Mount app
app.mount('#app');
