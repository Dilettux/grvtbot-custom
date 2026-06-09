"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.gridEngine = exports.grvtClient = exports.wss = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const ws_1 = require("ws");
const http_1 = require("http");
const database_1 = require("./db/database");
const client_1 = require("./grvt/client");
const gridEngine_1 = require("./trading/gridEngine");
const routes_1 = __importDefault(require("./api/routes"));
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
exports.wss = wss;
app.use(require('helmet')({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", "data:"],
        },
    },
    crossOriginOpenerPolicy: true,
}));
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Dashboard HTML inline - SIMPLE y FUNCIONA
app.get('/dashboard', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>GRVTBot</title><style>body{font-family:sans-serif;background:linear-gradient(135deg,#1e3c72,#2a5298);color:#fff;padding:40px;margin:0}h1{text-align:center;margin-bottom:40px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px}.card{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:20px}.card h3{color:rgba(255,255,255,0.6);text-transform:uppercase;margin-bottom:10px;font-size:0.9em}.value{font-size:2em;color:#4ade80;font-weight:bold}button{background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;margin-right:10px;margin-top:20px}button:hover{background:#2563eb}</style></head><body><h1>🤖 GRVTBot Dashboard</h1><div class="cards"><div class="card"><h3>Estado</h3><div class="value">✅ OK</div></div><div class="card"><h3>Grids Activos</h3><div class="value" id="grids">0</div></div><div class="card"><h3>Fills</h3><div class="value" id="fills">0</div></div><div class="card"><h3>PnL</h3><div class="value" id="pnl">$0.00</div></div></div><button onclick="load()">🔄 Actualizar</button><script>function load(){fetch('/api/status').then(r=>r.json()).then(d=>{document.getElementById('grids').textContent=d.activeGrids||0;document.getElementById('fills').textContent=d.totalFills||0;document.getElementById('pnl').textContent='$'+(d.totalPnL||0).toFixed(2);}).catch(e=>console.error('Error:',e));}load();setInterval(load,5000);</script></body></html>`);
});
const limiter = (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);
let grvtClient;
let gridEngine;
let db;
async function init() {
    try {
        logger_1.logger.info('🚀 Iniciando GRVTBot Custom...');
        exports.db = db = new database_1.Database();
        await db.init();
        logger_1.logger.info('✅ Base de datos inicializada');
        const apiKey = process.env.GRVT_API_KEY;
        const subAccountId = process.env.GRVT_SUB_ACCOUNT_ID;
        const environment = (process.env.GRVT_ENVIRONMENT || 'prod');
        if (!apiKey || !subAccountId) {
            throw new Error('❌ Credenciales no configuradas');
        }
        exports.grvtClient = grvtClient = new client_1.GRVTClient({
            apiKey,
            subAccountId,
            environment,
        });
        await grvtClient.connect();
        logger_1.logger.info('✅ Conectado a GRVT');
        exports.gridEngine = gridEngine = new gridEngine_1.GridEngine(grvtClient, db);
        await gridEngine.start();
        logger_1.logger.info('✅ Grid engine iniciado');
        (0, routes_1.default)(app, grvtClient, gridEngine, db);
        app.get('/health', (req, res) => {
            res.json({ status: 'ok' });
        });
        wss.on('connection', (ws) => {
            logger_1.logger.info('📱 WebSocket conectado');
            ws.on('close', () => logger_1.logger.info('📱 WebSocket cerrado'));
        });
        const port = process.env.BOT_PORT || 3848;
        server.listen(port, () => {
            logger_1.logger.info(`✅ Servidor en puerto ${port}`);
            logger_1.logger.info(`⚡ Active bots loaded`);
        });
    }
    catch (error) {
        logger_1.logger.error('❌ Error:', error);
        process.exit(1);
    }
}
process.on('SIGTERM', async () => {
    try {
        await gridEngine?.stop();
        await grvtClient?.disconnect();
        server.close(() => process.exit(0));
    }
    catch (error) {
        process.exit(1);
    }
});
init().catch(() => process.exit(1));
