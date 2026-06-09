// backend/src/api/routes.ts
import { Express, Request, Response } from 'express';
import { GRVTClient } from '../grvt/client';
import { GridEngine } from '../trading/gridEngine';
import { Database } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export default function setupRoutes(
  app: Express,
  grvt: GRVTClient,
  gridEngine: GridEngine,
  db: Database
) {
  // GET: Información de cuenta
  app.get('/api/account', async (req: Request, res: Response) => {
    try {
      const account = await grvt.getAccount();
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo account' });
    }
  });

  // POST: Crear grid
  app.post('/api/grids', async (req: Request, res: Response) => {
    try {
      const { instrument, rangelow, rangeHigh, levels, amountPerLevel } = req.body;

      if (!instrument || !rangelow || !rangeHigh || !levels || !amountPerLevel) {
        return res.status(400).json({ error: 'Parámetros faltantes' });
      }

      const gridConfig = {
        id: uuidv4(),
        instrument,
        rangelow: parseFloat(rangelow),
        rangeHigh: parseFloat(rangeHigh),
        levels: parseInt(levels),
        amountPerLevel: parseFloat(amountPerLevel),
        enabled: true,
      };

      await gridEngine.createGrid(gridConfig);
      res.status(201).json(gridConfig);
    } catch (error) {
      logger.error('Error creando grid:', error);
      res.status(500).json({ error: 'Error creando grid' });
    }
  });

  // GET: Listar grids
  app.get('/api/grids', async (req: Request, res: Response) => {
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
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo grids' });
    }
  });

  // DELETE: Eliminar grid
  app.delete('/api/grids/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.deleteGrid(id);
      res.json({ success: true, gridId: id });
    } catch (error) {
      res.status(500).json({ error: 'Error eliminando grid' });
    }
  });

  // GET: Historial de fills
  app.get('/api/fills/:gridId', async (req: Request, res: Response) => {
    try {
      const { gridId } = req.params;
      const fills = await db.getFills(gridId);
      res.json(fills);
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo fills' });
    }
  });

  // GET: Estado de grids activos
  app.get('/api/status', async (req: Request, res: Response) => {
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
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo status' });
    }
  });

  logger.info('✅ Rutas API configuradas');
}
