import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { stopSessionPolling } from '../lib/sessionPolling';

export const useUserStore = defineStore('user', () => {
  const user = ref<any>(null);
  const agent = ref<any>(null);

  const localizedIdentity = computed(() => {
    const map: Record<string, string> = {
      worker: '打工仔',
      layflat: '躺平',
      broker: '中介'
    };
    return map[agent.value?.identity] || agent.value?.identity;
  });

  function setProfile(newUser: any, newAgent: any) {
    user.value = newUser;
    agent.value = newAgent;
  }

  function clearSession() {
    user.value = null;
    agent.value = null;
    stopSessionPolling();
  }

  return { user, agent, localizedIdentity, setProfile, clearSession };
});
