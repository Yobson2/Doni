import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/**
 * One section of a user's data export, contributed by the module that owns
 * the data. Modules register their section at startup (see
 * `UserDataRegistry.register`), so the export never needs editing when a
 * module is added.
 *
 * Account deletion removes the user's row; every entity listed in `entities`
 * must go with it through `ON DELETE CASCADE` foreign keys. The coverage check
 * (`uncoveredUserData`) fails when an entity linked to a user is not listed by
 * any section, or does not cascade.
 */
export interface UserDataSection {
  /** Key of the section in the export, e.g. `watchlist`. */
  readonly key: string;
  /** The entities (tables) whose rows this section exports. */
  readonly entities: readonly (abstract new (...args: never[]) => unknown)[];
  /**
   * The user's rows, as plain JSON-serialisable values. Reads go through
   * `manager` so that every section sees the same snapshot.
   */
  export(userId: string, manager: EntityManager): Promise<unknown>;
}

/** The sections of the user data export, one per contributing module. */
@Injectable()
export class UserDataRegistry {
  private readonly byKey = new Map<string, UserDataSection>();

  register(section: UserDataSection): void {
    if (this.byKey.has(section.key)) {
      throw new Error(`User data section "${section.key}" registered twice`);
    }
    this.byKey.set(section.key, section);
  }

  /** Every registered section, ordered by key. */
  sections(): UserDataSection[] {
    return [...this.byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
}
