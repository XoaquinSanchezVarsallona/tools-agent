# node:test — test runner nativo de Node.js

Desde Node.js 18+, el módulo `node:test` provee un test runner integrado, sin
necesidad de instalar Jest, Mocha ni ninguna dependencia externa.

## Estructura básica de un archivo de test

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("suma", () => {
  test("suma dos números positivos", () => {
    assert.equal(1 + 1, 2);
  });

  test("suma con negativos", () => {
    assert.equal(-1 + 1, 0);
  });
});
```

## Ejecutar los tests

node --test

Por convención, `node --test` busca automáticamente archivos que matcheen
patrones como `*.test.ts`, `*.test.js`, o carpetas `test/`. Si el proyecto usa
TypeScript, hace falta un loader (por ejemplo `ts-node/register` o `tsx`):

node --test --require ts-node/register src/**/*.test.ts

## Tests asíncronos

```typescript
test("operación asíncrona", async () => {
  const result = await someAsyncFunction();
  assert.equal(result, "valor esperado");
});
```

## Testear un endpoint HTTP con Express

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { app } from "../server";

test("POST /users con body inválido devuelve 400", async () => {
  const server = app.listen(0);
  const port = (server.address() as any).port;

  const response = await fetch(`http://localhost:${port}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "" })
  });

  assert.equal(response.status, 400);
  server.close();
});
```

## Assertions más usadas

- `assert.equal(actual, expected)` — igualdad no estricta
- `assert.deepEqual(actual, expected)` — igualdad profunda de objetos/arrays
- `assert.ok(value)` — verifica que el valor sea truthy
- `assert.rejects(asyncFn)` — verifica que una promesa rechace
- `assert.throws(fn)` — verifica que una función sincrónica lance una excepción