<script setup lang="ts">
import { useUserStore } from '../stores/user';

const userStore = useUserStore();
</script>

<template>
  <div class="pixel-card pointer-events-auto grid grid-flow-col items-center gap-3">
    <el-avatar
      :size="40"
      :src="userStore.user?.metadata?.avatar || ''"
      class="border-2 border-white/20"
    >
      {{ userStore.user?.name?.charAt(0) }}
    </el-avatar>
    <div>
      <div class="font-bold text-white leading-tight">
        {{ userStore.user?.name }}
      </div>
      <div class="text-xs text-white/60 font-mono">
        ID: {{ userStore.user?.id?.slice(0, 8) }}
      </div>
    </div>
  </div>
</template>
