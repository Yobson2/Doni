import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dividends (#12): reference dividends entered by an admin, user dividends
 * as a new ledger entry kind (net amount received and the reference
 * dividend it was confirmed from), and dismissed dividend suggestions.
 * Suggestions themselves are derived on read and never stored.
 */
export class Dividends1795486856923 implements MigrationInterface {
  name = 'Dividends1795486856923';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reference_dividends" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "securityId" uuid NOT NULL, "grossPerShare" numeric NOT NULL, "exDate" date NOT NULL, "paymentDate" date NOT NULL, "sourceNoticeUrl" text NOT NULL, CONSTRAINT "CHK_reference_dividends_terms" CHECK ("grossPerShare" > 0 AND "paymentDate" >= "exDate"), CONSTRAINT "PK_45d8a30326fe601b7558d72e2b8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reference_dividends_security_ex_date" ON "reference_dividends" ("securityId", "exDate") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dividend_dismissals" ("portfolioId" uuid NOT NULL, "referenceDividendId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_24fd4acad8d7c456462f57719d1" PRIMARY KEY ("portfolioId", "referenceDividendId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD "amount" numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD "referenceDividendId" uuid`,
    );
    // The new value is not used in this transaction: the check below
    // compares the kind as text.
    await queryRunner.query(
      `ALTER TYPE "public"."ledger_entry_kind_enum" ADD VALUE 'dividend'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD CONSTRAINT "CHK_ledger_entries_dividend" CHECK (("kind"::text = 'dividend') = ("amount" IS NOT NULL AND "referenceDividendId" IS NOT NULL) AND ("amount" IS NULL OR "amount" > 0))`,
    );
    await queryRunner.query(
      `ALTER TABLE "reference_dividends" ADD CONSTRAINT "FK_43f1966a4eddc4a18e52a5fbe06" FOREIGN KEY ("securityId") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_c5854cf0dd565ebe9d8bc3abdf2" FOREIGN KEY ("referenceDividendId") REFERENCES "reference_dividends"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dividend_dismissals" ADD CONSTRAINT "FK_8f5c80d5f35ee3add830cebbd81" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dividend_dismissals" ADD CONSTRAINT "FK_b9430ef348f6636066982d93e23" FOREIGN KEY ("referenceDividendId") REFERENCES "reference_dividends"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dividend_dismissals" DROP CONSTRAINT "FK_b9430ef348f6636066982d93e23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dividend_dismissals" DROP CONSTRAINT "FK_8f5c80d5f35ee3add830cebbd81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_c5854cf0dd565ebe9d8bc3abdf2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reference_dividends" DROP CONSTRAINT "FK_43f1966a4eddc4a18e52a5fbe06"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT "CHK_ledger_entries_dividend"`,
    );
    // Postgres cannot drop an enum value: rebuild the type without it.
    // This fails, on purpose, while any user dividend is recorded.
    await queryRunner.query(
      `ALTER TYPE "public"."ledger_entry_kind_enum" RENAME TO "ledger_entry_kind_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_entry_kind_enum" AS ENUM('buy', 'sell', 'opening_position')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ALTER COLUMN "kind" TYPE "public"."ledger_entry_kind_enum" USING "kind"::"text"::"public"."ledger_entry_kind_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ledger_entry_kind_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP COLUMN "referenceDividendId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP COLUMN "amount"`,
    );
    await queryRunner.query(`DROP TABLE "dividend_dismissals"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_reference_dividends_security_ex_date"`,
    );
    await queryRunner.query(`DROP TABLE "reference_dividends"`);
  }
}
