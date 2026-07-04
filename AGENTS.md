# Convenciones de desarrollo de `interpreter`

Esta guía resume las prácticas predominantes del módulo para que las nuevas contribuciones mantengan su estilo. Las reglas son deliberadamente agnósticas del lenguaje: preservan nombres, responsabilidades y decisiones de diseño, no una sintaxis concreta.

## Nombramiento

- Nombra tipos y componentes con sustantivos que describan una única responsabilidad del dominio, por ejemplo `Interpreter`, `Context` o `StrategyProvider`.
- Nombra operaciones con verbos claros que expresen su efecto, como `build`, `interpret`, `read`, `write`, `replace` o `addStrategy`.
- Prefiere nombres completos del dominio. Usa nombres genéricos como `value`, `key`, `left` y `right` únicamente en alcances pequeños donde su significado sea inmediato.
- Distingue las implementaciones por su función o entorno. Una implementación debe revelar qué hace o dónde opera, como `ConsoleInput` o `ReadableOutput`.
- Nombra cada comportamiento intercambiable a partir del caso que resuelve y el rol que cumple: `<caso>Strategy`.
- Nombra errores según la operación o concepto que falló, usando el sufijo convencional del lenguaje para errores, por ejemplo `DeclarationException` u `OperationException`.
- Nombra las pruebas con `test` seguido del comportamiento, condición o escenario comprobado. El nombre debe permitir entender el caso sin leer su cuerpo.
- Conserva el vocabulario ya utilizado por el dominio. No introduzcas sinónimos para conceptos existentes.

## Diseño y responsabilidades

- Mantén separadas la coordinación del proceso, el estado, la entrada, la salida, la resolución de comportamientos y la lógica de cada operación.
- Implementa cada tipo de operación o nodo como una estrategia independiente y registrable. Una estrategia debe conocer solamente el caso que procesa y los servicios que necesita.
- Resuelve las estrategias mediante un proveedor configurable. No agregues al coordinador central una cadena de condiciones que enumere todos los tipos soportados.
- Agrega comportamiento nuevo registrando una estrategia nueva. Evita modificar estrategias existentes salvo que cambie su propio caso de uso.
- Construye los componentes con dependencias obligatorias mediante un constructor guiado o builder. Valida todas las dependencias antes de producir una instancia utilizable.
- Inyecta entrada y salida detrás de contratos pequeños. La lógica del dominio no debe depender de consola, archivos ni otro mecanismo concreto.
- Entrega a las estrategias sus dependencias operativas mediante un objeto de servicios explícito. Evita dependencias globales u ocultas.
- Encapsula el estado mutable detrás de una API mínima. Las estrategias no deben manipular directamente la estructura interna que lo almacena.
- Representa con tipos distintos los estados del dominio que tienen reglas distintas, como valores mutables e inmutables, aunque compartan datos.
- Mantén privadas las implementaciones concretas cuando el consumidor sólo necesita un contrato. Expón la superficie pública mínima necesaria.
- Compón configuraciones para extender capacidades. Una versión nueva debe poder agregar o reemplazar estrategias sobre una configuración anterior sin duplicarla.
- Cuando se combinen proveedores, la configuración añadida más recientemente prevalece para los casos repetidos.

## Flujo, validación y errores

- Evalúa primero las dependencias de una operación y valida el resultado antes de modificar el estado.
- Comprueba de forma explícita referencias inexistentes, declaraciones duplicadas, valores ausentes, incompatibilidades de tipo y operaciones no soportadas.
- No dejes el contexto parcialmente actualizado cuando una validación falla.
- Usa errores específicos para fallos esperables del dominio y mensajes que indiquen el concepto o identificador involucrado.
- Señala explícitamente los tipos de operación no soportados; no los ignores ni selecciones silenciosamente un comportamiento alternativo.
- Mantén la política de captura de errores fuera del intérprete principal. Si un consumidor necesita continuar sin propagar fallos, envuelve el intérprete con un decorador responsable de registrar el último error.
- Para ejecutar una rama condicional, trabaja sobre una copia del contexto y, al finalizar, propaga sólo las modificaciones de identificadores que ya pertenecían al contexto exterior. Las declaraciones locales de la rama no deben escapar.
- Mantén las funciones auxiliares pequeñas, privadas y cercanas a la estrategia que las usa. Comparte una utilidad sólo cuando represente una regla común real.

## Pruebas

- Cubre al menos un flujo integral válido y compara sus efectos observables, especialmente la salida producida.
- Prueba cada categoría de error por separado y verifica el tipo de error, además del mensaje cuando éste forme parte del contrato.
- Incluye casos de configuración incompleta, referencias ausentes, declaraciones repetidas, tipos incompatibles, operadores no soportados y nodos sin estrategia.
- Comprueba que configuraciones antiguas rechacen capacidades introducidas en versiones posteriores y que las nuevas versiones conserven el comportamiento anterior.
- Sustituye entrada y salida reales por implementaciones controlables. Las pruebas del dominio no deben depender de interacción manual.
- Reutiliza fixtures con nombres descriptivos para árboles o estructuras de entrada extensas; mantén la aserción y la intención del escenario en la prueba.
- Prueba de manera aislada el contenedor de estado, incluyendo inserción, consulta, limpieza, copia y propagación selectiva.
- Evita salidas de depuración y aserciones genéricas cuando el entorno ofrezca verificaciones más expresivas.

## Criterio para nuevas contribuciones

Antes de incorporar un cambio, verifica que:

1. El nombre utiliza el vocabulario del dominio y revela la responsabilidad.
2. La lógica nueva está en la estrategia o componente más específico posible.
3. Las dependencias se reciben explícitamente y pueden sustituirse en pruebas.
4. Todas las validaciones ocurren antes de alterar el estado.
5. Los fallos esperables producen un error específico y comprensible.
6. La funcionalidad puede registrarse o componerse sin aumentar el acoplamiento del coordinador.
7. Las pruebas cubren el flujo válido, sus límites y los errores relevantes.

## Prácticas observadas que no deben perpetuarse

No tomes como convención las cadenas libres para representar tipos, la captura indiscriminada de errores, las impresiones de depuración, las aserciones poco descriptivas ni los nombres de prueba centrados únicamente en el método invocado. Son detalles puntuales del código actual, no decisiones de diseño que deban replicarse.
