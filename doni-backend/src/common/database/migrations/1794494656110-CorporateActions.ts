import { MigrationInterface, QueryRunner } from 'typeorm';

export class CorporateActions1794494656110 implements MigrationInterface {
  name = 'CorporateActions1794494656110';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."corporate_action_kind_enum" AS ENUM('split', 'reverse_split', 'free_shares', 'rights_issue')`,
    );
    await queryRunner.query(
      `CREATE TABLE "corporate_actions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "securityId" uuid NOT NULL, "kind" "public"."corporate_action_kind_enum" NOT NULL, "effectiveDate" date NOT NULL, "ratioHeld" integer NOT NULL, "ratioReceived" integer NOT NULL, "cashInLieuPrice" numeric, "subscriptionPrice" numeric, "sourceNoticeUrl" text NOT NULL, CONSTRAINT "CHK_corporate_actions_terms" CHECK ("ratioHeld" > 0 AND "ratioReceived" > 0 AND ("cashInLieuPrice" IS NULL OR "cashInLieuPrice" >= 0) AND ("subscriptionPrice" IS NULL OR "subscriptionPrice" >= 0)), CONSTRAINT "PK_48691f38beae5aa6ed6d907fea5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_corporate_actions_security_kind_date" ON "corporate_actions" ("securityId", "kind", "effectiveDate") `,
    );
    await queryRunner.query(
      `ALTER TABLE "corporate_actions" ADD CONSTRAINT "FK_b35a1c84fc884406c6a8920d6a2" FOREIGN KEY ("securityId") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "corporate_actions" DROP CONSTRAINT "FK_b35a1c84fc884406c6a8920d6a2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_corporate_actions_security_kind_date"`,
    );
    await queryRunner.query(`DROP TABLE "corporate_actions"`);
    await queryRunner.query(`DROP TYPE "public"."corporate_action_kind_enum"`);
  }
}
