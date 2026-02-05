import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'
import Read from '../pages/Read.vue'
import Write from '../pages/Write.vue'
import Themes from '../pages/Themes.vue'
import Profile from '../pages/Profile.vue'

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
      component: Write
    },
    {
      path: '/themes',
      name: 'Themes',
      component: Themes
    },
    {
      path: '/profile',
      name: 'Profile',
      component: Profile
    }
  ]
})

export default router
