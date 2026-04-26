import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'
import { isTrackedRoute, setOriginForRoute } from '../stores/navigation'
import Home from '../pages/Home.vue'
import Landing from '../pages/Landing.vue'
import Read from '../pages/Read.vue'
import Write from '../pages/Write.vue'
import Themes from '../pages/Themes.vue'
import ThemeForm from '../pages/ThemeForm.vue'
import ThemeDetail from '../pages/ThemeDetail.vue'
import Manuscripts from '../pages/Manuscripts.vue'
import ManuscriptForm from '../pages/ManuscriptForm.vue'
import ManuscriptDetail from '../pages/ManuscriptDetail.vue'
import Profile from '../pages/Profile.vue'
import SignIn from '../pages/SignIn.vue'
import SignUp from '../pages/SignUp.vue'
import Admin from '../pages/Admin.vue'
import AdminRules from '../pages/AdminRules.vue'
import BaselineTest from '../pages/BaselineTest.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Landing',
      component: Landing
    },
    {
      path: '/home',
      name: 'Home',
      component: Home,
      meta: { requiresAuth: true }
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
      path: '/write/:id',
      name: 'EditWriting',
      component: Write,
      meta: { requiresAuth: true }
    },
    {
      path: '/themes',
      name: 'Themes',
      component: Themes
    },
    {
      path: '/themes/create',
      name: 'CreateTheme',
      component: ThemeForm,
      meta: { requiresAuth: true }
    },
    {
      path: '/themes/edit/:id',
      name: 'EditTheme',
      component: ThemeForm,
      meta: { requiresAuth: true }
    },
    {
      path: '/themes/:id',
      name: 'ThemeDetail',
      component: ThemeDetail
    },
    {
      path: '/manuscripts',
      name: 'Manuscripts',
      component: Manuscripts
    },
    {
      path: '/manuscripts/create',
      name: 'CreateManuscript',
      component: ManuscriptForm,
      meta: { requiresAuth: true }
    },
    {
      path: '/manuscripts/edit/:id',
      name: 'EditManuscript',
      component: ManuscriptForm,
      meta: { requiresAuth: true }
    },
    {
      path: '/manuscripts/:id',
      name: 'ManuscriptDetail',
      component: ManuscriptDetail
    },
    {
      path: '/profile',
      name: 'Profile',
      component: Profile,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin',
      name: 'Admin',
      component: Admin,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/rules',
      name: 'AdminRules',
      component: AdminRules,
      meta: { requiresAuth: true, requiresAdmin: true }
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
    },
    {
      path: '/baseline-test',
      name: 'BaselineTest',
      component: BaselineTest
    }
  ]
})

// Route guards
router.beforeEach(async (to, from, next) => {
  // Track navigation origin: when entering a tracked route from a different
  // route, remember where the user came from so we can return them there later.
  // Skips page refreshes (from.name is undefined) to preserve existing origin.
  if (from.name && to.name !== from.name && isTrackedRoute(to.name as string)) {
    setOriginForRoute(to.name as string, from.fullPath)
  }

  const { isAuthenticated, isAdmin, fetchCurrentUser } = useAuth()
  
  // Fetch current user if not already loaded
  if (!isAuthenticated.value) {
    await fetchCurrentUser()
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next({ name: 'SignIn', query: { redirect: to.fullPath || '/home' } })
    return
  }

  // Check if route requires admin role
  if (to.meta.requiresAdmin && !isAdmin.value) {
    next({ name: 'Home' })
    return
  }

  // Check if route requires guest (not authenticated)
  if (to.meta.requiresGuest && isAuthenticated.value) {
    next({ name: 'Home' })
    return
  }

  // Redirect authenticated users from landing page to home
  if (to.name === 'Landing' && isAuthenticated.value) {
    next({ name: 'Home' })
    return
  }

  // Redirect non-authenticated users from home to landing
  if (to.name === 'Home' && !isAuthenticated.value) {
    next({ name: 'Landing' })
    return
  }

  next()
})

// Reset scroll to top on navigation (pages handle their own restoration)
router.afterEach((to) => {
  // Pages that need scroll restoration handle it themselves
  // For all other pages, reset to top
  if (to.name !== 'Home' && to.name !== 'Read' && to.name !== 'Themes') {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
})

export default router
