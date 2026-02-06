import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuth } from './stores/auth'
import { loadAppConfig } from './config/app'
import './index.css'

const app = createApp(App)
app.use(router)

// Initialize app config and auth state on app start
Promise.all([
  loadAppConfig(),
  useAuth().fetchCurrentUser()
]).then(() => {
  app.mount('#app')
})
