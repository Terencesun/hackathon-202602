import axios from 'axios';
import { useUserStore } from '../stores/user';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
});

const authClient = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
});

export async function logout() {
  await authClient.post('/auth/logout');
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config;
    const url: string | undefined = config?.url;

    if (
      (status === 401 || status === 403) &&
      !(config as any)?.__handledAuthFailure &&
      url &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/logout')
    ) {
      (config as any).__handledAuthFailure = true;
      try {
        await logout();
      } catch {}

      const userStore = useUserStore();
      userStore.clearSession();

      if (window.location.pathname !== '/') {
        window.location.assign('/');
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
