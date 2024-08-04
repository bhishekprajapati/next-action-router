/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/server/", "/client/", "/dist/"],
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};
