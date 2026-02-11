import { defineStore } from 'pinia';
import { ref } from 'vue';
import { stopSessionPolling } from '../lib/sessionPolling';

export const useUserStore = defineStore('user', () => {
  const user = ref<any>(null);
  const agent = ref<any>(null);

  function setProfile(newUser: any, newAgent: any) {
    user.value = newUser;
    agent.value = newAgent;
  }

  function clearSession() {
    user.value = null;
    agent.value = null;
    stopSessionPolling();
  }

  return { user, agent, setProfile, clearSession };
});
