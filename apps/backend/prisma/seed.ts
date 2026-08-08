import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Demo tenant id referenced by validation/e2e scripts (localStorage tenant_id).
const DEMO_TENANT_ID = 'c87a3abd-a449-40d7-8152-461a24a27fd5';

async function main() {
  console.log('🌱 Seeding database...');

  // Create the demo tenant (upsert → re-runnable on an already-seeded DB)
  const tenant = await prisma.tenant.upsert({
    where: { id: DEMO_TENANT_ID },
    update: {},
    create: {
      id: DEMO_TENANT_ID,
      name: 'Academia Fit Plus',
      slug: 'academia-fit-plus',
      document: '00.000.000/0001-00',
      email: 'financeiro@academiafitplus.com.br',
      phone: '5585999999999',
      paymentProvider: 'asaas',
      paymentProviderConfig: {
        apiKey: 'asaas_sandbox_key_here',
        environment: 'sandbox',
      },
    },
  });

  // PaymentProviderConfig row — canonical config shape the app reads
  // (payment-provider-config.repository / per-tenant-hmac-verifier).
  await prisma.paymentProviderConfig.upsert({
    where: { tenantId_provider: { tenantId: tenant.id, provider: 'asaas' } },
    update: {},
    create: {
      tenantId: tenant.id,
      provider: 'asaas',
      apiKeyEncrypted: 'asaas_sandbox_key_here',
      environment: 'sandbox',
      webhookSecret: 'asaas_webhook_secret_dev',
      isActive: true,
    },
  });

  console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

  // Create sample clients
  const clients = [
    { name: 'João Silva', phone: '5585988888881', email: 'joao@email.com' },
    { name: 'Maria Santos', phone: '5585988888882', email: 'maria@email.com' },
    { name: 'Carlos Oliveira', phone: '5585988888883', email: 'carlos@email.com' },
  ];

  for (const clientData of clients) {
    const client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        ...clientData,
        preferredChannel: 'WHATSAPP',
        preferredLeadDays: 3,
      },
    });
    console.log(`  ✅ Client: ${client.name}`);

    // Create an invoice for each client
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);

    await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        amount: 99.9,
        dueDate,
        description: 'Mensalidade Premium',
        status: 'PENDING',
      },
    });
    console.log(`  ✅ Invoice created for ${client.name}: R$ 99,90`);
  }

  // Create default message templates
  const templates = [
    {
      name: 'friendly_reminder_d3',
      content: 'Olá {{name}}! Sua fatura de {{value}} vence em {{due_date}}. Deixei o PIX prontinho aqui: {{pix_link}}',
      description: 'Lembrete amigável D-3',
    },
    {
      name: 'urgent_d0',
      content: '{{name}}, hoje é o dia! Sua fatura de {{value}} vence hoje. Pague agora: {{pix_link}}',
      description: 'Lembrete urgente no vencimento',
    },
    {
      name: 'overdue_d2',
      content: '{{name}}, sua fatura de {{value}} está atrasada. Evite juros, pague agora: {{pix_link}}',
      description: 'Atraso de 2 dias',
    },
  ];

  for (const template of templates) {
    await prisma.messageTemplate.create({
      data: {
        tenantId: tenant.id,
        ...template,
      },
    });
    console.log(`  ✅ Template: ${template.name}`);
  }

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
