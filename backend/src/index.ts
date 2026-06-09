import express from 'express';
import cors from 'cors';
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

app.use(cors());
app.use(express.json());

// Dashboard HTML inline - SIMPLE y FUNCIONA
app.get('/dashboard', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>GRVTBot</title><style>body{font-family:sans-serif;background:linear-gradient(135deg,#1e3c72,#2a5298);color:#fff;padding:40px;margin:0}h1{text-align:center;margin-bottom:40px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px}.card{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:20px}.card h3{color:rgba(255,255,255,0.6);text-transform:uppercase;margin-bottom:10px;font-size:0.9em}.value{font-size:2em;color:#4ade80;font-weight:bold}button{background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;margin-right:10px;margin-top:20px}button:hover{background:#2563eb}</style></head><body><h1>🤖 GRVTBot Dashboard</h1><div class="cards"><div class="card"><h3>Estado</h3><div class="value">✅ OK</div></div><div class="card"><h3>Grids Activos</h3><div class="value" id="grids">0</div></div><div class="card"><h3>Fills</h3><div class="value" id="fills">0</div></div><div class="card"><h3>PnL</h3><div class="value" id="pnl">$0.00</div></div></div><button onclick="load()">🔄 Actualizar</button><script>function load(){fetch('/api/status').then(r=>r.json()).then(d=>{document.getElementById('grids').textContent=d.activeGrids||0;document.getElementById('fills').textContent=d.totalFills||0;document.getElementById('pnl').textContent='$'+(d.totalPnL||0).toFixed(2);}).catch(e=>console.error('Error:',e));}load();setInterval(load,5000);</script></body></html>`);
});

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
      throw new Error('❌ Credenciales no configuradas');
    }

    grvtClient = new GRVTClient({ apiKey, subAccountId, environment });
    await grvtClient.connect();
    logger.info('✅ Conectado a GRVT');

    gridEngine = new GridEngine(grvtClient, db);
    await gridEngine.start();
    logger.info('✅ Grid engine iniciado');

    setupRoutes(app, grvtClient, gridEngine, db);

    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    wss.on('connection', (ws) => {
      logger.info('📱 WebSocket conectado');
      ws.on('close', () => logger.info('📱 WebSocket cerrado'));
    });

    const port = process.env.BOT_PORT || 3848;
    server.listen(port, () => {
      logger.info(`✅ Servidor en puerto ${port}`);
      logger.info(`⚡ Active bots loaded`);
    });

  } catch (error) {
    logger.error('❌ Error:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  try {
    await gridEngine?.stop();
    await grvtClient?.disconnect();
    server.close(() => process.exit(0));
  } catch (error) {
    process.exit(1);
  }
});

init().catch(() => process.exit(1));

export { app, wss, grvtClient, gridEngine, db };
