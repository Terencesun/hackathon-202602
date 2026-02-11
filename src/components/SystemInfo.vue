<script setup lang="ts">
import { computed } from 'vue';
import { useUserStore } from '../stores/user';
import { logout } from '../api/client';
import { LogOut, Loader2 } from 'lucide-vue-next';

const userStore = useUserStore();
const agent = computed(() => userStore.agent);

async function handleCommand(command: string) {
  if (command !== 'logout') return;

  try {
    await logout();
  } catch { void 0 }

  userStore.clearSession();
  if (window.location.pathname !== '/') {
    window.location.assign('/');
  }
}
</script>

<template>
  <div class="grid grid-flow-col gap-4 pointer-events-auto">
    <div class="pixel-card font-mono text-sm grid grid-flow-col items-center gap-2">
      <Loader2 class="w-4 h-4 animate-spin text-primary" />
      <span>TICK: <span class="text-primary">{{ agent?.currentTick }}</span></span>
    </div>
    <button 
      class="pixel-card-icon hover:bg-white/20 transition-colors"
      title="退出登录"
      @click="handleCommand('logout')"
    >
      <LogOut class="w-5 h-5 text-white" />
    </button>
  </div>
</template>
