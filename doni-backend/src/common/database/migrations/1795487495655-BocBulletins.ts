import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Daily BOC ingestion (ADR 0003, 0009): one row per trading day holding the
 * original PDF, its checksum, what was read from it and the outcome of the
 * checks. End-of-day prices point to the bulletin they were read from, so a
 * held day's prices are never served.
 */
export class BocBulletins1795487495655 implements MigrationInterface {
  name = 'BocBulletins1795487495655';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "boc_bulletins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tradingDate" date NOT NULL, "status" "public"."eod_price_status_enum" NOT NULL, "document" bytea NOT NULL, "checksum" character(64) NOT NULL, "sourceUrl" text NOT NULL, "fetchedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "parsed" jsonb, "failures" jsonb NOT NULL DEFAULT '[]', "reviewedById" uuid, "reviewedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_9e739d560f3d2fb1efd54aa4633" UNIQUE ("tradingDate"), CONSTRAINT "PK_319f4df6c353666b13bfc8c3dcd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "eod_prices" ADD "bulletinId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_eod_prices_bulletin" ON "eod_prices" ("bulletinId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "eod_prices" ADD CONSTRAINT "FK_8a43329483e386aff1d193cef56" FOREIGN KEY ("bulletinId") REFERENCES "boc_bulletins"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "eod_prices" DROP CONSTRAINT "FK_8a43329483e386aff1d193cef56"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_eod_prices_bulletin"`);
    await queryRunner.query(
      `ALTER TABLE "eod_prices" DROP COLUMN "bulletinId"`,
    );
    await queryRunner.query(`DROP TABLE "boc_bulletins"`);
  }
}
