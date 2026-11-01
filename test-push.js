const { PrismaClient } = require('@prisma/client');
const { sendFirebasePush } = require('./dist/utils/firebaseAdmin');

const prisma = new PrismaClient();

async function test() {
  console.log('?? Recherche des utilisateurs avec un token push dans la base...');
  
  const usersWithTokens = await prisma.user.findMany({
    where: {
      expoPushToken: {
        not: null
      }
    },
    select: {
      id: true,
      email: true,
      nom: true,
      prenom: true,
      role: true,
      expoPushToken: true
    }
  });

  if (usersWithTokens.length === 0) {
    console.log('?? Aucun utilisateur n\'a encore enregistré de token.');
    console.log('?? Connectez-vous sur le Dashboard (http://localhost:3000) et acceptez la permission pour enregistrer votre token !');
    return;
  }

  console.log(`? ${usersWithTokens.length} utilisateur(s) avec token trouvé(s) :`);
  usersWithTokens.forEach(u => console.log(`- [${u.role}] ${u.prenom} ${u.nom} (${u.email}) : Token=${u.expoPushToken.substring(0, 25)}...`));

  const target = usersWithTokens[0];
  console.log(`\n?? Envoi d'un test Push à ${target.email}...`);

  const res = await sendFirebasePush(
    target.expoPushToken,
    '?? Test Mobility Push',
    'Félicitations ! Vos notifications Push Web avec le logo Mobility fonctionnent parfaitement !',
    { url: '/dashboard/admin/notifications', notificationId: 9999 }
  );

  console.log('Résultat:', res ? '? Succès !' : '? Échec');
}

test().catch(console.error).finally(() => prisma.$disconnect());
