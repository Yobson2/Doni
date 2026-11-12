import { MigrationInterface, QueryRunner } from 'typeorm';

export class Portfolios1794490649216 implements MigrationInterface {
  name = 'Portfolios1794490649216';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "portfolios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying(100) NOT NULL, CONSTRAINT "PK_488aa6e9b219d1d9087126871ae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_716207c48f2f50d301cb4855d9" ON "portfolios" ("ownerId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_entry_kind_enum" AS ENUM('buy', 'sell')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "portfolioId" uuid NOT NULL, "kind" "public"."ledger_entry_kind_enum" NOT NULL, "securityId" uuid NOT NULL, "tradeDate" date NOT NULL, "quantity" numeric NOT NULL, "price" numeric NOT NULL, "fees" numeric NOT NULL DEFAULT '0', "sgi" character varying(100) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_ledger_entries_amounts" CHECK ("quantity" > 0 AND "price" >= 0 AND "fees" >= 0), CONSTRAINT "PK_6efcb84411d3f08b08450ae75d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_entries_portfolio_date" ON "ledger_entries" ("portfolioId", "tradeDate") `,
    );
    await queryRunner.query(
      `ALTER TABLE "portfolios" ADD CONSTRAINT "FK_716207c48f2f50d301cb4855d9a" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_211847be2a4d297a4d905e94715" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_9dbc929f3ac3b9e4566c8fd951a" FOREIGN KEY ("securityId") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    // The ledger is append-only (ADR 0004): entries are inserted, never
    // changed. Corrections are new entries. Rows go only when their
    // portfolio does.
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION "ledger_entries_reject_update"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ledger entries are append-only'; END $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "ledger_entries_append_only" BEFORE UPDATE ON "ledger_entries" FOR EACH ROW EXECUTE FUNCTION "ledger_entries_reject_update"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "ledger_entries_append_only" ON "ledger_entries"`,
    );
    await queryRunner.query(`DROP FUNCTION "ledger_entries_reject_update"()`);
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_9dbc929f3ac3b9e4566c8fd951a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_211847be2a4d297a4d905e94715"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portfolios" DROP CONSTRAINT "FK_716207c48f2f50d301cb4855d9a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ledger_entries_portfolio_date"`,
    );
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP TYPE "public"."ledger_entry_kind_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_716207c48f2f50d301cb4855d9"`,
    );
    await queryRunner.query(`DROP TABLE "portfolios"`);
  }
}
