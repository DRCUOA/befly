import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuth } from './stores/auth'
import './index.css'

const app = createApp(App)
app.use(router)

// Initialize auth state on app start
const { fetchCurrentUser } = useAuth()
fetchCurrentUser().then(() => {
  app.mount('#app')
})
