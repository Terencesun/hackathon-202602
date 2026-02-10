import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import AuthCallback from '../views/AuthCallback.vue';
import Dashboard from '../views/Dashboard.vue';
import Rank from '../views/Rank.vue';
import { useUserStore } from '../stores/user';
import { hydrateSession } from '../lib/session';

const routes = [
  { path: '/', component: Login },
  { path: '/auth/callback', component: AuthCallback },
  { path: '/dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/rank', component: Rank, meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const userStore = useUserStore();

  if (to.meta.requiresAuth && !userStore.user) {
    await hydrateSession(userStore);
    if (!userStore.user) return '/';
  }
  return true;
});

export default router;
