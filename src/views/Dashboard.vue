<script setup lang="ts">
import { computed } from 'vue';
import { useUserStore } from '../stores/user';
import { logout } from '../api/client';
import { User, Wallet, Briefcase, Coffee } from 'lucide-vue-next';

const userStore = useUserStore();
const agent = computed(() => userStore.agent);

async function handleCommand(command: string) {
  if (command !== 'logout') return;

  try {
    await logout();
  } catch {}

  userStore.clearSession();
  if (window.location.pathname !== '/') {
    window.location.assign('/');
  }
}

const sceneColor = computed(() => {
  switch (agent.value?.identity) {
    case 'worker': return 'bg-factory'; // 灰色
    case 'dorm': return 'bg-dorm'; // 黄色（若存在 'dorm' 状态/身份，可理解为宿舍）
    // 实际 identity 取值为：'worker' | 'broker' | 'layflat'。
    // PRD 4.2：工厂（灰）、宿舍（黄）、办公室（蓝）。
    // 代理所在场景通常由 identity 隐含。
    // 'worker' -> 工厂，'layflat' -> 宿舍，'broker' -> 办公室。
    case 'layflat': return 'bg-dorm'; 
    case 'broker': return 'bg-office';
    default: return 'bg-container';
  }
});

const identityIcon = computed(() => {
    switch (agent.value?.identity) {
        case 'worker': return Briefcase;
        case 'broker': return User; // 或者用西装图标
        case 'layflat': return Coffee;
        default: return User;
    }
});
</script>

<template>
  <div class="min-h-screen bg-background text-text flex flex-col">
    <!-- 头部 -->
    <header class="h-16 border-b border-container-secondary flex items-center px-6 justify-between bg-container">
      <h1 class="font-bold text-xl font-mono">
        My Agent
      </h1>
      <el-dropdown trigger="click" @command="handleCommand">
        <div class="flex items-center gap-4 cursor-pointer select-none">
          <span class="text-sm text-text-secondary">{{ userStore.user?.name }}</span>
          <el-avatar
            :size="32"
            :src="userStore.user?.metadata?.avatar || ''"
          >
            {{ userStore.user?.name?.charAt(0) }}
          </el-avatar>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </header>

    <main class="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- 状态卡片 -->
      <div class="md:col-span-1 space-y-6">
        <div class="bg-container p-6 rounded-lg border border-container-secondary shadow-lg">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-text-secondary uppercase tracking-wider">
              Identity
            </h2>
            <component
              :is="identityIcon"
              class="w-6 h-6 text-primary"
            />
          </div>
          <div class="text-3xl font-bold capitalize mb-2">
            {{ agent?.identity }}
          </div>
          <div class="text-sm text-text-secondary">
            Current Role
          </div>
          
          <div class="mt-6 pt-6 border-t border-container-secondary">
            <div class="flex items-center justify-between mb-2">
              <span class="text-text-secondary">Wealth</span>
              <Wallet class="w-4 h-4 text-alert" />
            </div>
            <div class="text-2xl font-mono text-primary">
              ¥{{ agent?.currentIncome?.toFixed(2) }}
            </div>
          </div>
          
          <div class="mt-6">
            <div class="text-xs text-text-secondary mb-1">
              Working Hours
            </div>
            <el-progress
              :percentage="Math.min((agent?.workingHours || 0) / 12 * 100, 100)"
              :format="() => `${agent?.workingHours}h`"
              status="success"
            />
          </div>
        </div>

        <!-- 想法 / 决策 -->
        <div class="bg-container p-6 rounded-lg border border-container-secondary">
          <h3 class="font-bold mb-4">
            Latest Decision
          </h3>
          <p class="text-sm text-text-secondary italic">
            "Thinking about the next tick..."
          </p>
          <el-button
            class="mt-4 w-full"
            plain
            size="small"
          >
            View Decision Log
          </el-button>
        </div>
      </div>

      <!-- 场景可视化 -->
      <div class="md:col-span-2 bg-container rounded-lg border border-container-secondary overflow-hidden flex flex-col">
        <div class="p-4 border-b border-container-secondary flex justify-between items-center">
          <h2 class="font-bold">
            Live Scene
          </h2>
          <span class="px-2 py-1 text-xs rounded bg-container-secondary text-text-secondary font-mono">Tick: {{ agent?.currentTick }}</span>
        </div>
        <div :class="['flex-1 flex items-center justify-center transition-colors duration-500', sceneColor]">
          <div class="text-center p-8 bg-black/20 backdrop-blur-sm rounded-xl">
            <component
              :is="identityIcon"
              class="w-24 h-24 text-white mx-auto mb-4 opacity-80"
            />
            <h3 class="text-2xl font-bold text-white shadow-sm capitalize">
              {{ agent?.identity }} Mode
            </h3>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
