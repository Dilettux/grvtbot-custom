"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = setupRoutes;
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
function setupRoutes(app, grvt, gridEngine, db) {
    // GET: Información de cuenta
    app.get('/api/account', async (req, res) => {
        try {
            const account = await grvt.getAccount();
            res.json(account);
        }
        catch (error) {
            res.status(500).json({ error: 'Error obteniendo account' });
        }
    });
    // POST: Crear grid
    app.post('/api/grids', async (req, res) => {
        try {
            const { instrument, rangelow, rangeHigh, levels, amountPerLevel } = req.body;
            if (!instrument || !rangelow || !rangeHigh || !levels || !amountPerLevel) {
                return res.status(400).json({ error: 'Parámetros faltantes' });
            }
            const gridConfig = {
                id: (0, uuid_1.v4)(),
                instrument,
                rangelow: parseFloat(rangelow),
                rangeHigh: parseFloat(rangeHigh),
                levels: parseInt(levels),
                amountPerLevel: parseFloat(amountPerLevel),
                enabled: true,
            };
            await gridEngine.createGrid(gridConfig);
            res.status(201).json(gridConfig);
        }
        catch (error) {
            logger_1.logger.error('Error creando grid:', error);
            res.status(500).json({ error: 'Error creando grid' });
        }
    });
    // GET: Listar grids
    app.get('/api/grids', async (req, res) => {
        try {
            const grids = await db.getGrids();
            const activeGrids = gridEngine.getActiveGrids();
            const result = grids.map((grid) => {
                const activeGrid = activeGrids.find((ag) => ag.config.id === grid.id);
                return {
                    ...grid,
                    status: activeGrid ? 'ACTIVE' : 'INACTIVE',
                    currentPrice: activeGrid?.currentPrice,
                    lastUpdate: activeGrid?.lastUpdate,
                };
            });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: 'Error obteniendo grids' });
        }
    });
    // DELETE: Eliminar grid
    app.delete('/api/grids/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await db.deleteGrid(id);
            res.json({ success: true, gridId: id });
        }
        catch (error) {
            res.status(500).json({ error: 'Error eliminando grid' });
        }
    });
    // GET: Historial de fills
    app.get('/api/fills/:gridId', async (req, res) => {
        try {
            const { gridId } = req.params;
            const fills = await db.getFills(gridId);
            res.json(fills);
        }
        catch (error) {
            res.status(500).json({ error: 'Error obteniendo fills' });
        }
    });
    // GET: Estado de grids activos
    app.get('/api/status', async (req, res) => {
        try {
            const activeGrids = gridEngine.getActiveGrids();
            const totalFills = activeGrids.reduce((sum, g) => sum + g.fills, 0);
            const totalPnL = activeGrids.reduce((sum, g) => sum + g.pnl, 0);
            res.json({
                activeGrids: activeGrids.length,
                totalFills,
                totalPnL,
                grids: activeGrids.map((g) => ({
                    id: g.config.id,
                    instrument: g.config.instrument,
                    currentPrice: g.currentPrice,
                    fills: g.fills,
                    pnl: g.pnl,
                })),
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Error obteniendo status' });
        }
    });
    logger_1.logger.info('✅ Rutas API configuradas');
}
