/*
  Warnings:

  - A unique constraint covering the columns `[gmail_id]` on the table `movimientos` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "movimientos" ADD COLUMN     "gmail_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_gmail_id_key" ON "movimientos"("gmail_id");
