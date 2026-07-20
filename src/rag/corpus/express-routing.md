# Express: routing y estructura de proyectos

Express es un framework minimalista para construir APIs HTTP en Node.js.

## Router modular

```typescript
// src/routes/users.ts
import { Router } from "express";

export const usersRouter = Router();

usersRouter.get("/", (req, res) => { /* ... */ });
usersRouter.post("/", (req, res) => { /* ... */ });
```

```typescript
// src/server.ts
import express from "express";
import { usersRouter } from "./routes/users";

export const app = express();
app.use(express.json());
app.use("/users", usersRouter);
```

## Middlewares

Un middleware es una función `(req, res, next) => void` que se ejecuta antes
del handler final.

```typescript
usersRouter.post("/", validateBody(UserSchema), (req, res) => {
  // en este punto req.body ya fue validado por el middleware
});
```

## Manejo de errores

```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});
```

## Convenciones de estructura de carpetas más comunes

```
src/
  server.ts          # instancia de express, middlewares globales
  routes/            # un archivo por recurso (users.ts, products.ts, etc.)
  models/            # lógica de datos / acceso a persistencia
  middlewares/        # validación, auth, logging
  utils/             # helpers compartidos
```