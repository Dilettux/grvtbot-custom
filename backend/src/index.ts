import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
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
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

let grvtClient: GRVTClient;
let gridEngine: GridEngine;
let db: Database;

async function init() {
  try {
    logger.info('🚀 Iniciando GRVTBot Custom...');

    db = new Database();
    await db.init();
    logger.info('✅ Base de datos inicializada');

    const apiKey = process.env.GRVT_API_KEY;
    const subAccountId = process.env.GRVT_SUB_ACCOUNT_ID;
    const environment = (process.env.GRVT_ENVIRONMENT || 'prod') as 'prod' | 'testnet' | 'staging';

    if (!apiKey || !subAccountId) {
      throw new Error('❌ GRVT_API_KEY o GRVT_SUB_ACCOUNT_ID no configuradas');
    }

    grvtClient = new GRVTClient({ apiKey, subAccountId, environment });
    await grvtClient.connect();
    logger.info('✅ Conectado a GRVT');

    gridEngine = new GridEngine(grvtClient, db);
    await gridEngine.start();
    logger.info('✅ Grid engine iniciado');

    setupRoutes(app, grvtClient, gridEngine, db);

    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date() });
    });

    wss.on('connection', (ws) => {
      logger.info('📱 WebSocket conectado');
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.debug('📨 WS:', data.type);
        } catch (error) {
          logger.error('❌ WS Error:', error);
        }
      });
      ws.on('close', () => logger.info('📱 WebSocket cerrado'));
    });

    gridEngine.on('update', (data) => {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'update', data }));
        }
      });
    });

    const port = process.env.BOT_PORT || 3848;
    server.listen(port, () => {
      logger.info(`✅ Servidor corriendo en puerto ${port}`);
      logger.info(`📊 Dashboard: http://localhost:${port}/dashboard`);
      logger.info(`⚡ Active bots loaded`);
    });

  } catch (error) {
    logger.error('❌ Error:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('📍 SIGTERM recibido');
  try {
    await gridEngine?.stop();
    await grvtClient?.disconnect();
    server.close(() => {
      logger.info('✅ Cerrado');
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Error:', error);
    process.exit(1);
  }
});

init().catch((error) => {
  logger.error('❌ Error fatal:', error);
  process.exit(1);
});

export { app, wss, grvtClient, gridEngine, db };
