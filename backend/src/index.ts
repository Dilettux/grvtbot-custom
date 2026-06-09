// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { Database } from './db/database';
import { GRVTClient } from './grvt/client';
import { GridEngine } from './trading/gridEngine';
import setupRoutes from './api/routes';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana
});
app.use('/api/', limiter);

// Global state
let grvtClient: GRVTClient;
let gridEngine: GridEngine;
let db: Database;

// Inicialización
async function init() {
  try {
    logger.info('🚀 Iniciando GRVTBot Custom...');

    // Inicializa base de datos
    db = new Database();
    await db.init();
    logger.info('✅ Base de datos inicializada');

    // Valida credenciales
    const apiKey = process.env.GRVT_API_KEY;
    const subAccountId = process.env.GRVT_SUB_ACCOUNT_ID;
    const environment = (process.env.GRVT_ENVIRONMENT || 'prod') as 'prod' | 'testnet' | 'staging';

    if (!apiKey || !subAccountId) {
      throw new Error('❌ GRVT_API_KEY o GRVT_SUB_ACCOUNT_ID no configuradas');
    }

    // Inicializa cliente GRVT
    grvtClient = new GRVTClient({
      apiKey,
      subAccountId,
      environment,
    });

    await grvtClient.connect();
    logger.info('✅ Conectado a GRVT');

    // Inicializa grid engine
    gridEngine = new GridEngine(grvtClient, db);
    await gridEngine.start();
    logger.info('✅ Grid engine iniciado');

    // Setup rutas
    setupRoutes(app, grvtClient, gridEngine, db);

    // WebSocket
    wss.on('connection', (ws) => {
      logger.info('📱 Cliente WebSocket conectado');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.debug('📨 Mensaje WS:', data.type);
          // Manejo de mensajes aquí
        } catch (error) {
          logger.error('❌ Error parsing WS message:', error);
        }
      });

      ws.on('close', () => {
        logger.info('📱 Cliente WebSocket desconectado');
      });
    });

    // Broadcast para actualizar clientes
    gridEngine.on('update', (data) => {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify({ type: 'update', data }));
        }
      });
    });

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date() });
    });

    // Serve static frontend
    app.use(express.static('frontend/dist'));

    // Fallback para SPA
    app.get('*', (req, res) => {
      res.sendFile('frontend/dist/index.html', { root: '.' });
    });

    // Start server
    const port = process.env.BOT_PORT || 3848;
    server.listen(port, () => {
      logger.info(`✅ Servidor corriendo en puerto ${port}`);
      logger.info(`📊 Dashboard: http://localhost:${port}/dashboard`);
      logger.info(`⚡ Active bots loaded`);
    });

  } catch (error) {
    logger.error('❌ Error en inicialización:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('📍 SIGTERM recibido, iniciando shutdown...');
  try {
    await gridEngine?.stop();
    await grvtClient?.disconnect();
    server.close(() => {
      logger.info('✅ Servidor cerrado');
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Error en shutdown:', error);
    process.exit(1);
  }
});

// Start
init().catch((error) => {
  logger.error('❌ Error fatal:', error);
  process.exit(1);
});

export { app, wss, grvtClient, gridEngine, db };
