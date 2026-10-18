import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

let firebaseInitialized = false;

try {
  const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    }
    firebaseInitialized = true;
    console.log('? Firebase Admin SDK initialisé avec succès.');
  } else {
    console.warn('?? serviceAccountKey.json non trouvé pour Firebase Admin.');
  }
} catch (error) {
  console.error('? Erreur initialisation Firebase Admin:', error);
}

export const sendFirebasePush = async (
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) => {
  if (!firebaseInitialized || !token) return null;

  try {
    // Convertir toutes les valeurs de data en string car FCM l'exige pour le payload data
    const stringData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    const message: Message = {
      token,
      notification: {
        title: title || 'Mobility',
        body,
        imageUrl: (data.image as string) || undefined,
      },
      data: stringData,
      webpush: {
        notification: {
          title: title || 'Mobility',
          body,
          icon: '/images/logo.jpg',
          badge: '/images/logo.jpg',
          image: (data.image as string) || undefined,
          vibrate: [200, 100, 200],
        },
        fcmOptions: {
          link: (data.url as string) || '/dashboard/admin/notifications',
        },
      },
    };

    const response = await getMessaging().send(message);
    console.log('? Firebase Web Push envoyé avec succès (Logo Mobility inclus):', response);
    return response;
  } catch (error: any) {
    console.error('? Erreur envoi Firebase Push:', error.message);
    return null;
  }
};
