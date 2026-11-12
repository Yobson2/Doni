import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Opening positions are ledger entries (ADR 0001, 0004): the entry kind
 * gains a value. An opening position stores its PMP in "price" and 0 fees.
 */
export class OpeningPositions1794500000000 implements MigrationInterface {
  name = 'OpeningPositions1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."ledger_entry_kind_enum" ADD VALUE 'opening_position'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres cannot drop an enum value: rebuild the type without it.
    // This fails, on purpose, while any opening position is recorded.
    await queryRunner.query(
      `ALTER TYPE "public"."ledger_entry_kind_enum" RENAME TO "ledger_entry_kind_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_entry_kind_enum" AS ENUM('buy', 'sell')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ALTER COLUMN "kind" TYPE "public"."ledger_entry_kind_enum" USING "kind"::"text"::"public"."ledger_entry_kind_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ledger_entry_kind_enum_old"`);
  }
}
