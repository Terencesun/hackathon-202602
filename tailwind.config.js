/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,vue}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        background: "#020617", // PRD：背景
        container: "#0F172A", // PRD：主容器
        "container-secondary": "#1E293B", // PRD：次级容器
        primary: "#22C55E", // PRD：操作按钮（绿）
        warning: "#EF4444", // PRD：警告（红）
        alert: "#F59E0B", // PRD：提醒（橙）
        text: "#F8FAFC", // PRD：主文本
        "text-secondary": "#94A3B8", // PRD：次级文本
        factory: "#808080", // PRD：工厂场景
        dorm: "#FFD700", // PRD：宿舍场景
        office: "#4169E1", // PRD：办公室场景
      },
      fontFamily: {
        sans: ["Fira Sans", "sans-serif"],
        mono: ["Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
