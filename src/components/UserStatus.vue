<script setup lang="ts">
import { computed } from 'vue';
import { useUserStore } from '../stores/user';
import { Activity, Wallet } from 'lucide-vue-next';

const userStore = useUserStore();
const agent = computed(() => userStore.agent);
const localizedIdentity = computed(() => userStore.localizedIdentity);

// 根据金额长度动态计算字体大小
const incomeFontSize = computed(() => {
  const income = agent.value?.currentIncome || 0;
  const len = income.toFixed(2).length;
  
  // 长度 > 13 (例如百亿级别: 10000000000.00 -> 14位)
  // 999999999999.00 -> 15位
  if (len > 13) return 'text-base md:text-sm lg:text-base';
  // 长度 > 10 (例如千万级别: 10000000.00 -> 11位)
  if (len > 10) return 'text-lg md:text-base lg:text-lg';
  // 长度 > 7 (例如万级别: 10000.00 -> 8位)
  if (len > 7) return 'text-xl md:text-lg lg:text-xl';
  
  return 'text-3xl md:text-2xl lg:text-3xl';
});
</script>

<template>
  <div class="pixel-card h-full flex flex-col relative overflow-hidden group">
    <!-- Header -->
    <div class="flex justify-between items-center border-b border-white/10 pb-3 z-10 shrink-0">
      <h2 class="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
        <Activity class="w-4 h-4" /> 状态
      </h2>
      <span class="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 capitalize">
        {{ localizedIdentity }}
      </span>
    </div>
    
    <!-- Main Content -->
    <div class="flex-1 flex flex-col justify-center items-center z-10 w-full min-h-0">
      <div class="flex flex-col items-center gap-3 w-full">
        <!-- Icon Container -->
        <div class="p-3 rounded-full bg-green-500/10 border border-green-500/20 shadow-[0_0_15px_rgba(74,222,128,0.1)] group-hover:shadow-[0_0_25px_rgba(74,222,128,0.2)] transition-all duration-500">
          <Wallet class="w-6 h-6 text-green-400" />
        </div>
        
        <!-- Text Info -->
        <div class="text-center w-full px-1">
          <div class="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-1">Current Wealth</div>
          <div class="font-mono font-bold text-green-400 truncate w-full flex justify-center items-baseline" :title="agent?.currentIncome?.toFixed(2)">
             <span class="text-lg mr-1 opacity-80">¥</span>
             <span :class="[incomeFontSize, 'tracking-tight transition-all duration-300']">
               {{ agent?.currentIncome?.toFixed(2) ?? '0.00' }}
             </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Background Decoration -->
    <div class="absolute -bottom-10 -right-10 w-24 h-24 bg-green-500/5 blur-[40px] rounded-full pointer-events-none"></div>
    <div class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/20 pointer-events-none"></div>
  </div>
</template>
