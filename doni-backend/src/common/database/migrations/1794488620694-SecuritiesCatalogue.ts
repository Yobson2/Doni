import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecuritiesCatalogue1794488620694 implements MigrationInterface {
  name = 'SecuritiesCatalogue1794488620694';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sectors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "code" character varying NOT NULL, "nameFr" character varying NOT NULL, "nameEn" character varying NOT NULL, CONSTRAINT "UQ_182f6a983ef4914b39c1aae5482" UNIQUE ("code"), CONSTRAINT "PK_923fdda0dc12f59add7b3a1782f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."profile_language_enum" AS ENUM('fr', 'en')`,
    );
    await queryRunner.query(
      `CREATE TABLE "securities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ticker" character varying NOT NULL, "name" character varying NOT NULL, "isin" character(12), "sectorId" uuid NOT NULL, "country" character(2) NOT NULL, "profileFr" text, "profileEn" text, "profileOriginalLanguage" "public"."profile_language_enum" NOT NULL DEFAULT 'fr', CONSTRAINT "UQ_a620b008d1143a425a080d451cf" UNIQUE ("ticker"), CONSTRAINT "UQ_0e5ff449d098a2e7975369d9efa" UNIQUE ("isin"), CONSTRAINT "PK_2f2a80064c5bce5a8ff134a38a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "market_indices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "code" character varying NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_a02e6cb50a322ca6e101a516bd7" UNIQUE ("code"), CONSTRAINT "PK_a4a190b0123facde77c1092ca6a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."eod_price_status_enum" AS ENUM('published', 'pending_review')`,
    );
    await queryRunner.query(
      `CREATE TABLE "eod_prices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "securityId" uuid, "indexId" uuid, "tradingDate" date NOT NULL, "close" numeric NOT NULL, "open" numeric, "high" numeric, "low" numeric, "volume" numeric, "sourceDocument" text NOT NULL, "publishedOn" date NOT NULL, "status" "public"."eod_price_status_enum" NOT NULL DEFAULT 'published', CONSTRAINT "CHK_eod_prices_one_subject" CHECK (("securityId" IS NULL) <> ("indexId" IS NULL)), CONSTRAINT "PK_9926398cf4997030d8dfd74eba6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_eod_prices_index_day" ON "eod_prices" ("indexId", "tradingDate") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_eod_prices_security_day" ON "eod_prices" ("securityId", "tradingDate") `,
    );
    await queryRunner.query(
      `ALTER TABLE "securities" ADD CONSTRAINT "FK_ac7e17b607501803b6cf4ec7521" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "eod_prices" ADD CONSTRAINT "FK_b6a0448b66de2ede5b39e0a15fe" FOREIGN KEY ("securityId") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "eod_prices" ADD CONSTRAINT "FK_4503224a1a7c217b9313fa82b6d" FOREIGN KEY ("indexId") REFERENCES "market_indices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "eod_prices" DROP CONSTRAINT "FK_4503224a1a7c217b9313fa82b6d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "eod_prices" DROP CONSTRAINT "FK_b6a0448b66de2ede5b39e0a15fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "securities" DROP CONSTRAINT "FK_ac7e17b607501803b6cf4ec7521"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_eod_prices_security_day"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_eod_prices_index_day"`);
    await queryRunner.query(`DROP TABLE "eod_prices"`);
    await queryRunner.query(`DROP TYPE "public"."eod_price_status_enum"`);
    await queryRunner.query(`DROP TABLE "market_indices"`);
    await queryRunner.query(`DROP TABLE "securities"`);
    await queryRunner.query(`DROP TYPE "public"."profile_language_enum"`);
    await queryRunner.query(`DROP TABLE "sectors"`);
  }
}
