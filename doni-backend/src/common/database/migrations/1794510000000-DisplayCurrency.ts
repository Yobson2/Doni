import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Each user's display currency (ADR 0008): amounts stay stored in XOF; a
 * user may choose to see them in EUR, converted at the fixed peg rate.
 */
export class DisplayCurrency1794510000000 implements MigrationInterface {
  name = 'DisplayCurrency1794510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."display_currency_enum" AS ENUM('XOF', 'EUR')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "displayCurrency" "public"."display_currency_enum" NOT NULL DEFAULT 'XOF'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "displayCurrency"`,
    );
    await queryRunner.query(`DROP TYPE "public"."display_currency_enum"`);
  }
}
