
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import config from '../config.ts';

const serviceAccount = config.FIREBASE_SERVICE_ACCOUNT;
const serviceAccountJson = JSON.parse(serviceAccount);

const app = initializeApp({
  credential: cert(serviceAccountJson),
});

export const messaging = getMessaging(app);