import { MigrationInterface, QueryRunner } from 'typeorm';

export class Watchlist1794493710966 implements MigrationInterface {
  name = 'Watchlist1794493710966';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "watchlist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "securityId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0a02323c5cc02e094871f24062b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_watchlist_items_user_security" ON "watchlist_items" ("userId", "securityId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_items" ADD CONSTRAINT "FK_1d44d0b2e52ecad244c712dfafa" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_items" ADD CONSTRAINT "FK_56a9cbb49ac83f7699fc3388570" FOREIGN KEY ("securityId") REFERENCES "securities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "watchlist_items" DROP CONSTRAINT "FK_56a9cbb49ac83f7699fc3388570"`,
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_items" DROP CONSTRAINT "FK_1d44d0b2e52ecad244c712dfafa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_watchlist_items_user_security"`,
    );
    await queryRunner.query(`DROP TABLE "watchlist_items"`);
  }
}
