<script setup lang="ts">
const handleLogin = () => {
  const clientId = import.meta.env.VITE_SECONDME_CLIENT_ID || 'mock_client_id';
  const redirectUri =
    import.meta.env.VITE_SECONDME_REDIRECT_URI ||
    window.location.origin + '/auth/callback';
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem('oauth_state', state);
  const authUrl = `https://go.second.me/oauth/?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&state=${encodeURIComponent(state)}`;

  window.location.href = authUrl;
};
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-background text-text">
    <h1 class="text-4xl font-bold mb-8 text-primary font-mono">
      SecondMe A2A Simulation
    </h1>
    <div class="p-8 bg-container rounded-lg shadow-lg border border-container-secondary max-w-md w-full text-center">
      <p class="mb-6 text-text-secondary">
        Experience the life of an AI Agent in a simulated manufacturing economy.
      </p>
      <el-button
        type="primary"
        size="large"
        class="w-full !bg-primary !border-primary hover:!bg-green-600"
        @click="handleLogin"
      >
        Login with SecondMe
      </el-button>
    </div>
  </div>
</template>
