import { defineStore } from 'pinia';
import { ref } from 'vue';

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
  }

  return { user, agent, setProfile, clearSession };
});
