const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const users = [
    { name: 'Admin', email: 'admin@lacasona.local', role: Role.ADMIN, password: 'Admin123*' },
    { name: 'Mesero 1', email: 'mesero@lacasona.local', role: Role.WAITER, password: 'Mesero123*' },
    { name: 'Cocina 1', email: 'cocina@lacasona.local', role: Role.KITCHEN, password: 'Cocina123*' },
  ];

  for (const user of users) {
    const exists = await prisma.user.findUnique({ where: { email: user.email } });
    if (!exists) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          role: user.role,
          passwordHash,
        },
      });
    }
  }

  const tables = ['Mesa 1'];
  for (const tableName of tables) {
    const exists = await prisma.table.findUnique({ where: { name: tableName } });
    if (!exists) {
      await prisma.table.create({ data: { name: tableName, capacity: 4 } });
    }
  }

  const bebidas = await prisma.category.upsert({
    where: { name: 'Bebidas' },
    update: {},
    create: { name: 'Bebidas' },
  });


  const products = [
    { name: 'Agua Mineral', price: 2000, categoryId: bebidas.id },
  ];

  for (const product of products) {
    const exists = await prisma.product.findFirst({ where: { name: product.name } });
    if (!exists) {
      await prisma.product.create({ data: product });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
