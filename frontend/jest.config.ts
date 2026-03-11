import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/app/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
        verbatimModuleSyntax: false,
        module: "CommonJS",
        moduleResolution: "node",
        types: ["jest", "node"],
      },
    }],
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
};

export default config;
