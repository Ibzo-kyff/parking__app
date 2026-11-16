import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';

type FirebaseServiceAccount = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

const getServiceAccount = (raw: FirebaseServiceAccount): ServiceAccount => {
  const projectId = raw.project_id ?? raw.projectId;
  const clientEmail = raw.client_email ?? raw.clientEmail;
  const privateKey = raw.private_key ?? raw.privateKey;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Le compte de service Firebase doit contenir project_id, client_email et private_key.'
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  };
};

const getFirebaseCredential = () => {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    return cert(getServiceAccount(JSON.parse(serviceAccountJson) as FirebaseServiceAccount));
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId || clientEmail || privateKey) {
    return cert(getServiceAccount({
      projectId,
      clientEmail,
      privateKey,
    }));
  }

  const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (existsSync(serviceAccountPath)) {
    const raw = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as FirebaseServiceAccount;
    return cert(getServiceAccount(raw));
  }

  return applicationDefault();
};

const getFirebaseMessaging = () => {
  const app = getApps().find((candidate) => candidate.name === '[DEFAULT]')
    ?? initializeApp({ credential: getFirebaseCredential() });

  return getMessaging(app);
};

const toStringData = (data: Record<string, unknown>): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (serialized !== undefined) result[key] = serialized;
  }

  return result;
};

const getWebLink = (data: Record<string, unknown>): string | undefined => {
  const webAppUrl = process.env.WEB_APP_URL;
  if (!webAppUrl) return undefined;

  const baseUrl = new URL(webAppUrl);
  if (baseUrl.protocol !== 'https:') return undefined;

  const target = typeof data.url === 'string'
    ? data.url
    : '/dashboard';
  const link = new URL(target, baseUrl);

  if (link.origin !== baseUrl.origin) {
    throw new Error('Le lien de notification doit rester sur le domaine de WEB_APP_URL.');
  }

  return link.toString();
};

export const sendFirebasePush = async (
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) => {
  if (!token.trim()) throw new Error('Token FCM manquant.');

  const safeTitle = title || 'Mobility';
  const safeBody = body.substring(0, 150) + (body.length > 150 ? '...' : '');
  const icon = process.env.FIREBASE_NOTIFICATION_ICON_URL
    || (process.env.WEB_APP_URL
      ? new URL('/icon-192.png', process.env.WEB_APP_URL).toString()
      : undefined);
  const image = typeof data.image === 'string' ? data.image : undefined;
  const link = getWebLink(data);
  const messageData = toStringData(data);
  if (link) messageData.url = link;

  const message: Message = {
    token: token.trim(),
    notification: {
      title: safeTitle,
      body: safeBody,
      ...(image ? { imageUrl: image } : {}),
    },
    data: messageData,
    webpush: {
      notification: {
        title: safeTitle,
        body: safeBody,
        ...(icon ? { icon } : {}),
        ...(image ? { image } : {}),
      },
      ...(link ? { fcmOptions: { link } } : {}),
    },
  };

  return getFirebaseMessaging().send(message);
};
