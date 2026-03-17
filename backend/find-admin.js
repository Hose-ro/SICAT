const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.usuario.findMany({
    where: { rol: 'ADMIN' },
    select: { email: true, username: true, nombre: true }
  });
  console.log('ADMIN USERS FOUND:', JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
