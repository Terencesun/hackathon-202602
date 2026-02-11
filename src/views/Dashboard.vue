<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useUserStore } from '../stores/user';
import { User, Briefcase, Coffee } from 'lucide-vue-next';
import UserInfo from '../components/UserInfo.vue';
import SystemInfo from '../components/SystemInfo.vue';
import UserStatus from '../components/UserStatus.vue';
import WorldRank from '../components/WorldRank.vue';
import TransactionList from '../components/TransactionList.vue';

const userStore = useUserStore();
const agent = computed(() => userStore.agent);

// Placeholder color for the main "Image" area
const sceneColor = computed(() => {
  switch (agent.value?.identity) {
    case 'worker': return 'bg-gray-600'; 
    case 'dorm': return 'bg-yellow-600'; 
    case 'layflat': return 'bg-yellow-600'; 
    case 'broker': return 'bg-blue-600';
    default: return 'bg-slate-700';
  }
});

const identityIcon = computed(() => {
    switch (agent.value?.identity) {
        case 'worker': return Briefcase;
        case 'broker': return User; 
        case 'layflat': return Coffee;
        default: return User;
    }
});

// Mobile landscape check
const isPortrait = ref(false);
const checkOrientation = () => {
  isPortrait.value = window.innerHeight > window.innerWidth;
};

onMounted(() => {
  checkOrientation();
  window.addEventListener('resize', checkOrientation);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkOrientation);
});
</script>

<template>
  <div class="min-h-screen bg-neutral-900 flex items-center justify-center p-4 sm:p-8 overflow-hidden font-pixel">
    <!-- Main Game View Container -->
    <div 
      class="game-view relative w-full max-w-[1200px] aspect-video rounded-[32px] shadow-2xl overflow-hidden pixel-border transition-all duration-500 grid grid-cols-12 grid-rows-12 p-6 gap-4"
      :class="[sceneColor, { 'rotate-90-mobile': isPortrait }]"
    >
      <!-- Background Grid Overlay (Optional Texture) -->
      <div class="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none z-0" />

      <!-- Center Visual (Placeholder for Image content) -->
      <div class="absolute inset-0 flex flex-col items-center justify-center pb-64 pointer-events-none z-0">
        <component
          :is="identityIcon"
          class="w-32 h-32 text-white/20 mb-4 animate-pulse"
        />
        <h1 class="text-4xl md:text-6xl font-bold text-white/20 uppercase tracking-widest">
          {{ userStore.localizedIdentity || 'Loading...' }}
        </h1>
      </div>

      <!-- Top Bar Overlay -->
      <div class="col-span-12 flex justify-between items-start z-10 pointer-events-none row-start-1 row-span-2">
        <!-- User Info -->
        <UserInfo />

        <!-- System Controls -->
        <SystemInfo />
      </div>

      <!-- Middle Spacer (implicitly handled by grid row 2) -->

      <!-- Bottom Overlay Container -->
      <!-- Split into grid items -->
      
      <!-- Left Panel -->
      <div class="col-span-12 md:col-span-2 row-start-7 row-span-6 z-10 pointer-events-auto self-end h-full flex flex-col justify-end">
        <UserStatus />
      </div>
      
      <!-- Middle Panel -->
      <div class="col-span-12 md:col-span-5 row-start-7 row-span-6 z-10 pointer-events-auto self-end h-full">
        <TransactionList />
      </div>
      
      <!-- Right Panel -->
      <div class="col-span-12 md:col-span-5 row-start-7 row-span-6 z-10 pointer-events-auto self-end h-full">
        <WorldRank />
      </div>
    </div>
  </div>
</template>

<style>
/* Import Pixel Font */
@font-face {
  font-family: 'Pixelify Sans';
  src: url('@/assets/fonts/PixelifySans-Variable.woff2') format('woff2');
  font-weight: 400 700;
  font-display: swap;
  font-style: normal;
}

.font-pixel {
  font-family: 'Pixelify Sans', 'Fira Sans', sans-serif;
}

/* Pixel Border Style */
.pixel-border {
  border: 4px solid #000;
  box-shadow: 6px 6px 0px 0px rgba(0,0,0,0.5);
}

/* Glassmorphism / Pixel Card Style */
.pixel-card {
  @apply bg-black/40 backdrop-blur-md border-2 border-white/10 rounded-xl p-4 text-white shadow-lg;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.pixel-card-icon {
  @apply bg-black/40 backdrop-blur-md border-2 border-white/10 rounded-lg p-2 text-white shadow-lg flex items-center justify-center;
}

/* Grid Pattern Background */
.bg-grid-pattern {
  background-image: linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* Mobile Forced Landscape Rotation */
@media screen and (orientation: portrait) {
  .rotate-90-mobile {
    transform: rotate(90deg);
    width: 100vh !important;
    height: 100vw !important;
    max-width: none !important;
    /* Adjust position to center it after rotation if needed */
    position: fixed;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    z-index: 50;
  }
}
</style>
