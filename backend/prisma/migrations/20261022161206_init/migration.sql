-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "plate" TEXT,
    "mechanic" TEXT,
    "initials" TEXT,
    "time" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "extra" TEXT,
    "extraItems" JSONB,
    "items" JSONB,
    "color" TEXT NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sparepart" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "minStock" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "Sparepart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mechanic" TEXT,
    "mechanicId" TEXT,
    "initials" TEXT,
    "color" TEXT,
    "method" TEXT NOT NULL,
    "cashAmount" INTEGER,
    "qrisAmount" INTEGER,
    "total" INTEGER NOT NULL,
    "serviceAmount" INTEGER NOT NULL,
    "partsAmount" INTEGER NOT NULL,
    "commission" INTEGER NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sparepart_code_key" ON "Sparepart"("code");
