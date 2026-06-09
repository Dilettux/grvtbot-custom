// backend/src/trading/gridEngine.ts
import { EventEmitter } from 'events';
import { GRVTClient } from '../grvt/client';
import { Database } from '../db/database';
import { logger } from '../utils/logger';

interface GridConfig {
  id: string;
  instrument: string;
  rangelow: number;
  rangeHigh: number;
  levels: number;
  amountPerLevel: number;
  enabled: boolean;
}

interface GridState {
  config: GridConfig;
  currentPrice: number;
  openOrders: Map<string, any>;
  fills: number;
  pnl: number;
  lastUpdate: Date;
}

export class GridEngine extends EventEmitter {
  private grids: Map<string, GridState> = new Map();
  private grvt: GRVTClient;
  private db: Database;
  private updateInterval: NodeJS.Timer | null = null;
  private isRunning = false;

  constructor(grvt: GRVTClient, db: Database) {
    super();
    this.grvt = grvt;
    this.db = db;
  }

  // Inicia el motor
  async start(): Promise<void> {
    try {
      logger.info('🎬 Iniciando Grid Engine...');

      // Carga grids de la BD
      const grids = await this.db.getGrids();
      for (const gridConfig of grids) {
        if (gridConfig.enabled) {
          await this.activateGrid(gridConfig);
        }
      }

      this.isRunning = true;

      // Loop principal: actualiza cada 5 segundos
      this.updateInterval = setInterval(() => {
        this.update();
      }, 5000);

      logger.info(`✅ Grid Engine corriendo. Grids activos: ${this.grids.size}`);
    } catch (error) {
      logger.error('❌ Error iniciando Grid Engine:', error);
      throw error;
    }
  }

  // Detiene el motor
  async stop(): Promise<void> {
    logger.info('⏹️ Deteniendo Grid Engine...');

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Cancela todas las órdenes
    for (const grid of this.grids.values()) {
      await this.deactivateGrid(grid.config.id);
    }

    this.isRunning = false;
    logger.info('✅ Grid Engine detenido');
  }

  // Crea un nuevo grid
  async createGrid(config: GridConfig): Promise<void> {
    try {
      logger.info(`📊 Creando grid: ${config.instrument}`);

      // Valida parámetros
      if (config.rangelow >= config.rangeHigh) {
        throw new Error('Range low debe ser menor a range high');
      }

      if (config.levels < 2) {
        throw new Error('Mínimo 2 niveles');
      }

      // Guarda en BD
      await this.db.createGrid(config);

      // Activa si está enabled
      if (config.enabled) {
        await this.activateGrid(config);
      }

      this.emit('grid-created', config);
      logger.info(`✅ Grid creado: ${config.id}`);
    } catch (error) {
      logger.error('Error creando grid:', error);
      throw error;
    }
  }

  // Activa un grid (coloca órdenes)
  private async activateGrid(config: GridConfig): Promise<void> {
    try {
      logger.info(`🟢 Activando grid: ${config.instrument}`);

      // Obtiene precio actual
      const currentPrice = await this.grvt.getPrice(config.instrument);

      // Calcula niveles
      const levelPrices = this.calculateLevels(
        config.rangelow,
        config.rangeHigh,
        config.levels,
        currentPrice
      );

      // Coloca órdenes buy (por debajo del precio actual)
      const buyLevels = levelPrices.filter((p) => p < currentPrice);
      for (const price of buyLevels) {
        try {
          const order = await this.grvt.placeLimitOrder(
            config.instrument,
            'BUY',
            price,
            config.amountPerLevel
          );
          logger.info(`📊 BUY order placed: ${price}`);
        } catch (error) {
          logger.warn(`⚠️ Error placing BUY order at ${price}:`, error);
        }
      }

      // Coloca órdenes sell (por encima del precio actual)
      const sellLevels = levelPrices.filter((p) => p > currentPrice);
      for (const price of sellLevels) {
        try {
          const order = await this.grvt.placeLimitOrder(
            config.instrument,
            'SELL',
            price,
            config.amountPerLevel
          );
          logger.info(`📊 SELL order placed: ${price}`);
        } catch (error) {
          logger.warn(`⚠️ Error placing SELL order at ${price}:`, error);
        }
      }

      // Crea estado del grid
      const gridState: GridState = {
        config,
        currentPrice,
        openOrders: new Map(),
        fills: 0,
        pnl: 0,
        lastUpdate: new Date(),
      };

      this.grids.set(config.id, gridState);
      this.emit('grid-activated', config);
    } catch (error) {
      logger.error('Error activando grid:', error);
      throw error;
    }
  }

  // Desactiva un grid (cancela órdenes)
  private async deactivateGrid(gridId: string): Promise<void> {
    try {
      const grid = this.grids.get(gridId);
      if (!grid) return;

      logger.info(`🔴 Desactivando grid: ${grid.config.instrument}`);

      // Cancela todas las órdenes abiertas
      const openOrders = await this.grvt.getOpenOrders(
        grid.config.instrument
      );
      for (const order of openOrders) {
        try {
          await this.grvt.cancelOrder(order.id);
        } catch (error) {
          logger.warn(`⚠️ Error cancelando orden:`, error);
        }
      }

      this.grids.delete(gridId);
      this.emit('grid-deactivated', gridId);
      logger.info(`✅ Grid desactivado: ${gridId}`);
    } catch (error) {
      logger.error('Error desactivando grid:', error);
      throw error;
    }
  }

  // Loop principal de actualización
  private async update(): Promise<void> {
    try {
      for (const gridState of this.grids.values()) {
        // Obtiene precio actual
        const newPrice = await this.grvt.getPrice(gridState.config.instrument);

        // Si el precio cambió mucho, rebalancea
        if (
          Math.abs(newPrice - gridState.currentPrice) /
            gridState.currentPrice >
          0.02
        ) {
          // 2% cambio
          logger.info(`📈 Rebalanceando grid (precio: ${newPrice})`);
          await this.deactivateGrid(gridState.config.id);
          await this.activateGrid(gridState.config);
        }

        // Actualiza estado
        gridState.currentPrice = newPrice;
        gridState.lastUpdate = new Date();

        this.emit('update', gridState);
      }
    } catch (error) {
      logger.error('Error en update loop:', error);
    }
  }

  // Calcula precios de niveles distribuidos
  private calculateLevels(
    low: number,
    high: number,
    levels: number,
    current: number
  ): number[] {
    const step = (high - low) / (levels - 1);
    const prices: number[] = [];

    for (let i = 0; i < levels; i++) {
      prices.push(low + step * i);
    }

    // Ordena y filtra precios duplicados o muy cercanos
    return [
      ...new Set(prices.map((p) => Math.round(p * 100) / 100)),
    ].sort((a, b) => a - b);
  }

  // Obtiene estado de un grid
  getGridState(gridId: string): GridState | undefined {
    return this.grids.get(gridId);
  }

  // Lista todos los grids activos
  getActiveGrids(): GridState[] {
    return Array.from(this.grids.values());
  }
}
