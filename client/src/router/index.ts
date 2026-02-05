import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'
import Home from '../pages/Home.vue'
import Read from '../pages/Read.vue'
import Write from '../pages/Write.vue'
import Themes from '../pages/Themes.vue'
import Profile from '../pages/Profile.vue'
import SignIn from '../pages/SignIn.vue'
import SignUp from '../pages/SignUp.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home
    },
    {
      path: '/read/:id?',
      name: 'Read',
      component: Read
    },
    {
      path: '/write',
      name: 'Write',
      component: Write,
      meta: { requiresAuth: true }
    },
    {
      path: '/themes',
      name: 'Themes',
      component: Themes
    },
    {
      path: '/profile',
      name: 'Profile',
      component: Profile,
      meta: { requiresAuth: true }
    },
    {
      path: '/signin',
      name: 'SignIn',
      component: SignIn,
      meta: { requiresGuest: true }
    },
    {
      path: '/signup',
      name: 'SignUp',
      component: SignUp,
      meta: { requiresGuest: true }
    }
  ]
})

// Route guards
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, fetchCurrentUser } = useAuth()
  
  // Fetch current user if not already loaded
  if (!isAuthenticated.value) {
    await fetchCurrentUser()
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next({ name: 'SignIn', query: { redirect: to.fullPath } })
    return
  }

  // Check if route requires guest (not authenticated)
  if (to.meta.requiresGuest && isAuthenticated.value) {
    next({ name: 'Home' })
    return
  }

  next()
})

export default router
