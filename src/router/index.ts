import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import AuthCallback from '../views/AuthCallback.vue';
import Dashboard from '../views/Dashboard.vue';
import { useUserStore } from '../stores/user';
import { hydrateSession } from '../lib/session';
import { startSessionPolling } from '../lib/sessionPolling';

const routes = [
  { path: '/', component: Login },
  { path: '/auth/callback', component: AuthCallback },
  { path: '/dashboard', component: Dashboard, meta: { requiresAuth: true } },
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

  if (to.meta.requiresAuth && userStore.user) {
    startSessionPolling({
      intervalMs: 5000,
      isLoggedIn: () => !!userStore.user,
      poll: async () => {
        await hydrateSession(userStore, { force: true });
      },
    });
  }
  return true;
});

export default router;
