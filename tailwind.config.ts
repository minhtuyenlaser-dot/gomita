import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gomita: {
          ink: "#17211f",
          muted: "#66736f",
          line: "#dfe6e2",
          green: "#1f6b5c",
          orange: "#d97d36",
          red: "#b93838",
          bg: "#f5f7f4"
        }
      }
    }
  },
  plugins: []
};

export default config;
