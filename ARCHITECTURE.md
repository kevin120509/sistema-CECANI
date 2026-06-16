# 🏛️ Arquitectura del Sistema - CECANI

Este documento describe la arquitectura de software implementada en el **Sistema CECANI**, basada en los principios de **Arquitectura Limpia (Clean Architecture)**. El objetivo es mantener el código organizado, fácil de testear y capaz de escalar sin complicaciones.

---

## 층 Capas de la Arquitectura

Hemos dividido el proyecto en 4 capas principales para separar las responsabilidades:

### 1. 🧠 Capa de Dominio (`src/core/domain`)
Es el centro del sistema. Aquí residen las **reglas de negocio** que no cambian, independientemente de la tecnología que usemos.
- **Entidades:** Modelos de datos (ej. un `Expediente`, un `Contrato`).
- **Interfaces (Repositorios):** "Contratos" que dicen qué se puede hacer con los datos, pero no cómo (ej. `IExpedienteRepository`).

### 2. ⚙️ Capa de Aplicación (`src/core/services`)
Aquí viven los **Casos de Uso**. Es la capa que orquesta el flujo de información.
- **Servicios:** Contienen la lógica para cumplir una tarea específica. Por ejemplo, el `ExpedienteService` sabe que para crear un expediente primero debe validar datos, luego guardarlo y finalmente generar un PDF.

### 3. 🔌 Capa de Infraestructura (`src/infrastructure`)
Aquí se gestiona la comunicación con el mundo exterior y las herramientas de terceros.
- **Persistencia (Base de Datos):** Implementaciones reales para **Supabase** (guardar perfiles, expedientes, pagos).
- **Almacenamiento (Cloudflare R2):** Gestión de subida y lectura de documentos PDF y fotos hacia **Cloudflare R2**.
- **Notificaciones:** Integración con **OneSignal** para enviar mensajes a los usuarios.

### 4. 🖼️ Capa de Presentación (`src/app`, `src/actions`, `src/components`)
Lo que el usuario ve y cómo interactúa con el sistema.
- **Next.js App Router:** Maneja las rutas y la interfaz visual.
- **Server Actions:** Actúan como pequeños controladores que reciben los datos del formulario y los pasan a los **Servicios** de la capa de aplicación.

---

## 📁 Estructura de Carpetas y Archivos

```text
C:\Users\kevin\OneDrive\Desktop\sistema-CECANI\
├── 📂 src/
│   ├── 📂 core/                # 💎 El Corazón del Negocio
│   │   ├── 📂 domain/          # Modelos y contratos (Interfaces)
│   │   └── 📂 services/        # Lógica de "Casos de Uso" (Orquestación)
│   │
│   ├── 📂 infrastructure/      # 🛠️ Implementaciones Técnicas
│   │   ├── 📂 persistence/     # 🗄️ Gestión de Base de Datos (Supabase)
│   │   ├── 📂 storage/         # ☁️ Subida de archivos a Cloudflare R2
│   │   └── 📂 external/        # 🔔 Envíos de OneSignal y APIs externas
│   │
│   ├── 📂 actions/             # ⚡ Server Actions (Puente entre UI y Lógica)
│   │                           # Recibe datos de la web y llama a los Services.
│   │
│   ├── 📂 app/                 # 🌐 Rutas y Páginas de Next.js
│   │   ├── 📂 abogada/         # Dashboard y vistas de abogadas
│   │   ├── 📂 directora/       # Panel administrativo de la directora
│   │   └── 📂 api/             # Endpoints para tareas automáticas (Cron jobs)
│   │
│   ├── 📂 components/          # 🧩 Componentes Visuales (React)
│   │   ├── 📂 cliente/         # Pasos del flujo del cliente (Paso 1, 2, 3...)
│   │   └── 📂 expediente/      # Formularios de subida y gestión
│   │
│   ├── 📂 lib/                 # ⚙️ Configuraciones de herramientas
│   │   ├── 📂 supabase/        # Conexión al cliente de Supabase
│   │   └── 📄 r2.ts            # Configuración de AWS-SDK para Cloudflare
│   │
│   └── 📂 types/               # 📝 Definiciones de TypeScript globales
│
├── 📂 public/                  # 🖼️ Imágenes y archivos estáticos
└── 📄 package.json             # 📦 Dependencias del proyecto
```

---

## 🚀 ¿Cómo implementar algo nuevo? (Ejemplo: Nueva Función)

Si quieres agregar una función para "Registrar un Pago":

1. **Dominio:** Define la interfaz `IPagoRepository` y el tipo `Pago`.
2. **Infraestructura:** Crea `SupabasePagoRepository` para guardar en la tabla `pagos`.
3. **Aplicación:** Crea `PagoService` para validar que el monto sea correcto antes de guardar.
4. **Acción:** Crea un Server Action `registrarPagoAction` que use el `PagoService`.
5. **UI:** Agrega el botón o formulario en la carpeta `components/`.

---

## 💡 Notas Clave
- **Base de Datos:** Todo lo que sea `INSERT`, `UPDATE` o `SELECT` complejo debe vivir en `infrastructure/persistence`.
- **Documentación/R2:** La lógica para hablar con el Bucket de Cloudflare (firmar URLs, subir buffers) vive en `infrastructure/storage`.
- **Validación:** La lógica de negocio pesada (ej: "Un cliente no puede tener dos contratos activos") vive en `core/services`.
