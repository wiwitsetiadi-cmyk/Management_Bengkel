-- CreateTable
CREATE TABLE "CommissionSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "servicePercent" INTEGER NOT NULL DEFAULT 10,
    "partsPercent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionOverride" (
    "id" TEXT NOT NULL,
    "mechanicId" TEXT NOT NULL,
    "servicePercent" INTEGER,
    "partsPercent" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionOverride_mechanicId_key" ON "CommissionOverride"("mechanicId");
