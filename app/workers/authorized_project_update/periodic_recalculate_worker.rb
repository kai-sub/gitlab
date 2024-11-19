# frozen_string_literal: true

module AuthorizedProjectUpdate
  class PeriodicRecalculateWorker
    include ApplicationWorker

    data_consistency :always # rubocop:disable SidekiqLoadBalancing/WorkerDataConsistency -- will change to sticky with feature-flag

    # This worker does not perform work scoped to a context
    include CronjobQueue # rubocop:disable Scalability/CronWorkerContext

    feature_category :permissions
    urgency :low

    idempotent!

    def perform
      AuthorizedProjectUpdate::PeriodicRecalculateService.new.execute
    end
  end
end
