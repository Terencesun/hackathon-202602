<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { Receipt, TrendingUp, TrendingDown, CircleDollarSign } from 'lucide-vue-next';
import { useTransactionStore } from '../stores/transaction';

const transactionStore = useTransactionStore();

const getIcon = (type: string, amount: number) => {
  if (amount > 0) return TrendingUp;
  if (amount < 0) return TrendingDown;
  return CircleDollarSign;
};

onMounted(() => {
  transactionStore.startPolling();
});

onUnmounted(() => {
  transactionStore.stopPolling();
});
</script>

<template>
  <div class="pixel-card h-full flex flex-col">
    <h3 class="font-bold text-white/90 mb-2 text-sm border-b border-white/10 pb-2 flex items-center gap-2 shrink-0">
      <Receipt class="w-4 h-4" />
      账单
    </h3>
    
    <div class="flex-1 min-h-0 flex flex-col justify-between gap-1">
      <div 
        v-if="transactionStore.transactions.length === 0" 
        class="text-xs text-white/70 italic leading-relaxed"
      >
        No recent transactions.
      </div>
      
      <div 
        v-for="(tx, index) in transactionStore.transactions" 
        v-else 
        :key="index"
        class="group relative flex justify-between items-center px-3 rounded bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all h-[9%] overflow-hidden"
      >
        <!-- Background Decor -->
        <div 
          class="absolute left-0 top-0 bottom-0 w-[2px] opacity-50 group-hover:opacity-100 transition-opacity"
          :class="tx.amount >= 0 ? 'bg-green-500' : 'bg-red-500'"
        />

        <div class="flex items-center gap-3 overflow-hidden min-w-0">
          <component 
            :is="getIcon(tx.type, tx.amount)" 
            class="w-3.5 h-3.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
            :class="tx.amount >= 0 ? 'text-green-400' : 'text-red-400'"
          />
          <div class="flex items-center gap-2 overflow-hidden min-w-0">
            <span class="font-bold text-white/90 text-xs truncate capitalize leading-none">
              {{ tx.type.replace(/_/g, ' ') }}
            </span>
            <span class="text-white/40 text-[10px] font-mono leading-none shrink-0">
              #{{ tx.tick }}
            </span>
          </div>
        </div>
        
        <div 
          class="font-mono font-bold text-xs shrink-0 ml-2 bg-black/20 px-1.5 py-0.5 rounded border border-white/5 group-hover:border-white/10 transition-colors"
          :class="tx.amount >= 0 ? 'text-green-400' : 'text-red-400'"
        >
          {{ tx.amount >= 0 ? '+' : '' }}{{ tx.amount.toFixed(2) }}
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
