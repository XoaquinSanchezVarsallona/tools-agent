# Zod: validación de esquemas en TypeScript

Zod es una librería de validación y parseo de esquemas para TypeScript. Permite
definir la forma esperada de un dato y validarlo en runtime, infiriendo además
el tipo estático correspondiente.

## Instalación

## Definir un esquema básico

```typescript
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(1, "el nombre no puede estar vacío"),
  email: z.string().email("email inválido"),
  age: z.number().int().positive()
});

type User = z.infer<typeof UserSchema>;
```

`z.infer<typeof Schema>` permite obtener el tipo de TypeScript directamente
del esquema, evitando duplicar la definición de tipos.

## Validar datos

Hay dos formas principales de validar:

- `schema.parse(data)`: valida y devuelve el dato tipado, o **lanza una excepción**
  (`ZodError`) si no es válido.
- `schema.safeParse(data)`: no lanza excepción. Devuelve un objeto
  `{ success: true, data }` o `{ success: false, error }`.

```typescript
const result = UserSchema.safeParse(req.body);

if (!result.success) {
  return res.status(400).json({ errors: result.error.issues });
}

const user = result.data;
```

Para endpoints HTTP se recomienda `safeParse` en vez de `parse`, ya que permite
devolver una respuesta 400 controlada en vez de que la excepción se propague
sin manejar.

## Uso típico como middleware de validación en Express

```typescript
function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ errors: result.error.issues });
    }
    req.body = result.data;
    next();
  };
}
```

## Testing

Zod se testea fácilmente con cualquier test runner, incluyendo `node:test`,
porque `safeParse` es una función pura sin efectos secundarios: se le pasa
un input y se verifica el `success` y el contenido de `data` o `error`.