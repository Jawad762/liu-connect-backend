import dotenv from 'dotenv';

dotenv.config();

interface Config {
  PORT: number;
  NODE_ENV: string;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
}

const config: Config = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || '',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || ''
};

export default config;
