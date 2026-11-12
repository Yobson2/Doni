import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrections of the ledger (ADR 0004): editing or deleting a ledger entry
 * inserts a row here that voids it, naming the entry that replaces it when
 * it was edited. Ledger entries themselves are still never changed, and
 * this table is append-only too. Rows go only when their entries do, that
 * is when the portfolio does.
 */
export class LedgerEntryVoids1794504119382 implements MigrationInterface {
  name = 'LedgerEntryVoids1794504119382';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ledger_entry_voids" ("entryId" uuid NOT NULL, "replacementId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6546b86e736eb709c1efa58f649" UNIQUE ("replacementId"), CONSTRAINT "CHK_ledger_entry_voids_not_itself" CHECK ("replacementId" IS NULL OR "replacementId" <> "entryId"), CONSTRAINT "PK_389088a1a64bb2adb6f42c5c268" PRIMARY KEY ("entryId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entry_voids" ADD CONSTRAINT "FK_389088a1a64bb2adb6f42c5c268" FOREIGN KEY ("entryId") REFERENCES "ledger_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entry_voids" ADD CONSTRAINT "FK_6546b86e736eb709c1efa58f649" FOREIGN KEY ("replacementId") REFERENCES "ledger_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION "ledger_entry_voids_reject_update"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ledger corrections are append-only'; END $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "ledger_entry_voids_append_only" BEFORE UPDATE ON "ledger_entry_voids" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_voids_reject_update"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "ledger_entry_voids_append_only" ON "ledger_entry_voids"`,
    );
    await queryRunner.query(
      `DROP FUNCTION "ledger_entry_voids_reject_update"()`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entry_voids" DROP CONSTRAINT "FK_6546b86e736eb709c1efa58f649"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entry_voids" DROP CONSTRAINT "FK_389088a1a64bb2adb6f42c5c268"`,
    );
    await queryRunner.query(`DROP TABLE "ledger_entry_voids"`);
  }
}
