// backend/src/grvt/client.ts
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

interface GRVTConfig {
  apiKey: string;
  apiSecret: string;
  tradingAddress: string;
  accountId: string;
}

interface Order {
  id: string;
  instrument: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  status: string;
  timestamp: number;
}

interface Position {
  instrument: string;
  quantity: number;
  averagePrice: number;
  pnl: number;
}

export class GRVTClient {
  private config: GRVTConfig;
  private client: AxiosInstance;
  private baseURL = 'https://api.grvt.io/v1'; // Ajusta según GRVT docs

  constructor(config: GRVTConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
    });
  }

  async connect(): Promise<void> {
    try {
      // Valida credenciales haciendo un ping
      const response = await this.client.get('/account');
      logger.info(`✅ Conectado a GRVT como ${response.data.address}`);
    } catch (error) {
      throw new Error(`❌ No se pudo conectar a GRVT: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    logger.info('📵 Desconectando de GRVT');
    // Cleanup si es necesario
  }

  // Obtener información de cuenta
  async getAccount(): Promise<any> {
    try {
      const response = await this.client.get('/account');
      return response.data;
    } catch (error) {
      logger.error('Error obteniendo account:', error);
      throw error;
    }
  }

  // Obtener precio actual
  async getPrice(instrument: string): Promise<number> {
    try {
      const response = await this.client.get(`/price/${instrument}`);
      return response.data.price;
    } catch (error) {
      logger.error(`Error obteniendo precio de ${instrument}:`, error);
      throw error;
    }
  }

  // Colocar orden límite
  async placeLimitOrder(
    instrument: string,
    side: 'BUY' | 'SELL',
    price: number,
    quantity: number
  ): Promise<Order> {
    try {
      const response = await this.client.post('/orders', {
        instrument,
        side,
        price,
        quantity,
        type: 'LIMIT',
        timeInForce: 'GTC', // Good Till Cancel
      });
      logger.info(
        `📝 Orden ${side} colocada: ${quantity} ${instrument} @ ${price}`
      );
      return response.data;
    } catch (error) {
      logger.error('Error colocando orden:', error);
      throw error;
    }
  }

  // Cancelar orden
  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.client.delete(`/orders/${orderId}`);
      logger.info(`❌ Orden cancelada: ${orderId}`);
    } catch (error) {
      logger.error('Error cancelando orden:', error);
      throw error;
    }
  }

  // Obtener órdenes abiertas
  async getOpenOrders(instrument?: string): Promise<Order[]> {
    try {
      const params = instrument ? { instrument } : {};
      const response = await this.client.get('/orders', { params });
      return response.data.orders || [];
    } catch (error) {
      logger.error('Error obteniendo órdenes:', error);
      throw error;
    }
  }

  // Obtener posición
  async getPosition(instrument: string): Promise<Position> {
    try {
      const response = await this.client.get(`/positions/${instrument}`);
      return response.data;
    } catch (error) {
      logger.error(`Error obteniendo posición de ${instrument}:`, error);
      throw error;
    }
  }

  // Stream de fills (simulado con polling)
  async getFills(limit: number = 100): Promise<any[]> {
    try {
      const response = await this.client.get('/fills', {
        params: { limit },
      });
      return response.data.fills || [];
    } catch (error) {
      logger.error('Error obteniendo fills:', error);
      throw error;
    }
  }
}
