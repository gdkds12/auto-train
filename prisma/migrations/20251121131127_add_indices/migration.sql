/*
  Warnings:

  - A unique constraint covering the columns `[type,username]` on the table `Account` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Account_type_username_key" ON "Account"("type", "username");

-- CreateIndex
CREATE INDEX "Task_accountId_idx" ON "Task"("accountId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");
