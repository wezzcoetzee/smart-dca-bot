import type { OpenAPIV3 } from "openapi-types";

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title: "Smart DCA Bot API",
    version: "1.0.0",
    description:
      "API for cryptocurrency dollar-cost-averaging bot with dynamic buy amounts based on market conditions",
  },
  servers: [
    {
      url: "/api",
      description: "API Server",
    },
  ],
  paths: {
    "/cron": {
      get: {
        summary: "Execute DCA strategy",
        description:
          "Triggers the DCA bot to run the trading strategy. Requires Bearer token authentication.",
        tags: ["Cron"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Strategy executed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    amount: { type: "number", example: 0.00012345 },
                    reason: {
                      type: "string",
                      example: "Price below 44-day MA",
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Execute DCA strategy (POST)",
        description: "Same as GET - triggers the DCA bot to run the trading strategy.",
        tags: ["Cron"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Strategy executed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    amount: { type: "number", example: 0.00012345 },
                    reason: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/dashboard": {
      get: {
        summary: "Get dashboard data",
        description:
          "Returns chart data, transactions, and summary metrics for the dashboard",
        tags: ["Dashboard"],
        parameters: [
          {
            name: "period",
            in: "query",
            description: "Time period for data",
            schema: {
              type: "string",
              enum: ["1m", "1y", "all"],
              default: "1m",
            },
          },
        ],
        responses: {
          "200": {
            description: "Dashboard data",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DashboardResponse" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/multiplier-configuration": {
      get: {
        summary: "Get multiplier configurations",
        description: "Returns all multiplier threshold configurations",
        tags: ["Configuration"],
        responses: {
          "200": {
            description: "List of multiplier configurations",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/MultiplierConfiguration",
                  },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      patch: {
        summary: "Update multiplier configuration",
        description: "Create or update a multiplier threshold configuration",
        tags: ["Configuration"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "value", "multiplier"],
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "MOVING_AVERAGE",
                      "LTH_REALIZED_PRICE",
                      "AVERAGE_REALIZED_PRICE",
                      "LTH_BUYING",
                    ],
                  },
                  value: { type: "string", minLength: 1 },
                  multiplier: { type: "number" },
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated configuration",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MultiplierConfiguration" },
              },
            },
          },
          "400": {
            description: "Invalid request data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    details: {
                      type: "array",
                      items: { type: "object" },
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/configuration-staleness": {
      get: {
        summary: "Check configuration staleness",
        description: "Returns staleness status of multiplier configurations",
        tags: ["Configuration"],
        responses: {
          "200": {
            description: "Staleness status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    level: {
                      type: "string",
                      enum: ["warning", "danger"],
                      nullable: true,
                    },
                    staleConfigs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string" },
                          label: { type: "string" },
                          weeksStale: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/wallet-balance": {
      get: {
        summary: "Get wallet balances",
        description: "Returns SOL and cbBTC balances for the configured cold wallet",
        tags: ["Wallet"],
        responses: {
          "200": {
            description: "Wallet balances",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WalletBalanceResponse" },
              },
            },
          },
          "400": {
            description: "Wallet not configured or invalid",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/token-metadata": {
      get: {
        summary: "Get token metadata",
        description: "Fetches token symbol and decimals from Jupiter API",
        tags: ["Token"],
        parameters: [
          {
            name: "mint",
            in: "query",
            required: true,
            description: "Token mint address",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Token metadata",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    symbol: { type: "string", example: "BTC" },
                    decimals: { type: "number", example: 8 },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing mint parameter",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Token not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
        "/app-configuration": {
      get: {
        summary: "Get app configuration",
        description: "Returns current application configuration",
        tags: ["Configuration"],
        responses: {
          "200": {
            description: "App configuration",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/AppConfig" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        summary: "Update app configuration",
        description: "Updates application configuration settings",
        tags: ["Configuration"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AppConfigUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "Configuration updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { type: "object", nullable: true },
                  },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
      DashboardResponse: {
        type: "object",
        properties: {
          chartData: {
            type: "array",
            items: { $ref: "#/components/schemas/ChartDataPoint" },
          },
          transactions: {
            type: "array",
            items: { $ref: "#/components/schemas/TransactionRow" },
          },
          summary: { $ref: "#/components/schemas/DashboardSummary" },
        },
      },
      ChartDataPoint: {
        type: "object",
        properties: {
          date: { type: "string", example: "2025-01-15" },
          programaticValue: { type: "number" },
          fixedValue: { type: "number" },
          btcPrice: { type: "number" },
          programaticBtcAccumulated: { type: "number" },
          fixedBtcAccumulated: { type: "number" },
          programaticSpent: { type: "number" },
          fixedSpent: { type: "number" },
        },
      },
      TransactionRow: {
        type: "object",
        properties: {
          id: { type: "string" },
          date: { type: "string", format: "date-time" },
          amount: { type: "number" },
          price: { type: "number" },
          reason: { type: "string" },
        },
      },
      DashboardSummary: {
        type: "object",
        properties: {
          currentPrice: { type: "number" },
          totalProgramaticValue: { type: "number" },
          totalFixedValue: { type: "number" },
          programaticBtcAmount: { type: "number" },
          fixedBtcAmount: { type: "number" },
          percentageDifference: { type: "number" },
        },
      },
      MultiplierConfiguration: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "MOVING_AVERAGE",
              "LTH_REALIZED_PRICE",
              "AVERAGE_REALIZED_PRICE",
              "LTH_BUYING",
            ],
          },
          value: { type: "string" },
          multiplier: { type: "number" },
          enabled: { type: "boolean" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      WalletBalanceResponse: {
        type: "object",
        properties: {
          walletAddress: { type: "string" },
          balances: {
            type: "object",
            properties: {
              cbbtc: {
                type: "object",
                properties: {
                  amount: { type: "number" },
                  rawAmount: { type: "string" },
                  decimals: { type: "number" },
                  tokenAddress: { type: "string" },
                },
              },
              sol: {
                type: "object",
                properties: {
                  amount: { type: "number" },
                  rawAmount: { type: "string" },
                },
              },
            },
          },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      AppConfig: {
        type: "object",
        properties: {
          rpcEndpoint: { type: "string" },
          jupiterApiKey: { type: "string" },
          destWallet: { type: "string" },
          slippage: { type: "number" },
          sellingTokenAddress: { type: "string" },
          buyingTokenAddress: { type: "string" },
          baseAmountToPurchase: { type: "number" },
          targetTokenDecimals: { type: "number" },
          hyperliquidSymbol: { type: "string" },
          cronSecret: { type: "string" },
          configWarningWeeks: { type: "number" },
          configDangerWeeks: { type: "number" },
        },
      },
      AppConfigUpdate: {
        type: "object",
        properties: {
          rpcEndpoint: { type: "string" },
          jupiterApiKey: { type: "string" },
          destWallet: { type: "string" },
          slippage: { type: "number" },
          sellingTokenAddress: { type: "string" },
          buyingTokenAddress: { type: "string" },
          baseAmountToPurchase: { type: "number" },
          targetTokenDecimals: { type: "number" },
          hyperliquidSymbol: { type: "string" },
          cronSecret: { type: "string" },
          configWarningWeeks: { type: "number" },
          configDangerWeeks: { type: "number" },
        },
      },
    },
  },
};
