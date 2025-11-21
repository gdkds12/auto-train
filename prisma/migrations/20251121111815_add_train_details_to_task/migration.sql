-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "selectedArrTime" TEXT,
ADD COLUMN     "selectedDepTime" TEXT,
ADD COLUMN     "selectedTrainClass" TEXT,
ADD COLUMN     "selectedTrainId" TEXT,
ADD COLUMN     "selectedTrainNo" TEXT,
ADD COLUMN     "selectedTrainType" TEXT,
ALTER COLUMN "timeTo" DROP NOT NULL;
