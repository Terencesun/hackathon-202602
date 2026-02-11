<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useWorldRankStore } from '../stores/worldRank';
import { Trophy } from 'lucide-vue-next';

const worldRankStore = useWorldRankStore();

onMounted(() => {
  worldRankStore.startPolling();
});

onUnmounted(() => {
  worldRankStore.stopPolling();
});
</script>

<template>
  <div class="pixel-card h-full flex flex-col">
    <h3 class="font-bold text-white/90 mb-2 text-sm border-b border-white/10 pb-2 flex items-center gap-2 shrink-0">
      <Trophy class="w-4 h-4" />
      排行
      <span
        v-if="worldRankStore.myRank"
        class="ml-auto text-xs font-mono text-white/50"
      >
        #{{ worldRankStore.myRank }}
      </span>
    </h3>

    <div class="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto no-scrollbar">
      <div 
        v-if="worldRankStore.rankList.length === 0" 
        class="text-xs text-white/70 italic leading-relaxed"
      >
        Loading rankings...
      </div>
      
      <div 
        v-for="(user, index) in worldRankStore.rankList" 
        v-else 
        :key="index"
        class="group flex justify-between items-center px-3 py-2 rounded bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
      >
        <div class="flex items-center gap-3 overflow-hidden min-w-0">
          <div class="font-mono text-[10px] text-white/30 w-4 text-center shrink-0">
            {{ index + 1 }}
          </div>
          
          <img 
            v-if="user.avatar"
            :src="user.avatar" 
            :alt="user.name"
            class="w-6 h-6 rounded-md bg-gradient-to-br from-white/20 to-white/5 object-cover shrink-0 border border-white/20 shadow-sm"
          >
          <div
            v-else
            class="w-6 h-6 rounded-md bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-[10px] text-white/70 shrink-0 border border-white/20 shadow-sm"
          >
            ?
          </div>

          <span class="font-bold text-white/90 text-xs truncate leading-none">
            {{ user.name }}
          </span>
        </div>
        
        <div class="font-mono font-bold text-xs shrink-0 ml-2 text-green-400 bg-black/20 px-1.5 py-0.5 rounded border border-white/5 group-hover:border-white/10 transition-colors">
          {{ user.income.toFixed(2) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
