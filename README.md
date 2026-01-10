<div align="center">

  # 🏋️ Gym Manager
  
  **Sistema SaaS de Gestión Integral para Centros Deportivos**
  
  <p>
    <img src="https://img.shields.io/badge/REACT-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
    <img src="https://img.shields.io/badge/NODE.JS-339933?style=for-the-badge&logo=node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/POSTGRESQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" />
    <img src="https://img.shields.io/badge/RENDER-46E3B7?style=for-the-badge&logo=render&logoColor=white" />
  </p>

  <h3>
    <a href="https://gym-manager-alexs-projects-e2b40ef4.vercel.app/">🔗 Ver Demo en Vivo</a>
  </h3>
  
</div>

---

## 📋 Descripción

**Gym Manager** es una aplicación web moderna diseñada para digitalizar la administración de gimnasios, boxes de CrossFit y estudios de entrenamiento. 

El sistema permite abandonar las hojas de cálculo para pasar a una base de datos robusta en la nube, facilitando el control de accesos en tiempo real, la gestión de suscripciones y el análisis financiero del negocio.

---

## ✨ Características Principales

* **⚡ Control de Acceso Rápido:** Buscador instantáneo de socios con indicador visual de estado (ACTIVO 🟢 / INACTIVO 🔴).
* **📊 Dashboard Analítico:** Gráficos interactivos de visitas diarias, evolución mensual y KPIs de retención de clientes.
* **🔄 Gestión de Suscripciones:** Automatización de fechas de vencimiento y renovación de planes (Mensual, Trimestral, Anual).
* **🔐 Seguridad:** Sistema de autenticación para administradores y protección de rutas sensibles.
* **📱 Diseño Responsive:** Interfaz optimizada para funcionar en ordenadores de recepción, tablets y móviles.
* **☁️ Arquitectura Cloud:** Datos sincronizados en tiempo real mediante PostgreSQL (Neon) y Render.

---

## 🛠️ Stack Tecnológico

El proyecto está construido utilizando la arquitectura **PERN**:

| Componente | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Frontend** | React + Vite | SPA rápida y reactiva con Hooks. |
| **Backend** | Node.js + Express | API RESTful robusta. |
| **Base de Datos** | PostgreSQL (Neon) | Persistencia de datos en la nube. |
| **Visualización** | Recharts | Librería para gráficos de estadísticas. |
| **Despliegue** | Vercel & Render | CI/CD para Cliente y Servidor. |

---



## 🚀 Instalación y Despliegue Local

Si deseas ejecutar este proyecto en tu máquina local, sigue estos pasos:

### 1. Clonar el repositorio
```bash
git clone [https://github.com/AlexTorres8/gym-manager.git](https://github.com/AlexTorres8/gym-manager.git)
cd gym-manager
```

#### 2. Configurar el Backend (Servidor)
Ve a la carpeta del servidor e instala las dependencias:

```bash


cd server
npm install
```

Crea un archivo llamado .env dentro de la carpeta server con tus credenciales de base de datos (Neon):

```bash

DB_USER=tu_usuario_neon
DB_PASSWORD=tu_password_neon
DB_HOST=tu_host_neon.aws.neon.tech
DB_NAME=neondb
DB_PORT=5432
DB_SSL=true
PORT=3001
```

Inicia el servidor backend:
```bash
node index.js
```
### 3. Configurar el Frontend (Cliente)
Abre una nueva terminal, ve a la carpeta del cliente e instala las dependencias:

```bash


cd client
npm install
```
Crea un archivo llamado .env dentro de la carpeta client:

```bash

VITE_APP_PASSWORD=tu_contraseña_maestra
```
Abre el archivo src/App.jsx y asegúrate de que la variable API_URL apunta a tu servidor local:


```bash
const API_URL = 'http://localhost:3001';
```
Inicia la aplicación web:

```bash


npm run dev
```
🔮 Próximos Pasos (Roadmap)
[ ] Integración con Stripe para cobros automáticos recurrentes.

[ ] Portal del Socio para que los clientes consulten su estado desde casa.

[ ] Subida de Fotos de Perfil (integración con Cloudinary).

[ ] Sistema de Notificaciones por Email para avisos de caducidad.

<div align="center">

Desarrollado con ❤️ por Alex Torres

</div>