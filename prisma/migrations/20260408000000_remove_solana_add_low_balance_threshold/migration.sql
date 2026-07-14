ALTER TABLE "app_configuration"
  DROP COLUMN IF EXISTS "rpc_endpoint",
  DROP COLUMN IF EXISTS "jupiter_api_key",
  DROP COLUMN IF EXISTS "dest_wallet",
  DROP COLUMN IF EXISTS "slippage",
  DROP COLUMN IF EXISTS "selling_token_address",
  DROP COLUMN IF EXISTS "buying_token_address",
  DROP COLUMN IF EXISTS "target_token_decimals",
  ADD COLUMN IF NOT EXISTS "low_balance_threshold" DOUBLE PRECISION NOT NULL DEFAULT 100;
