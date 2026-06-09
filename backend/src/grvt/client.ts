// backend/src/grvt/client.ts
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

interface GRVTConfig {
  apiKey: string;
  subAccountId: string;
  environment?: 'prod' | 'testnet' | 'staging';
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
  private baseURL: string;
  private authEndpoint: string;
  private sessionCookie: string = '';
  private accountId: string = '';

  constructor(config: GRVTConfig) {
    this.config = config;
    const env = config.environment || 'prod';

    // Configurar endpoints según ambiente
    if (env === 'prod') {
      this.authEndpoint = 'https://edge.grvt.io/auth/api_key/login';
      this.baseURL = 'https://edge.grvt.io';
    } else if (env === 'testnet') {
      this.authEndpoint = 'https://edge.testnet.grvt.io/auth/api_key/login';
      this.baseURL = 'https://edge.testnet.grvt.io';
    } else {
      this.authEndpoint = 'https://edge.staging.gravitymarkets.io/auth/api_key/login';
      this.baseURL = 'https://edge.staging.gravitymarkets.io';
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });
  }

  async connect(): Promise<void> {
    try {
      logger.info('🔐 Autenticando con GRVT...');

      // Autentica con API Key
      const authResponse = await axios.post(
        this.authEndpoint,
        { api_key: this.config.apiKey },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'rm=true;',
          },
        }
      );

      // Extrae cookie y account ID de la respuesta
      const setCookieHeader = authResponse.headers['set-cookie'];
      if (setCookieHeader) {
        const cookieArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
        this.sessionCookie = cookieArray
          .find(c => c.includes('gravity='))
          ?.split(';')[0] || '';
      }

      const accountIdHeader = authResponse.headers['x-grvt-account-id'];
      if (accountIdHeader) {
        this.accountId = accountIdHeader.toString().trim();
      }

      if (!this.sessionCookie || !this.accountId) {
        throw new Error('No se pudieron obtener credenciales de sesión');
      }

      // Actualiza client con cookies de sesión
      this.client.defaults.headers.Cookie = this.sessionCookie;
      this.client.defaults.headers['X-Grvt-Account-Id'] = this.accountId;

      logger.info(`✅ Conectado a GRVT (Account: ${this.accountId})`);
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
