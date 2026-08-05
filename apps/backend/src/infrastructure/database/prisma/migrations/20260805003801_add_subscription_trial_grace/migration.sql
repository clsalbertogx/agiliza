-- AlterTable
ALTER TABLE "payment_provider_configs" ADD COLUMN     "environment" TEXT NOT NULL DEFAULT 'sandbox';

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gracePeriodDays" INTEGER,
ADD COLUMN     "gracePeriodEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialDays" INTEGER,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
