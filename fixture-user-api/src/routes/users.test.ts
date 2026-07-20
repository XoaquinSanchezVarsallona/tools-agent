import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import { app } from "../server";
import { resetUsers } from "../models/user";

let server: import("node:http").Server;
let baseUrl: string;

type ValidationErrorResponse = {
  error: "VALIDATION_ERROR";
  details: Array<{ path: unknown; message: string }>;
};

function issueHasPath(issue: { path: unknown }, expected: string) {
  return (
    Array.isArray(issue.path) &&
    (issue.path as Array<string | number>).join(".") === expected
  );
}

beforeEach(async () => {
  resetUsers();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
});

test("POST /users - crea usuario con payload válido", async () => {
  const payload = { name: "Ada", email: "ada@example.com", age: 36 };

  const res = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as { id: string } & typeof payload;
  assert.deepEqual(body, { id: "1", ...payload });
});

test("POST /users - falla si faltan campos", async () => {
  const res = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ada", email: "ada@example.com" }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as ValidationErrorResponse;
  assert.equal(body.error, "VALIDATION_ERROR");
  assert.ok(Array.isArray(body.details));
  assert.ok(body.details.some((d) => issueHasPath(d, "age")));
});

test("POST /users - falla con tipos inválidos", async () => {
  const res = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ada", email: "ada@example.com", age: "36" }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as ValidationErrorResponse;
  assert.equal(body.error, "VALIDATION_ERROR");
  assert.ok(body.details.some((d) => issueHasPath(d, "age")));
});

test("POST /users - falla con email inválido", async () => {
  const res = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ada", email: "not-an-email", age: 36 }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as ValidationErrorResponse;
  assert.equal(body.error, "VALIDATION_ERROR");
  assert.ok(body.details.some((d) => issueHasPath(d, "email")));
});

test("POST /users - falla si incluye campos extra (schema strict)", async () => {
  const res = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Ada",
      email: "ada@example.com",
      age: 36,
      role: "admin",
    }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as ValidationErrorResponse;
  assert.equal(body.error, "VALIDATION_ERROR");
  assert.ok(Array.isArray(body.details));
  assert.ok(body.details.length > 0);
});
