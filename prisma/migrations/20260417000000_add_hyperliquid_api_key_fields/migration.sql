-- AlterTable
ALTER TABLE "app_configuration" ADD COLUMN "hyperliquid_private_key" TEXT NOT NULL DEFAULT '';
ALTER TABLE "app_configuration" ADD COLUMN "hyperliquid_wallet_address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "app_configuration" ADD COLUMN "hyperliquid_key_created_date" TIMESTAMP(3);
