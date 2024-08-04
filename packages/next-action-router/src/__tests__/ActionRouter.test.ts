import {
  ActionRouter,
  BASE_CONTEXT,
  INTIAL_SCHEMA_IDX,
} from "../server/ActionRouter";

jest.mock("server-only", () => ({}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({ get: jest.fn() })),
  headers: jest.fn(() => ({ get: jest.fn() })),
}));
