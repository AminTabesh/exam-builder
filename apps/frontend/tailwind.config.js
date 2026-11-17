export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  prefix: "tw-",
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: { navy: "#203c56", paper: "#f4f5f7" },
      fontFamily: { sans: ["Vazirmatn", "sans-serif"] },
      borderRadius: { DEFAULT: "8px" },
    },
  },
};
