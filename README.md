# GRVTBot Custom - Bot de Grid Trading para GRVT

**Versión**: 1.0.0  
**Estado**: En Desarrollo  
**Licencia**: MIT

---

## 📋 Descripción

GRVTBot Custom es un **bot de grid trading de código abierto** para la plataforma GRVT. Es una alternativa al repositorio oficial que tiene problemas de compilación.

**Características:**
- ✅ Grid trading automático con múltiples niveles
- ✅ Dashboard web en tiempo real (React)
- ✅ Encriptación AES-256 para credenciales
- ✅ WebSocket para actualizaciones en vivo
- ✅ SQLite para persistencia de datos
- ✅ Docker + Docker Compose para fácil deployment
- ✅ Monitoreo de PnL en tiempo real

---

## 🚀 Instalación Rápida (AWS)

### Prerequisitos
- Instancia AWS EC2 (t3.micro, gratuita)
- Ubuntu 24.04 LTS
- Docker instalado
- Credenciales GRVT (API Key + Secret)

### Pasos

```bash
# 1. Clona el repositorio
git clone https://github.com/TUUSER/grvtbot-custom.git
cd grvtbot-custom

# 2. Configura variables de entorno
cp .env.example .env
nano .env
# Rellena con tus credenciales GRVT

# 3. Construye con Docker
docker compose build

# 4. Inicia
docker compose up -d

# 5. Accede al dashboard
# http://TU_IP:3848/dashboard
```

---

## 📁 Estructura del Proyecto

```
grvtbot-custom/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Servidor principal
│   │   ├── grvt/
│   │   │   └── client.ts            # Cliente GRVT API
│   │   ├── trading/
│   │   │   ├── gridEngine.ts        # Lógica de grid trading
│   │   │   └── orderManager.ts      # Gestor de órdenes
│   │   ├── db/
│   │   │   └── database.ts          # SQLite manager
│   │   ├── api/
│   │   │   ├── routes.ts            # Rutas Express
│   │   │   └── wsServer.ts          # WebSocket
│   │   └── utils/
│   │       ├── encryption.ts        # AES-256 encryption
│   │       └── logger.ts            # Logging
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── GridManager.tsx
│   │   │   └── Charts.tsx
│   │   ├── pages/
│   │   │   └── index.tsx
│   │   └── styles/
│   │       └── globals.css
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

---

## 🔧 Variables de Entorno (.env)

```
# GRVT Credentials
GRVT_API_KEY=grvt_sk_...
GRVT_API_SECRET=0x...
GRVT_TRADING_ACCOUNT_ID=...
GRVT_TRADING_ADDRESS=0x...

# Security
ENCRYPTION_KEY=<generado automáticamente>
JWT_SECRET=<generado automáticamente>

# Server
BOT_PORT=3848
NODE_ENV=production

# Dashboard
DASHBOARD_API_KEY=<tu_api_key>
```

---

## 📊 API Endpoints

### REST API
- `GET /api/health` - Health check
- `GET /api/account` - Información de cuenta
- `POST /api/grids` - Crear grid
- `GET /api/grids` - Listar grids
- `DELETE /api/grids/:id` - Eliminar grid
- `GET /api/orders` - Historial de órdenes

### WebSocket
- `ws://localhost:3848/ws` - Conexión en tiempo real
  - Eventos: `price_update`, `order_fill`, `grid_update`

---

## 🔐 Seguridad

- ✅ Credenciales encriptadas con AES-256-GCM
- ✅ JWT para autenticación de API
- ✅ Rate limiting en endpoints
- ✅ CORS configurado
- ✅ Helmet para headers de seguridad
- ✅ Contraseñas hasheadas con bcrypt

---

## 📈 Características del Grid Trading

### Configuración Básica
```json
{
  "name": "BTC Grid",
  "instrument": "BTC",
  "rangelow": 30000,
  "rangeHigh": 35000,
  "levels": 10,
  "amountPerLevel": 0.001,
  "enabled": true
}
```

### Lógica
- Divide el rango en N niveles
- Coloca órdenes buy/sell en cada nivel
- Cuando una orden se ejecuta, se reemplaza automáticamente
- Ganancias en cada fill (compra baja, vende alta)

---

## 🚀 Roadmap

- [x] Backend MVP (Grid engine, API)
- [x] Frontend Dashboard
- [x] Docker + docker-compose
- [ ] Telegram alerts
- [ ] Backtesting
- [ ] Multi-bot support
- [ ] Advanced analytics

---

## 🤝 Contribuir

Si encuentras bugs o tienes mejoras:
1. Fork el repo
2. Crea una rama (`git checkout -b feature/tu-feature`)
3. Commit cambios (`git commit -m 'Add feature'`)
4. Push (`git push origin feature/tu-feature`)
5. Abre un Pull Request

---

## ⚠️ Disclaimer

Este es software de trading automático. **Úsalo bajo tu propio riesgo.**

- Tu dinero está en GRVT, no en este bot
- El bot solo coloca órdenes, no retira fondos
- Testing en demo/small amounts recomendado
- No hay garantía de ganancias

---

## 📞 Soporte

- Issues: GitHub Issues
- Email: (tu email)
- Documentación: Ver docs/

---

## 📄 Licencia

MIT License - Libre para usar, modificar y distribuir.

---

**Desarrollado por**: Tu nombre  
**Basado en**: GRVTBot (kmanus88)  
**Última actualización**: Junio 2026
