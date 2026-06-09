"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridEngine = void 0;
// backend/src/trading/gridEngine.ts
const events_1 = require("events");
const logger_1 = require("../utils/logger");
class GridEngine extends events_1.EventEmitter {
    grids = new Map();
    grvt;
    db;
    updateInterval = null;
    isRunning = false;
    constructor(grvt, db) {
        super();
        this.grvt = grvt;
        this.db = db;
    }
    // Inicia el motor
    async start() {
        try {
            logger_1.logger.info('🎬 Iniciando Grid Engine...');
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
            logger_1.logger.info(`✅ Grid Engine corriendo. Grids activos: ${this.grids.size}`);
        }
        catch (error) {
            logger_1.logger.error('❌ Error iniciando Grid Engine:', error);
            throw error;
        }
    }
    // Detiene el motor
    async stop() {
        logger_1.logger.info('⏹️ Deteniendo Grid Engine...');
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        // Cancela todas las órdenes
        for (const grid of this.grids.values()) {
            await this.deactivateGrid(grid.config.id);
        }
        this.isRunning = false;
        logger_1.logger.info('✅ Grid Engine detenido');
    }
    // Crea un nuevo grid
    async createGrid(config) {
        try {
            logger_1.logger.info(`📊 Creando grid: ${config.instrument}`);
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
            logger_1.logger.info(`✅ Grid creado: ${config.id}`);
        }
        catch (error) {
            logger_1.logger.error('Error creando grid:', error);
            throw error;
        }
    }
    // Activa un grid (coloca órdenes)
    async activateGrid(config) {
        try {
            logger_1.logger.info(`🟢 Activando grid: ${config.instrument}`);
            // Obtiene precio actual
            const currentPrice = await this.grvt.getPrice(config.instrument);
            // Calcula niveles
            const levelPrices = this.calculateLevels(config.rangelow, config.rangeHigh, config.levels, currentPrice);
            // Coloca órdenes buy (por debajo del precio actual)
            const buyLevels = levelPrices.filter((p) => p < currentPrice);
            for (const price of buyLevels) {
                try {
                    const order = await this.grvt.placeLimitOrder(config.instrument, 'BUY', price, config.amountPerLevel);
                    logger_1.logger.info(`📊 BUY order placed: ${price}`);
                }
                catch (error) {
                    logger_1.logger.warn(`⚠️ Error placing BUY order at ${price}:`, error);
                }
            }
            // Coloca órdenes sell (por encima del precio actual)
            const sellLevels = levelPrices.filter((p) => p > currentPrice);
            for (const price of sellLevels) {
                try {
                    const order = await this.grvt.placeLimitOrder(config.instrument, 'SELL', price, config.amountPerLevel);
                    logger_1.logger.info(`📊 SELL order placed: ${price}`);
                }
                catch (error) {
                    logger_1.logger.warn(`⚠️ Error placing SELL order at ${price}:`, error);
                }
            }
            // Crea estado del grid
            const gridState = {
                config,
                currentPrice,
                openOrders: new Map(),
                fills: 0,
                pnl: 0,
                lastUpdate: new Date(),
            };
            this.grids.set(config.id, gridState);
            this.emit('grid-activated', config);
        }
        catch (error) {
            logger_1.logger.error('Error activando grid:', error);
            throw error;
        }
    }
    // Desactiva un grid (cancela órdenes)
    async deactivateGrid(gridId) {
        try {
            const grid = this.grids.get(gridId);
            if (!grid)
                return;
            logger_1.logger.info(`🔴 Desactivando grid: ${grid.config.instrument}`);
            // Cancela todas las órdenes abiertas
            const openOrders = await this.grvt.getOpenOrders(grid.config.instrument);
            for (const order of openOrders) {
                try {
                    await this.grvt.cancelOrder(order.id);
                }
                catch (error) {
                    logger_1.logger.warn(`⚠️ Error cancelando orden:`, error);
                }
            }
            this.grids.delete(gridId);
            this.emit('grid-deactivated', gridId);
            logger_1.logger.info(`✅ Grid desactivado: ${gridId}`);
        }
        catch (error) {
            logger_1.logger.error('Error desactivando grid:', error);
            throw error;
        }
    }
    // Loop principal de actualización
    async update() {
        try {
            for (const gridState of this.grids.values()) {
                // Obtiene precio actual
                const newPrice = await this.grvt.getPrice(gridState.config.instrument);
                // Si el precio cambió mucho, rebalancea
                if (Math.abs(newPrice - gridState.currentPrice) /
                    gridState.currentPrice >
                    0.02) {
                    // 2% cambio
                    logger_1.logger.info(`📈 Rebalanceando grid (precio: ${newPrice})`);
                    await this.deactivateGrid(gridState.config.id);
                    await this.activateGrid(gridState.config);
                }
                // Actualiza estado
                gridState.currentPrice = newPrice;
                gridState.lastUpdate = new Date();
                this.emit('update', gridState);
            }
        }
        catch (error) {
            logger_1.logger.error('Error en update loop:', error);
        }
    }
    // Calcula precios de niveles distribuidos
    calculateLevels(low, high, levels, current) {
        const step = (high - low) / (levels - 1);
        const prices = [];
        for (let i = 0; i < levels; i++) {
            prices.push(low + step * i);
        }
        // Ordena y filtra precios duplicados o muy cercanos
        return [
            ...new Set(prices.map((p) => Math.round(p * 100) / 100)),
        ].sort((a, b) => a - b);
    }
    // Obtiene estado de un grid
    getGridState(gridId) {
        return this.grids.get(gridId);
    }
    // Lista todos los grids activos
    getActiveGrids() {
        return Array.from(this.grids.values());
    }
}
exports.GridEngine = GridEngine;
