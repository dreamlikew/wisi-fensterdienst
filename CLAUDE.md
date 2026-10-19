# CLAUDE.md

## Reglas para agentes (subagentes)

Al lanzar un agente (herramienta `Agent`), **decide tú el modelo** con el parámetro `model`.
No lo omitas: si no se indica, el agente hereda el modelo de la sesión principal
(normalmente el más caro) y se gastan tokens de más.

Elige según la tarea:

| Modelo  | Cuándo usarlo |
|---------|---------------|
| `haiku` | Búsquedas y lecturas simples: localizar archivos, grep, listar, resumir un archivo, comprobaciones mecánicas. |
| `sonnet` | Trabajo normal: editar HTML/CSS/JS, revisar cambios, redactar textos, investigar con varios pasos. Opción por defecto si dudas. |
| `opus`  | Solo para tareas difíciles: decisiones de arquitectura, depuración compleja, análisis donde un error sale caro. |

Reglas adicionales:

- Antes de lanzar un agente, valora si hace falta: una tarea pequeña se hace directamente, sin agente.
- Usa el modelo más barato que pueda hacer bien la tarea; sube de nivel solo si el resultado no es suficiente.
- Si el usuario pide un modelo concreto, usa ese.
