module.exports = {
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "test/tsconfig.json" }],
  },
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.ts", "src/**/*.js"],
  testMatch: ["**/*.spec.(ts)"],
  testEnvironment: "node",
}
