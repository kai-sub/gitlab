# frozen_string_literal: true

class QueueDeleteOrphanedStageRecords < Gitlab::Database::Migration[2.2]
  milestone '17.6'

  restrict_gitlab_migration gitlab_schema: :gitlab_ci

  MIGRATION = "DeleteOrphanedStageRecords"
  DELAY_INTERVAL = 2.minutes
  BATCH_SIZE = 1000
  SUB_BATCH_SIZE = 100

  def up
    queue_batched_background_migration(
      MIGRATION,
      :p_ci_stages,
      :pipeline_id,
      job_interval: DELAY_INTERVAL,
      batch_size: BATCH_SIZE,
      batch_class_name: 'LooseIndexScanBatchingStrategy',
      sub_batch_size: SUB_BATCH_SIZE
    )
  end

  def down
    delete_batched_background_migration(MIGRATION, :p_ci_stages, :pipeline_id, [])
  end
end
