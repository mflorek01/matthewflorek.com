CREATE TABLE "AiAssistantSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "encryptedApiKey" TEXT,
    "apiKeyLastFour" TEXT,
    "model" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiAssistantSettings_pkey" PRIMARY KEY ("id")
);
