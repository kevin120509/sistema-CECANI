# Trabajo en la nube (aplica en compu, nube y teléfono)

Kevin debe poder seguir este proyecto desde la app de Claude en su teléfono, aunque su compu esté apagada.
Por eso, **nada se queda solo en la compu**. Estas reglas aplican en cualquier sesión (local o en la nube).

## Al empezar
1. Lee `AGENTS.md` y `MEMORY.md` (y la spec activa en `specs/` si existe).
2. Si es sesión local: `git pull` antes de tocar nada (pudo haber cambios hechos desde el teléfono).
3. Trabaja en una rama (`claude/<tarea-corta>`), no directo en la rama principal.

## Al terminar cada tarea (siempre, sin que Kevin lo pida)
1. Pruebas/verificación del proyecto en verde.
2. Actualiza `MEMORY.md`: estado actual, decisiones con su porqué, próximos pasos.
3. Commit y push de la rama. Abre (o actualiza) un PR que diga qué se hizo, qué falta y qué decisiones debe revisar Kevin.
4. Si hay preview de Vercel, pon el link en el PR para que Kevin lo vea desde el teléfono.

Hacer push a una **rama de trabajo** está permitido siempre. Fusionar a la rama principal, hacer deploy a producción
o aplicar migraciones sigue las reglas de "preguntar antes" del `AGENTS.md`.

## Si hay que cortar a medias (emergencia)
Sube todo como esté a una rama `wip/<fecha>` con un commit "WIP: <qué estaba haciendo>" y anota en `MEMORY.md`
dónde se quedó. Nunca dejes cambios sin subir.

## Dónde vive cada cosa
- Código, docs (`docs/`), specs (`specs/`) y `MEMORY.md`: en el repo. No dejes documentación solo en el escritorio.
- Claves y `.env`: nunca en el repo. Deben estar en Vercel / Supabase / el entorno de la nube.
- El escritorio de Kevin es solo una copia: se actualiza con `git pull` cuando la compu esté prendida.

## Lo que no se puede hacer en una sesión en la nube
Usar el Chrome de Kevin, archivos que solo estén en su compu o el `.env` local. Si la tarea lo necesita,
déjalo anotado en `MEMORY.md` como pendiente "requiere compu".
