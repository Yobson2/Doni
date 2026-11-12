import type { DataSource, EntityMetadata } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import type { UserDataRegistry } from './user-data.registry';

/**
 * Checks that the user data export and account deletion cover every table
 * that holds a user's data. A table holds user data when it is `users`, or
 * has a foreign key to a table that does (e.g. ledger entries, through their
 * portfolio). Each such table must be exported by a registered section, and
 * each such foreign key must cascade, so that deleting the user's row deletes
 * everything that belongs to them.
 *
 * Returns one message per problem; empty when everything is covered.
 */
export function uncoveredUserData(
  dataSource: DataSource,
  registry: UserDataRegistry,
): string[] {
  const owned = userOwnedEntities(dataSource);
  const exported = new Set<unknown>(
    registry.sections().flatMap((section) => section.entities),
  );

  const problems: string[] = [];
  for (const metadata of sortByTable(owned)) {
    if (!exported.has(metadata.target)) {
      problems.push(
        `${metadata.tableName} holds user data but no export section covers it`,
      );
    }
    for (const fk of metadata.foreignKeys) {
      if (owned.has(fk.referencedEntityMetadata) && fk.onDelete !== 'CASCADE') {
        problems.push(
          `${metadata.tableName}(${fk.columnNames.join(', ')}) is not deleted with its ${fk.referencedEntityMetadata.tableName} row (ON DELETE ${fk.onDelete ?? 'NO ACTION'})`,
        );
      }
    }
  }
  return problems;
}

/** `users` and every entity that references it, directly or transitively. */
function userOwnedEntities(dataSource: DataSource): Set<EntityMetadata> {
  const owned = new Set<EntityMetadata>([dataSource.getMetadata(User)]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const metadata of dataSource.entityMetadatas) {
      if (
        !owned.has(metadata) &&
        metadata.foreignKeys.some((fk) =>
          owned.has(fk.referencedEntityMetadata),
        )
      ) {
        owned.add(metadata);
        grew = true;
      }
    }
  }
  return owned;
}

const sortByTable = (entities: Set<EntityMetadata>): EntityMetadata[] =>
  [...entities].sort((a, b) => a.tableName.localeCompare(b.tableName));
