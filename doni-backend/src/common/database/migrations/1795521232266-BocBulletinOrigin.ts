import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historical BOC backfill (ADR 0018): each bulletin records whether it came
 * from the daily ingestion or the backfill, so that backfilled history can be
 * kept from users until the licence gate is cleared (HISTORY_PUBLIC). Every
 * bulletin stored so far came from the daily ingestion.
 */
export class BocBulletinOrigin1795521232266 implements MigrationInterface {
  name = 'BocBulletinOrigin1795521232266';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."boc_bulletin_origin_enum" AS ENUM('daily', 'backfill')`,
    );
    await queryRunner.query(
      `ALTER TABLE "boc_bulletins" ADD "origin" "public"."boc_bulletin_origin_enum" NOT NULL DEFAULT 'daily'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "boc_bulletins" DROP COLUMN "origin"`);
    await queryRunner.query(`DROP TYPE "public"."boc_bulletin_origin_enum"`);
  }
}
