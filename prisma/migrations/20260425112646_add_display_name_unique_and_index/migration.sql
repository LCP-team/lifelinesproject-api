/*
  Warnings:

  - A unique constraint covering the columns `[display_name]` on the table `lifeliners` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "lifeliners_display_name_key" ON "lifeliners"("display_name");

-- CreateIndex
CREATE INDEX "lifeliners_user_id_idx" ON "lifeliners"("user_id");

-- CreateIndex
CREATE INDEX "lifeliners_display_name_idx" ON "lifeliners"("display_name");
