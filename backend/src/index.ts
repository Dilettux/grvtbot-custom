// backend/src/index.ts
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

// Middleware
// app.use(helmet()); // Desactivado temporalmente para desarrollo
app.use(cors());
app.use(express.json());

// Dashboard HTML inline
const dashboardHTML = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>GRVTBot Dashboard</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: #fff; min-height: 100vh; padding: 20px; } .container { max-width: 1200px; margin: 0 auto; } header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid rgba(255,255,255,0.1); } h1 { font-size: 2.5em; margin-bottom: 10px; } .subtitle { color: rgba(255,255,255,0.7); font-size: 1.1em; } .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; } .card { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 20px; } .card h3 { font-size: 0.9em; color: rgba(255,255,255,0.6); margin-bottom: 10px; text-transform: uppercase; } .card .value { font-size: 2em; font-weight: bold; color: #4ade80; } .section { margin-bottom: 40px; } .section h2 { font-size: 1.5em; margin-bottom: 20px; } .grids-list { display: grid; gap: 15px; } .grid-item { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px; display: flex; justify-content: space-between; align-items: center; } .badge { padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; background: rgba(74,222,128,0.2); color: #4ade80; } button { background: rgba(59,130,246,0.8); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-top: 10px; margin-right: 10px; } button:hover { background: rgba(59,130,246,1); } .loading { color: rgba(255,255,255,0.6); font-style: italic; } footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); font-size: 0.9em; }</style></head><body><div class="container"><header><h1>🤖 GRVTBot</h1><p class="subtitle">Grid Trading Bot para GRVT</p></header><div class="cards"><div class="card"><h3>Estado</h3><div class="value" id="status">✅ Activo</div></div><div class="card"><h3>Grids Activos</h3><div class="value" id="activeGrids">0</div></div><div class="card"><h3>Fills Totales</h3><div class="value" id="totalFills">0</div></div><div class="card"><h3>PnL Total</h3><div class="value" id="totalPnL">$0.00</div></div></div><div class="section"><h2>📊 Grids Activos</h2><div id="gridsList" class="grids-list"><div class="loading">Cargando grids...</div></div></div><div class="section"><h2>⚙️ Controles</h2><button onclick="loadData()">🔄 Actualizar</button><button onclick="window.location.href='/api/status'">📡 API Status</button><button onclick="window.location.href='/api/grids'">📊 Grids JSON</button></div><footer><p>GRVTBot Custom v1.0.0</p><p>Última actualización: <span id="lastUpdate">--:--:--</span></p></footer></div><script>async function loadData(){try{const[statusRes,gridsRes]=await Promise.all([fetch('/api/status'),fetch('/api/grids')]);if(!statusRes.ok||!gridsRes.ok)throw new Error('Error cargando datos');const status=await statusRes.json();const grids=await gridsRes.json();document.getElementById('activeGrids').textContent=status.activeGrids||0;document.getElementById('totalFills').textContent=status.totalFills||0;document.getElementById('totalPnL').textContent='$'+((status.totalPnL||0).toFixed(2));const container=document.getElementById('gridsList');if(!grids||grids.length===0){container.innerHTML='<div class="loading">No hay grids activos. Crea uno para comenzar.</div>';}else{container.innerHTML=grids.map(g=>'<div class="grid-item"><div><strong>'+g.instrument+'</strong><br><small>$'+(g.currentPrice||0).toFixed(2)+' | Fills: '+(g.fills||0)+'</small></div><span class="badge">'+g.status+'</span></div>').join('');}const now=new Date();document.getElementById('lastUpdate').textContent=now.toLocaleTimeString();}catch(error){console.error('Error:',error);document.getElementById('gridsList').innerHTML='<div class="loading">Error cargando datos</div>';}}loadData();setInterval(loadData,5000);</script></body></html>`;

app.get('/dashboard', (req, res) => {
  res.send(dashboardHTML);
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
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

    grvtClient = new GRVTClient({
      apiKey,
      subAccountId,
      environment,
    });

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
      logger.info('📱 Cliente WebSocket conectado');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.debug('📨 Mensaje WS:', data.type);
        } catch (error) {
          logger.error('❌ Error parsing WS message:', error);
        }
      });

      ws.on('close', () => {
        logger.info('📱 Cliente WebSocket desconectado');
      });
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
    logger.error('❌ Error en inicialización:', error);
    process.exit(1);
  }
}

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

init().catch((error) => {
  logger.error('❌ Error fatal:', error);
  process.exit(1);
});

export { app, wss, grvtClient, gridEngine, db };
