import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema, generated from the entities as they stood when the schema
 * moved from `synchronize` to migrations.
 */
export class Baseline1794475739623 implements MigrationInterface {
  name = 'Baseline1794475739623';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid_generate_v4() below comes from this extension.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum" AS ENUM('ADMIN', 'CHEF_ZONE', 'MEMBRE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying NOT NULL, "password" character varying NOT NULL, "firstName" character varying, "lastName" character varying, "role" "public"."user_role_enum" NOT NULL DEFAULT 'MEMBRE', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
  }
}
