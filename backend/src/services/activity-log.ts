import { query } from '../db/pool';

export async function logActivity(params: {
  groupId: number;
  actorId: number;
  actionType: 'created' | 'updated' | 'deleted';
  entityType: 'expense' | 'payment';
  entityId: number;
  description: string;
  metadata?: Record<string, any>;
}) {
  const result = await query(
    `INSERT INTO activity_logs (group_id, actor_id, action_type, entity_type, entity_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      params.groupId,
      params.actorId,
      params.actionType,
      params.entityType,
      params.entityId,
      params.description,
      JSON.stringify(params.metadata || {}),
    ]
  );
  return result.rows[0];
}
