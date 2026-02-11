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

export type AgentMeResponse = {
  id: string;
  identity: string;
  current_income: number;
  current_tick: number;
  interest_tags: string[];
  user: {
    id?: string;
    avatar?: string;
    nickname?: string;
  };
};

export interface RankUser {
  name: string;
  avatar: string;
  income: number;
}

export interface MeTransaction {
  type: string;
  tick: number;
  amount: number;
}

export async function getRank(limit = 50) {
  const { data } = await apiClient.post<{ list: RankUser[]; myRank?: number }>(
    '/agent/rank',
    {},
    {
      params: { limit },
    },
  );
  return data;
}

export async function getMe() {
  const { data } = await apiClient.post<AgentMeResponse>('/agent/me');
  return data;
}

export async function getMeTransactions() {
  const { data } = await apiClient.post<MeTransaction[]>('/agent/me/transactions');
  return data;
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
      } catch { void 0 }

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
