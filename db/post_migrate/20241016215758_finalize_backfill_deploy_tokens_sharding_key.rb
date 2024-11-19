# frozen_string_literal: true

class FinalizeBackfillDeployTokensShardingKey < Gitlab::Database::Migration[2.2]
  disable_ddl_transaction!
  restrict_gitlab_migration gitlab_schema: :gitlab_main

  milestone '17.6'

  def up
    ensure_batched_background_migration_is_finished(
      job_class_name: 'BackfillDeployTokensShardingKey',
      table_name: :deploy_tokens,
      column_name: :id,
      job_arguments: []
    )
  end

  def down
    # no-op
  end
end
