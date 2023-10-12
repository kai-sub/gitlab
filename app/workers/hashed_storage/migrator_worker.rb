# frozen_string_literal: true

module HashedStorage
  class MigratorWorker # rubocop:disable Scalability/IdempotentWorker
    include ApplicationWorker

    data_consistency :always

    sidekiq_options retry: 3

    queue_namespace :hashed_storage
    feature_category :source_code_management

    # @param [Integer] start initial ID of the batch
    # @param [Integer] finish last ID of the batch
    def perform(start, finish); end
  end
end
