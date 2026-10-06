import type { PoolClient } from "pg";
import type { CreatorId } from "../../creator/types.js";
import { CreatorLifecycleUnavailableError } from "../errors.js";
import { acquireCreatorSharedXactLock } from "./creator-lifecycle-lock.js";

export type CreatorLifecycleRow = {
  lifecycleStatus: "active" | "erasing";
};

export async function lockActiveCreatorMutation(
  client: PoolClient,
  creatorId: CreatorId,
): Promise<CreatorLifecycleRow> {
  await acquireCreatorSharedXactLock(client, creatorId);
  const result = await client.query<{ lifecycle_status: "active" | "erasing" }>(
    `SELECT lifecycle_status FROM creators WHERE id = $1 FOR UPDATE`,
    [creatorId],
  );
  if (result.rowCount === 0) {
    throw new CreatorLifecycleUnavailableError(`Creator ${creatorId} is unavailable`);
  }
  const lifecycleStatus = result.rows[0]!.lifecycle_status;
  if (lifecycleStatus !== "active") {
    throw new CreatorLifecycleUnavailableError(`Creator ${creatorId} lifecycle is not active`);
  }
  return { lifecycleStatus };
}
