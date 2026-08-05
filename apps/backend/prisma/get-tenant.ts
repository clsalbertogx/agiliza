import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  console.log(JSON.stringify(tenants));
  const counts = {
    clients: await prisma.client.count(),
    invoices: await prisma.invoice.count(),
    templates: await prisma.messageTemplate.count(),
  };
  console.log('counts:', JSON.stringify(counts));
  await prisma.$disconnect();
})();
